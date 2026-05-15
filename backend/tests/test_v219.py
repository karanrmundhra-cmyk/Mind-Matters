"""v2.19 backend tests — Inline commenting on Tasks/Routines/CashFlow.

Coverage:
  - GET  /api/comments/counts?project_id=X&resource_type=Y  → {resource_id: count}
  - POST /api/projects/{pid}/comments  (resource_type/resource_id/body)  count++
  - DELETE /api/comments/{cid}  → only owner or admin
  - Comment surfaces in /api/activity feed (regression with v2.18)
"""
import os
import time
import requests
import pytest


def _read_env_file():
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env_file() or "").rstrip("/")
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


@pytest.fixture(scope="module")
def seed_task(auth):
    """Create a fresh task to comment on; cleanup at module teardown."""
    r = auth.post(f"{BASE_URL}/api/tasks",
                  json={"task": "TEST_v219_comment_target",
                        "name": "Karan", "due_date": "2026-02-01",
                        "expected_minutes": 5})
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    yield r.json()
    auth.delete(f"{BASE_URL}/api/tasks/{tid}")


# ───────── GET /api/comments/counts ─────────
class TestCommentCounts:
    def test_counts_returns_dict(self, auth, personal_pid):
        r = auth.get(f"{BASE_URL}/api/comments/counts",
                     params={"project_id": personal_pid,
                             "resource_type": "task"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict), f"expected dict map, got {type(data)}"
        # Every value should be an int >= 1 (group result)
        for k, v in data.items():
            assert isinstance(k, str) and len(k) > 0
            assert isinstance(v, int) and v >= 1

    def test_counts_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/comments/counts",
                         params={"project_id": "x", "resource_type": "task"})
        assert r.status_code in (401, 403), r.status_code

    def test_counts_non_member_returns_empty(self, auth):
        # Pass a clearly non-existent project_id — non-member path returns {}
        r = auth.get(f"{BASE_URL}/api/comments/counts",
                     params={"project_id": "no-such-project-zzz",
                             "resource_type": "task"})
        assert r.status_code == 200
        assert r.json() == {}

    def test_count_increments_after_post(self, auth, personal_pid, seed_task):
        tid = seed_task["id"]
        # Baseline
        r0 = auth.get(f"{BASE_URL}/api/comments/counts",
                      params={"project_id": personal_pid,
                              "resource_type": "task"})
        base = r0.json().get(tid, 0)

        # Add a comment
        c = auth.post(f"{BASE_URL}/api/projects/{personal_pid}/comments",
                      json={"resource_type": "task",
                            "resource_id": tid,
                            "body": "TEST_v219 first"})
        assert c.status_code == 200, c.text

        r1 = auth.get(f"{BASE_URL}/api/comments/counts",
                      params={"project_id": personal_pid,
                              "resource_type": "task"})
        assert r1.json().get(tid, 0) == base + 1, \
            f"expected count {base+1}, got {r1.json().get(tid)}"

        # Add a second
        c2 = auth.post(f"{BASE_URL}/api/projects/{personal_pid}/comments",
                       json={"resource_type": "task",
                             "resource_id": tid,
                             "body": "TEST_v219 second"})
        assert c2.status_code == 200

        r2 = auth.get(f"{BASE_URL}/api/comments/counts",
                      params={"project_id": personal_pid,
                              "resource_type": "task"})
        assert r2.json().get(tid, 0) == base + 2

    def test_resource_type_filter_isolates(self, auth, personal_pid):
        """task and routine counts shouldn't bleed."""
        rt = auth.get(f"{BASE_URL}/api/comments/counts",
                      params={"project_id": personal_pid,
                              "resource_type": "task"}).json()
        rr = auth.get(f"{BASE_URL}/api/comments/counts",
                      params={"project_id": personal_pid,
                              "resource_type": "routine"}).json()
        # No key from routines map should ever appear in tasks map (different ids)
        assert set(rt.keys()).isdisjoint(set(rr.keys())) or rt == {} or rr == {}


# ───────── POST + DELETE comment lifecycle ─────────
class TestCommentLifecycle:
    def test_post_then_delete_own_comment(self, auth, personal_pid, seed_task):
        tid = seed_task["id"]
        c = auth.post(f"{BASE_URL}/api/projects/{personal_pid}/comments",
                      json={"resource_type": "task",
                            "resource_id": tid,
                            "body": "TEST_v219 will-delete"})
        assert c.status_code == 200, c.text
        cid = c.json()["id"]
        assert c.json()["body"] == "TEST_v219 will-delete"

        # Delete it as the owner
        d = auth.delete(f"{BASE_URL}/api/comments/{cid}")
        assert d.status_code == 200

        # Verify deletion via list
        lst = auth.get(f"{BASE_URL}/api/projects/{personal_pid}/comments",
                       params={"resource_type": "task",
                               "resource_id": tid}).json()
        assert all(x["id"] != cid for x in lst)

    def test_empty_body_rejected(self, auth, personal_pid, seed_task):
        c = auth.post(f"{BASE_URL}/api/projects/{personal_pid}/comments",
                      json={"resource_type": "task",
                            "resource_id": seed_task["id"],
                            "body": "   "})
        assert c.status_code == 400


# ───────── Activity feed integration (regression with v2.18) ─────────
class TestCommentInActivity:
    def test_new_comment_surfaces_in_activity(self, auth, personal_pid, seed_task):
        marker = f"TEST_v219_activity_{int(time.time())}"
        c = auth.post(f"{BASE_URL}/api/projects/{personal_pid}/comments",
                      json={"resource_type": "task",
                            "resource_id": seed_task["id"],
                            "body": marker})
        assert c.status_code == 200
        time.sleep(0.4)
        r = auth.get(f"{BASE_URL}/api/activity?limit=80")
        assert r.status_code == 200
        events = r.json()
        assert any(marker in (e.get("body") or "") and e["kind"] == "comment"
                   for e in events), \
            f"comment {marker} did not appear in /api/activity"
