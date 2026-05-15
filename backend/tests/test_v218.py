"""v2.18 backend tests — Activity feed + reminders/deadlines project_id defaults."""
import os
import time
import requests
import pytest

def _read_env_file():
    """Read REACT_APP_BACKEND_URL from /app/frontend/.env (test env doesn't inherit shell)."""
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
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ───────── Activity feed (v2.18) ─────────
class TestActivity:
    def test_activity_endpoint_returns_list(self, auth):
        r = auth.get(f"{BASE_URL}/api/activity?limit=30")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_activity_event_shape(self, auth):
        # Seed one task so we have at least one event
        t = auth.post(f"{BASE_URL}/api/tasks",
                      json={"task": "TEST_v218_activity_seed",
                            "name": "Karan", "due_date": "2026-01-15",
                            "expected_minutes": 10})
        assert t.status_code == 200, t.text
        time.sleep(0.3)
        r = auth.get(f"{BASE_URL}/api/activity?limit=50")
        assert r.status_code == 200
        events = r.json()
        assert len(events) > 0, "expected at least one activity event after creating a task"
        required = {"kind", "project_id", "project_name", "project_color",
                    "actor_id", "actor_name", "subject_kind", "subject_id",
                    "body", "created_at"}
        ev = events[0]
        missing = required - set(ev.keys())
        assert not missing, f"missing fields on event: {missing}; got: {ev}"
        valid_kinds = {"comment", "task_created", "routine_created", "transaction_created"}
        for e in events:
            assert e["kind"] in valid_kinds, f"unexpected kind {e['kind']}"

    def test_activity_newest_first(self, auth):
        r = auth.get(f"{BASE_URL}/api/activity?limit=50")
        events = r.json()
        if len(events) >= 2:
            ts = [e["created_at"] for e in events]
            assert ts == sorted(ts, reverse=True), \
                "events not sorted newest-first"

    def test_activity_only_accessible_projects(self, auth):
        # Fetch projects to verify project_id filter
        pr = auth.get(f"{BASE_URL}/api/projects")
        assert pr.status_code == 200
        pids = {p["id"] for p in pr.json()}
        r = auth.get(f"{BASE_URL}/api/activity?limit=50")
        for e in r.json():
            assert e["project_id"] in pids, \
                f"activity event leaked from non-accessible project {e['project_id']}"

    def test_activity_includes_comment_event(self, auth):
        # find a task to comment on
        tasks = auth.get(f"{BASE_URL}/api/tasks").json()
        assert len(tasks) > 0
        tid = tasks[0]["id"]
        pid = tasks[0]["project_id"]
        c = auth.post(f"{BASE_URL}/api/projects/{pid}/comments",
                      json={"resource_type": "task",
                            "resource_id": tid,
                            "body": "TEST_v218 comment activity"})
        assert c.status_code == 200, c.text
        time.sleep(0.3)
        r = auth.get(f"{BASE_URL}/api/activity?limit=80")
        events = r.json()
        comment_events = [e for e in events if e["kind"] == "comment"]
        assert any("TEST_v218 comment activity" in (e.get("body") or "")
                   for e in comment_events), \
            "Recently-created comment not found in activity feed"


# ───────── Reminder + Deadline project_id defaulting (v2.18) ─────────
class TestReminderDeadlineProjectDefault:
    def test_reminder_without_project_id_defaults_to_personal(self, auth):
        # Find personal project
        pr = auth.get(f"{BASE_URL}/api/projects").json()
        personal = next((p for p in pr if p.get("is_default")), None) or pr[0]
        body = {"title": "TEST_v218_reminder_default",
                "fire_at": "2026-12-01T09:00:00Z",
                "notes": "", "recurrence": "none"}
        r = auth.post(f"{BASE_URL}/api/reminders", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "project_id" in d and d["project_id"], \
            f"reminder missing project_id: {d}"
        assert d["project_id"] == personal["id"], \
            f"expected default Personal project ({personal['id']}), got {d['project_id']}"
        # Verify GET returns project_id too
        lst = auth.get(f"{BASE_URL}/api/reminders").json()
        match = [x for x in lst if x["id"] == d["id"]]
        assert match and match[0]["project_id"] == personal["id"]
        # Cleanup
        auth.delete(f"{BASE_URL}/api/reminders/{d['id']}")

    def test_deadline_without_project_id_defaults_to_personal(self, auth):
        pr = auth.get(f"{BASE_URL}/api/projects").json()
        personal = next((p for p in pr if p.get("is_default")), None) or pr[0]
        body = {"title": "TEST_v218_deadline_default",
                "due_date": "2026-12-15", "notes": ""}
        r = auth.post(f"{BASE_URL}/api/deadlines", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("project_id") == personal["id"]
        lst = auth.get(f"{BASE_URL}/api/deadlines").json()
        match = [x for x in lst if x["id"] == d["id"]]
        assert match and match[0]["project_id"] == personal["id"]
        auth.delete(f"{BASE_URL}/api/deadlines/{d['id']}")

    def test_note_without_project_id_defaults_to_personal(self, auth):
        pr = auth.get(f"{BASE_URL}/api/projects").json()
        personal = next((p for p in pr if p.get("is_default")), None) or pr[0]
        r = auth.post(f"{BASE_URL}/api/notes",
                      json={"title": "TEST_v218_note_default", "body": "x"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("project_id") == personal["id"]
        auth.delete(f"{BASE_URL}/api/notes/{d['id']}")
