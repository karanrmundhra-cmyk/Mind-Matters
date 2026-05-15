"""v2.16 backend tests — subtask (parent_id) support for routines & transactions,
attachment upload endpoints for tasks/routines/transactions used by drag-drop."""
import os
import io
import pytest
import requests

def _read_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _read_url()
EMAIL = "karan@mindmatters.local"
PASSWORD = "changeme123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---------- Routine subtask (parent_id) ----------
class TestRoutineSubtask:
    def test_create_routine_then_subroutine_with_parent_id(self, auth):
        parent_payload = {"group": "TEST_v216_parent_routine", "name": "Morning block",
                          "activity": "Stretch", "frequency": "Daily", "priority": "High"}
        rp = auth.post(f"{BASE_URL}/api/routines", json=parent_payload)
        assert rp.status_code in (200, 201), rp.text
        parent = rp.json()
        assert parent.get("id"), parent
        parent_id = parent["id"]

        # create subroutine
        child_payload = {"group": "TEST_v216_parent_routine", "name": "Push-ups",
                         "activity": "Push-ups", "frequency": "Daily", "priority": "High",
                         "parent_id": parent_id}
        rc = auth.post(f"{BASE_URL}/api/routines", json=child_payload)
        assert rc.status_code in (200, 201), rc.text
        child = rc.json()
        assert child.get("parent_id") == parent_id, f"parent_id not echoed: {child}"

        # GET listing should return both rows including parent_id
        lst = auth.get(f"{BASE_URL}/api/routines")
        assert lst.status_code == 200
        rows = lst.json()
        found_child = next((r for r in rows if r["id"] == child["id"]), None)
        assert found_child is not None, "child not in listing"
        assert found_child.get("parent_id") == parent_id

        # cleanup
        auth.delete(f"{BASE_URL}/api/routines/{child['id']}")
        auth.delete(f"{BASE_URL}/api/routines/{parent_id}")


# ---------- Transaction subtask (parent_id) ----------
class TestTransactionSubtask:
    def test_create_transaction_then_split_with_parent_id(self, auth):
        parent_payload = {"label": "TEST_v216_bill", "amount": 1000.0,
                          "direction": "out", "category": "expense",
                          "date": "2026-01-15", "currency": "INR"}
        rp = auth.post(f"{BASE_URL}/api/transactions", json=parent_payload)
        assert rp.status_code in (200, 201), rp.text
        parent = rp.json()
        parent_id = parent["id"]

        child_payload = {"label": "TEST_v216_line_item", "amount": 250.0,
                         "direction": "out", "category": "expense",
                         "date": "2026-01-15", "currency": "INR",
                         "parent_id": parent_id}
        rc = auth.post(f"{BASE_URL}/api/transactions", json=child_payload)
        assert rc.status_code in (200, 201), rc.text
        child = rc.json()
        assert child.get("parent_id") == parent_id

        # verify list returns it
        lst = auth.get(f"{BASE_URL}/api/transactions")
        assert lst.status_code == 200
        rows = lst.json()
        found = next((t for t in rows if t["id"] == child["id"]), None)
        assert found is not None
        assert found.get("parent_id") == parent_id

        # cleanup
        auth.delete(f"{BASE_URL}/api/transactions/{child['id']}")
        auth.delete(f"{BASE_URL}/api/transactions/{parent_id}")


# ---------- Attachment endpoints (drag-drop target) ----------
class TestAttachmentEndpoints:
    def _upload(self, token, module, row_id):
        url = f"{BASE_URL}/api/{module}/{row_id}/attachments"
        files = {"file": ("v216_drop.txt", io.BytesIO(b"hello v216"), "text/plain")}
        headers = {"Authorization": f"Bearer {token}"}
        return requests.post(url, files=files, headers=headers, timeout=15)

    def test_task_attachment_upload(self, auth, token):
        r = auth.post(f"{BASE_URL}/api/tasks",
                      json={"task": "TEST_v216_task", "status": "To-Do"})
        assert r.status_code in (200, 201), r.text
        tid = r.json()["id"]
        try:
            up = self._upload(token, "tasks", tid)
            assert up.status_code in (200, 201), f"task attach failed: {up.status_code} {up.text}"
        finally:
            auth.delete(f"{BASE_URL}/api/tasks/{tid}")

    def test_routine_attachment_upload(self, auth, token):
        r = auth.post(f"{BASE_URL}/api/routines",
                      json={"group": "TEST_v216_r", "name": "r", "activity": "a",
                            "frequency": "Daily", "priority": "High"})
        assert r.status_code in (200, 201), r.text
        rid = r.json()["id"]
        try:
            up = self._upload(token, "routines", rid)
            assert up.status_code in (200, 201), f"routine attach failed: {up.status_code} {up.text}"
        finally:
            auth.delete(f"{BASE_URL}/api/routines/{rid}")

    def test_transaction_attachment_upload(self, auth, token):
        r = auth.post(f"{BASE_URL}/api/transactions",
                      json={"label": "TEST_v216_tx", "amount": 50.0,
                            "direction": "out", "category": "expense",
                            "date": "2026-01-15", "currency": "INR"})
        assert r.status_code in (200, 201), r.text
        txid = r.json()["id"]
        try:
            up = self._upload(token, "transactions", txid)
            assert up.status_code in (200, 201), f"tx attach failed: {up.status_code} {up.text}"
        finally:
            auth.delete(f"{BASE_URL}/api/transactions/{txid}")
