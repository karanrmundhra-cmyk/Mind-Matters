"""v2.20 backend tests — @-mention autocomplete, mention Telegram notify,
Notes-page comment thread (reuse), News custom RSS URL.

Coverage:
  - GET  /api/projects/{pid}/mentionable  →  membership-gated; returns
        [{user_id, name, email, telegram_linked}] including owner.
  - POST /api/projects/{pid}/comments with body containing '@karan' should
        succeed (mention notification is fire-and-forget) and return Comment.
  - resource_type='note' is accepted by the comments endpoint (Notes wiring).
  - GET  /api/news?custom_url=<URL>  → source='custom' for valid http(s) URL;
        otherwise source='google-news' (or 'fallback' if RSS unreachable).
"""
import os
import requests
import pytest


def _env():
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
EMAIL = "karan@mindmatters.local"
PASSWORD = "changeme123"


# ───────────────── shared fixtures ─────────────────
@pytest.fixture(scope="module")
def auth():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def personal_pid(auth):
    pr = auth.get(f"{BASE_URL}/api/projects").json()
    personal = next((p for p in pr if p.get("is_default")), None) or pr[0]
    return personal["id"]


# ───────────────── 1) /projects/{pid}/mentionable ─────────────────
class TestMentionable:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/projects/anything/mentionable")
        # Either 401 (unauth) or 403 (not member) is acceptable; must not be 200
        assert r.status_code in (401, 403, 422), r.text

    def test_returns_owner_with_expected_shape(self, auth, personal_pid):
        r = auth.get(f"{BASE_URL}/api/projects/{personal_pid}/mentionable")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "owner must be included"
        first = data[0]
        for key in ("user_id", "name", "email", "telegram_linked"):
            assert key in first, f"missing field {key}: {first}"
        assert isinstance(first["telegram_linked"], bool)

    def test_karan_is_telegram_linked(self, auth, personal_pid):
        r = auth.get(f"{BASE_URL}/api/projects/{personal_pid}/mentionable")
        assert r.status_code == 200
        karan = next(
            (m for m in r.json()
             if m["email"].lower() == EMAIL or m["name"].lower() == "karan"),
            None,
        )
        assert karan, f"karan not in mentionable list: {r.json()}"
        # Per task context: karan has telegram_chat_id set.
        assert karan["telegram_linked"] is True

    def test_non_member_forbidden(self, auth):
        # Random project id should be 403 or 404
        r = auth.get(f"{BASE_URL}/api/projects/does-not-exist-12345/mentionable")
        assert r.status_code in (403, 404)


# ───────────────── 2) POST comment with @mention does not block ─────────────────
class TestMentionedCommentDoesNotBlock:
    def test_post_comment_with_mention_returns_200(self, auth, personal_pid):
        body = {
            "resource_type": "note",
            "resource_id": personal_pid,
            "body": "TEST_v220 hello @karan check this out",
        }
        r = auth.post(
            f"{BASE_URL}/api/projects/{personal_pid}/comments", json=body,
        )
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["body"] == body["body"]
        assert c["resource_type"] == "note"
        # cleanup
        auth.delete(f"{BASE_URL}/api/comments/{c['id']}")

    def test_post_comment_without_mention_works(self, auth, personal_pid):
        body = {
            "resource_type": "note",
            "resource_id": personal_pid,
            "body": "TEST_v220 plain comment",
        }
        r = auth.post(
            f"{BASE_URL}/api/projects/{personal_pid}/comments", json=body,
        )
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        auth.delete(f"{BASE_URL}/api/comments/{cid}")

    def test_unknown_mention_still_succeeds(self, auth, personal_pid):
        body = {
            "resource_type": "note",
            "resource_id": personal_pid,
            "body": "TEST_v220 hi @nobody.here.really and @ghost",
        }
        r = auth.post(
            f"{BASE_URL}/api/projects/{personal_pid}/comments", json=body,
        )
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        auth.delete(f"{BASE_URL}/api/comments/{cid}")


# ───────────────── 3) Notes comment-thread wiring (resource_type='note') ─────────────────
class TestNoteCommentWiring:
    def test_can_post_note_comment(self, auth, personal_pid):
        body = {
            "resource_type": "note",
            "resource_id": personal_pid,  # note shares the project as anchor
            "body": "TEST_v220 note thread comment",
        }
        r = auth.post(
            f"{BASE_URL}/api/projects/{personal_pid}/comments", json=body,
        )
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["resource_type"] == "note"
        # cleanup
        auth.delete(f"{BASE_URL}/api/comments/{c['id']}")

    def test_counts_endpoint_supports_note_type(self, auth, personal_pid):
        r = auth.get(
            f"{BASE_URL}/api/comments/counts",
            params={"project_id": personal_pid, "resource_type": "note"},
        )
        assert r.status_code == 200
        assert isinstance(r.json(), dict)


# ───────────────── 4) /api/news?custom_url=… ─────────────────
class TestNewsCustomUrl:
    def test_default_news_returns_source_label(self, auth):
        r = auth.get(f"{BASE_URL}/api/news")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        assert "source" in data, data
        # source must be one of these; 'custom' should NEVER appear here.
        assert data["source"] in ("google-news", "fallback")

    def test_custom_url_returns_source_custom(self, auth):
        # Use a stable, well-known RSS feed.
        url = "https://hnrss.org/frontpage"
        r = auth.get(f"{BASE_URL}/api/news", params={"custom_url": url})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "source" in data
        # When custom_url is provided and starts with http(s)://, the backend
        # must label the response source='custom' regardless of whether the
        # external feed is reachable.
        assert data["source"] == "custom", (
            f"expected source='custom' for custom_url={url}; got {data}"
        )

    def test_invalid_custom_url_falls_back(self, auth):
        # Non http(s) URL must be ignored (not treated as custom).
        r = auth.get(f"{BASE_URL}/api/news",
                     params={"custom_url": "ftp://example.com/rss"})
        assert r.status_code == 200
        assert r.json().get("source") != "custom"

    def test_not_a_url_falls_back_to_google_news(self, auth):
        # 'not-a-url' must fall through to category-based feed.
        r = auth.get(f"{BASE_URL}/api/news",
                     params={"custom_url": "not-a-url"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("source") != "custom"
        assert data.get("source") in ("google-news", "fallback")

    def test_bbc_custom_url_returns_source_custom(self, auth):
        url = "https://feeds.bbci.co.uk/news/world/rss.xml"
        r = auth.get(f"{BASE_URL}/api/news", params={"custom_url": url})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("source") == "custom", data
        assert isinstance(data.get("items"), list)

    def test_category_tech_returns_google_news(self, auth):
        r = auth.get(f"{BASE_URL}/api/news", params={"category": "tech"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("source") in ("google-news", "fallback")


# ───────────────── 5) v2.19 regression — comment counts batch endpoint ─────────────────
class TestRegressionCommentsCounts:
    def test_counts_shape(self, auth, personal_pid):
        r = auth.get(
            f"{BASE_URL}/api/comments/counts",
            params={"project_id": personal_pid, "resource_type": "task"},
        )
        assert r.status_code == 200
        assert isinstance(r.json(), dict)
