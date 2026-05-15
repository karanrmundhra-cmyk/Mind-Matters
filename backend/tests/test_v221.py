"""v2.21 backend tests — Daily Telegram digest of @mentions + new rows.

Coverage:
  - GET    /api/digest/settings  → {enabled, hour, last_sent_at, telegram_linked}
  - PATCH  /api/digest/settings  → clamps hour to 0..23 and persists
  - POST   /api/digest/send-now  → requires telegram_linked; returns
        {ok, items:{mentions, comments, new_tasks, new_transactions}}
  - tg.digest_loop is importable and wired into server.py startup.
  - Regression: comment counts + mentionable list (v2.19/2.20) still pass.
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


# ───────────────── 1) GET /digest/settings shape ─────────────────
class TestDigestSettingsGet:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/digest/settings")
        assert r.status_code in (401, 403), r.text

    def test_returns_expected_keys(self, auth):
        r = auth.get(f"{BASE_URL}/api/digest/settings")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("enabled", "hour", "last_sent_at", "telegram_linked"):
            assert k in data, f"missing key {k}: {data}"
        assert isinstance(data["enabled"], bool)
        assert isinstance(data["hour"], int)
        assert 0 <= data["hour"] <= 23
        assert isinstance(data["telegram_linked"], bool)
        # last_sent_at is either None or a string
        assert data["last_sent_at"] is None or isinstance(data["last_sent_at"], str)

    def test_karan_is_telegram_linked(self, auth):
        r = auth.get(f"{BASE_URL}/api/digest/settings")
        assert r.json()["telegram_linked"] is True


# ───────────────── 2) PATCH /digest/settings ─────────────────
class TestDigestSettingsPatch:
    def test_persists_enabled_and_hour(self, auth):
        # Round-trip: set then GET to verify persistence.
        r = auth.patch(f"{BASE_URL}/api/digest/settings",
                       json={"enabled": True, "hour": 7})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body["enabled"] is True
        assert body["hour"] == 7
        # Verify persistence
        g = auth.get(f"{BASE_URL}/api/digest/settings").json()
        assert g["enabled"] is True
        assert g["hour"] == 7
        # Restore default (9)
        auth.patch(f"{BASE_URL}/api/digest/settings",
                   json={"enabled": True, "hour": 9})

    def test_clamps_high_hour(self, auth):
        r = auth.patch(f"{BASE_URL}/api/digest/settings",
                       json={"enabled": True, "hour": 50})
        assert r.status_code == 200, r.text
        assert r.json()["hour"] == 23
        g = auth.get(f"{BASE_URL}/api/digest/settings").json()
        assert g["hour"] == 23
        # restore
        auth.patch(f"{BASE_URL}/api/digest/settings",
                   json={"enabled": True, "hour": 9})

    def test_clamps_negative_hour(self, auth):
        r = auth.patch(f"{BASE_URL}/api/digest/settings",
                       json={"enabled": True, "hour": -5})
        assert r.status_code == 200, r.text
        assert r.json()["hour"] == 0
        # restore
        auth.patch(f"{BASE_URL}/api/digest/settings",
                   json={"enabled": True, "hour": 9})

    def test_disable_persists(self, auth):
        r = auth.patch(f"{BASE_URL}/api/digest/settings",
                       json={"enabled": False, "hour": 9})
        assert r.status_code == 200
        g = auth.get(f"{BASE_URL}/api/digest/settings").json()
        assert g["enabled"] is False
        # restore
        auth.patch(f"{BASE_URL}/api/digest/settings",
                   json={"enabled": True, "hour": 9})


# ───────────────── 3) POST /digest/send-now ─────────────────
class TestDigestSendNow:
    def test_send_now_returns_items_payload(self, auth):
        """Karan is telegram_linked; this WILL deliver a real preview message.
        Run once to exercise the synchronous code path (same logic as
        digest_loop body)."""
        r = auth.post(f"{BASE_URL}/api/digest/send-now")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ok" in data and "items" in data
        items = data["items"]
        for k in ("mentions", "comments", "new_tasks", "new_transactions"):
            assert k in items, f"missing items.{k}: {items}"
            assert isinstance(items[k], int)
            assert items[k] >= 0

    def test_send_now_requires_telegram_linked(self):
        """Create a fresh user with no telegram link → 400."""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        import uuid as _u
        email = f"TEST_digest_{_u.uuid4().hex[:8]}@mindmatters.local"
        r = s.post(f"{BASE_URL}/api/auth/signup", json={
            "first_name": "DigestTest", "email": email,
            "password": "changeme123",
        })
        if r.status_code != 200:
            pytest.skip(f"signup unavailable: {r.status_code} {r.text[:120]}")
        token = r.json()["token"]
        s.headers.update({"Authorization": f"Bearer {token}"})
        r2 = s.post(f"{BASE_URL}/api/digest/send-now")
        assert r2.status_code == 400, r2.text
        assert "telegram" in r2.text.lower()


# ───────────────── 4) digest_loop wired into server ─────────────────
class TestDigestLoopWired:
    def test_digest_loop_importable(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from tg import digest_loop  # noqa: F401
        assert callable(digest_loop)

    def test_server_imports_digest_loop(self):
        with open("/app/backend/server.py") as f:
            src = f.read()
        assert "from tg import" in src and "digest_loop" in src
        assert "asyncio.create_task(digest_loop" in src, \
            "digest_loop must be spawned in startup"


# ───────────────── 5) Regression v2.17→v2.20 ─────────────────
class TestRegression:
    def test_mentionable_still_works(self, auth, personal_pid):
        r = auth.get(f"{BASE_URL}/api/projects/{personal_pid}/mentionable")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        assert all(k in data[0] for k in
                   ("user_id", "name", "email", "telegram_linked"))

    def test_comment_counts_still_works(self, auth, personal_pid):
        r = auth.get(f"{BASE_URL}/api/comments/counts",
                     params={"project_id": personal_pid,
                             "resource_type": "task"})
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_news_default_still_works(self, auth):
        r = auth.get(f"{BASE_URL}/api/news")
        assert r.status_code == 200
        data = r.json()
        assert data.get("source") in ("google-news", "fallback")
        assert isinstance(data.get("items"), list)

    def test_activity_feed_endpoint(self, auth):
        """Reports → Inbox activity feed source."""
        r = auth.get(f"{BASE_URL}/api/activity")
        assert r.status_code == 200, r.text
        # should be a list of activity rows
        assert isinstance(r.json(), list)
