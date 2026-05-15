"""v2.22 backend tests — 30-item polish sprint.

Coverage:
  - P3.17 DELETE /api/tasks/completed   → bulk-deletes Done/Completed; sr_no compacted
  - P3.17 DELETE /api/routines/completed → bulk-deletes Done/Completed; sr_no compacted
  - P2.8  POST   /api/tasks/reorder      → sr_no = 1..N after reorder
  - P3.23 First-login seed strict 2+2+2 shape (Rahul/Amit, Uptime/Hydrate, Zomato/Brinda)
"""
import os
import time
import uuid
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
    p = next((x for x in pr if x.get("is_default")), None) or pr[0]
    return p["id"]


# ───────────── P3.17 — DELETE /tasks/completed ─────────────
class TestBulkDeleteCompletedTasks:
    def test_bulk_delete_completed_tasks_and_compact_sr(self, auth, personal_pid):
        # Snapshot current task sr_nos so we can detect compaction
        prior = auth.get(f"{BASE_URL}/api/tasks").json()
        prior_ids = {t["id"] for t in prior}

        # Create 3 fresh tasks; mark 2 as Done.
        marker = f"TEST_v222_{uuid.uuid4().hex[:6]}"
        created = []
        for i, status in enumerate(["Done", "To-Do", "Completed"]):
            r = auth.post(f"{BASE_URL}/api/tasks", json={
                "name": f"{marker}_{i}", "task": "bulk-delete probe",
                "status": status, "project_id": personal_pid,
            })
            assert r.status_code in (200, 201), r.text
            created.append(r.json())

        # Bulk delete completed
        r = auth.delete(f"{BASE_URL}/api/tasks/completed")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "deleted" in body
        assert body["deleted"] >= 2, f"expected >=2 deleted, got {body}"

        # Verify the To-Do one is still present, Done ones are gone
        after = auth.get(f"{BASE_URL}/api/tasks").json()
        after_names = {t["name"]: t for t in after}
        assert f"{marker}_1" in after_names, "non-completed task should survive"
        assert f"{marker}_0" not in after_names, "Done task should be gone"
        assert f"{marker}_2" not in after_names, "Completed task should be gone"

        # Verify sr_no compaction: sorted sr_no list is exactly 1..N
        srs = sorted(t.get("sr_no", 0) for t in after)
        assert srs == list(range(1, len(after) + 1)), \
            f"sr_no not compacted to 1..N: {srs}"

        # Cleanup the surviving probe task
        survivor = after_names[f"{marker}_1"]
        auth.delete(f"{BASE_URL}/api/tasks/{survivor['id']}")
        _ = prior_ids  # silence unused

    def test_bulk_delete_routines_completed_and_compact_sr(self, auth, personal_pid):
        marker = f"TEST_v222r_{uuid.uuid4().hex[:6]}"
        created = []
        # Create all as Active (schema only allows Active|Paused on POST).
        for i in range(3):
            r = auth.post(f"{BASE_URL}/api/routines", json={
                "name": f"{marker}_{i}", "activity": "probe",
                "frequency": "Daily", "status": "Active",
                "project_id": personal_pid,
            })
            assert r.status_code in (200, 201), r.text
            created.append(r.json())
        # PATCH 2 of them to Done/Completed (frontend mirrors this behaviour)
        auth.patch(f"{BASE_URL}/api/routines/{created[0]['id']}",
                   json={"status": "Done"})
        auth.patch(f"{BASE_URL}/api/routines/{created[2]['id']}",
                   json={"status": "Completed"})

        r = auth.delete(f"{BASE_URL}/api/routines/completed")
        assert r.status_code == 200, r.text
        assert r.json().get("deleted", 0) >= 2

        after = auth.get(f"{BASE_URL}/api/routines").json()
        names = {x["name"]: x for x in after}
        assert f"{marker}_1" in names
        assert f"{marker}_0" not in names
        assert f"{marker}_2" not in names

        srs = sorted(x.get("sr_no", 0) for x in after)
        assert srs == list(range(1, len(after) + 1)), \
            f"routines sr_no not compacted: {srs}"

        auth.delete(f"{BASE_URL}/api/routines/{names[f'{marker}_1']['id']}")


# ───────────── P2.8 — POST /tasks/reorder produces 1..N sr_no ─────────────
class TestReorderSrSequential:
    def test_reorder_tasks_sr_no_is_1_to_n(self, auth, personal_pid):
        marker = f"TEST_v222ord_{uuid.uuid4().hex[:6]}"
        ids = []
        for i in range(4):
            r = auth.post(f"{BASE_URL}/api/tasks", json={
                "name": f"{marker}_{i}", "task": "reorder probe",
                "status": "To-Do", "project_id": personal_pid,
            })
            assert r.status_code in (200, 201)
            ids.append(r.json()["id"])

        # Reverse-order the *full* user task list so the result is deterministic
        all_tasks = auth.get(f"{BASE_URL}/api/tasks").json()
        desired = list(reversed([t["id"] for t in all_tasks]))
        r = auth.post(f"{BASE_URL}/api/tasks/reorder", json={"ids": desired})
        assert r.status_code == 200, r.text
        assert r.json().get("count") == len(desired)

        # Refetch and verify sr_no is 1..N and matches desired sequence
        again = auth.get(f"{BASE_URL}/api/tasks").json()
        # Sort by sr_no
        again_sorted = sorted(again, key=lambda x: x.get("sr_no", 0))
        srs = [t.get("sr_no") for t in again_sorted]
        assert srs == list(range(1, len(again_sorted) + 1)), \
            f"sr_no after reorder not 1..N: {srs}"
        # The id order matches desired
        assert [t["id"] for t in again_sorted] == desired, \
            "task id order doesn't follow reorder payload"

        # Cleanup probe tasks
        for _id in ids:
            auth.delete(f"{BASE_URL}/api/tasks/{_id}")


# ───────────── P3.23 — First-login strict 2+2+2 seed ─────────────
class TestStrictSeed:
    def test_strict_seed_2_2_2_for_fresh_user(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"TEST_v222_seed_{uuid.uuid4().hex[:8]}@mindmatters.local"
        r = s.post(f"{BASE_URL}/api/auth/signup", json={
            "first_name": "SeedProbe", "email": email, "password": "seedpass123",
        })
        assert r.status_code == 200, r.text
        s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})

        # Seed endpoint (idempotent / no-op if already seeded)
        sr = s.post(f"{BASE_URL}/api/seed/first-login")
        assert sr.status_code == 200, sr.text

        tasks = s.get(f"{BASE_URL}/api/tasks").json()
        routines = s.get(f"{BASE_URL}/api/routines").json()
        tx = s.get(f"{BASE_URL}/api/transactions").json()

        assert len(tasks) == 2, f"expected 2 seed tasks, got {len(tasks)}"
        assert len(routines) == 2, f"expected 2 seed routines, got {len(routines)}"
        assert len(tx) == 2, f"expected 2 seed transactions, got {len(tx)}"

        task_names = sorted(t.get("name", "") for t in tasks)
        assert task_names == ["Amit", "Rahul"], task_names

        routine_acts = sorted(r.get("activity", "") for r in routines)
        assert routine_acts == ["Hydrate & Tea", "Uptime"], routine_acts

        tx_names = sorted(x.get("name", "") for x in tx)
        assert tx_names == ["Brinda", "Zomato"], tx_names

        # Verify the Brinda loan-given and Zomato expense categories
        bymap = {x["name"]: x for x in tx}
        assert bymap["Brinda"].get("category") == "loan_given"
        assert bymap["Zomato"].get("category") == "expense"


# ───────────── Smoke: auth still works & no regression on /tasks list ─────────────
class TestSmoke:
    def test_auth_me(self, auth):
        r = auth.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == EMAIL

    def test_tasks_list_ok(self, auth):
        r = auth.get(f"{BASE_URL}/api/tasks")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
