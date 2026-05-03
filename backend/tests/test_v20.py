"""v2.0 backend tests — Email/password auth, quote, affirmations,
groups, reorder, transactions new fields, loans/investments wipe,
reminder source_page."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

SEEDED_EMAIL = "karan@mindmatters.local"
SEEDED_PW = "changeme123"


@pytest.fixture(scope="session")
def auth():
    r = requests.post(f"{API}/auth/login", json={"email": SEEDED_EMAIL, "password": SEEDED_PW}, timeout=30)
    assert r.status_code == 200, f"seeded login failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    return {"Authorization": f"Bearer {tok}"}


# ───────── auth ─────────
class TestAuth:
    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": SEEDED_EMAIL, "password": "wrong_pw_xxx"}, timeout=30)
        assert r.status_code == 401, r.text

    def test_signup_short_password(self):
        r = requests.post(f"{API}/auth/signup",
                          json={"first_name": "X", "email": f"test_{uuid.uuid4().hex[:6]}@t.io", "password": "abc"},
                          timeout=30)
        assert r.status_code == 400, r.text

    def test_signup_then_login_roundtrip(self):
        email = f"test_v20_{uuid.uuid4().hex[:8]}@t.io"
        r = requests.post(f"{API}/auth/signup",
                          json={"first_name": "TestV20", "email": email, "password": "secret123"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and "user" in body
        assert body["user"]["email"] == email
        # login again
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "secret123"}, timeout=30)
        assert r2.status_code == 200

    def test_signup_duplicate_rejected(self):
        r = requests.post(f"{API}/auth/signup",
                          json={"first_name": "Karan", "email": SEEDED_EMAIL, "password": "changeme123"},
                          timeout=30)
        # already has password_hash → must reject
        assert r.status_code == 400, r.text


# ───────── quote ─────────
class TestQuote:
    def test_quote_today(self):
        r = requests.get(f"{API}/quote/today", timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert "text" in b and "author" in b
        assert isinstance(b["text"], str) and len(b["text"]) > 0


# ───────── affirmations ─────────
class TestAffirmations:
    def test_get_and_put_personal_fixed(self, auth):
        r = requests.get(f"{API}/affirmations/today", headers=auth, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "personal_fixed" in body
        # set personal_fixed
        val = f"TEST_v20 I am calm. {uuid.uuid4().hex[:4]}"
        r2 = requests.put(f"{API}/affirmations/today", headers=auth,
                          json={"personal_fixed": val}, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["personal_fixed"] == val
        # GET reflects it
        r3 = requests.get(f"{API}/affirmations/today", headers=auth, timeout=15).json()
        assert r3["personal_fixed"] == val


# ───────── tasks: group + reorder ─────────
class TestTasksGroup:
    def test_task_accepts_group_and_reorder(self, auth):
        ids = []
        try:
            for i in range(3):
                r = requests.post(f"{API}/tasks", headers=auth, timeout=15, json={
                    "task": f"TEST_v20_task_{i}", "name": "Tester", "group": "TEST_v20_Group_A"
                })
                assert r.status_code == 200, r.text
                assert r.json()["group"] == "TEST_v20_Group_A"
                ids.append(r.json()["id"])
            # reorder — reverse
            r2 = requests.post(f"{API}/tasks/reorder", headers=auth,
                               json={"ids": list(reversed(ids))}, timeout=15)
            assert r2.status_code == 200, r2.text
            # verify order_index
            lst = requests.get(f"{API}/tasks", headers=auth, timeout=15).json()
            by_id = {t["id"]: t for t in lst}
            reversed_ids = list(reversed(ids))
            for idx, tid in enumerate(reversed_ids):
                assert by_id[tid]["order_index"] == idx, by_id[tid]
            # PATCH group
            r3 = requests.patch(f"{API}/tasks/{ids[0]}", headers=auth,
                                json={"group": "TEST_v20_Group_B"}, timeout=15)
            assert r3.status_code == 200
            assert r3.json()["group"] == "TEST_v20_Group_B"
            # groups endpoint
            g = requests.get(f"{API}/groups/tasks", headers=auth, timeout=15).json()
            assert "groups" in g
            assert "TEST_v20_Group_A" in g["groups"] or "TEST_v20_Group_B" in g["groups"]
        finally:
            for tid in ids:
                requests.delete(f"{API}/tasks/{tid}", headers=auth, timeout=15)


# ───────── routines: group + reorder ─────────
class TestRoutinesGroup:
    def test_routine_group_custom_frequency_reorder(self, auth):
        ids = []
        try:
            for i in range(2):
                r = requests.post(f"{API}/routines", headers=auth, timeout=15, json={
                    "activity": f"TEST_v20_routine_{i}", "group": "TEST_v20_MorningGrp",
                    "frequency": "4 Hours Focus"
                })
                assert r.status_code == 200, r.text
                b = r.json()
                assert b["group"] == "TEST_v20_MorningGrp"
                assert b["frequency"] == "4 Hours Focus"
                ids.append(b["id"])
            # reorder
            r2 = requests.post(f"{API}/routines/reorder", headers=auth,
                               json={"ids": list(reversed(ids))}, timeout=15)
            assert r2.status_code == 200
            # groups
            g = requests.get(f"{API}/groups/routines", headers=auth, timeout=15).json()
            assert "TEST_v20_MorningGrp" in g["groups"]
        finally:
            for rid in ids:
                requests.delete(f"{API}/routines/{rid}", headers=auth, timeout=15)


# ───────── transactions: new fields + reorder ─────────
class TestTransactionsV20:
    def test_tx_with_new_fields_and_reorder(self, auth):
        ids = []
        try:
            for cat in ["income", "expense", "asset", "liability"]:
                r = requests.post(f"{API}/transactions", headers=auth, timeout=15, json={
                    "amount": 100, "category": cat, "group": "TEST_v20_CFGrp",
                    "name": f"Entity_{cat}", "details": f"details_{cat}",
                    "remarks": "note", "head": "TestHead"
                })
                assert r.status_code == 200, r.text
                b = r.json()
                assert b["category"] == cat
                assert b["group"] == "TEST_v20_CFGrp"
                assert b["name"] == f"Entity_{cat}"
                assert b["details"] == f"details_{cat}"
                assert b["remarks"] == "note"
                assert b["head"] == "TestHead"
                ids.append(b["id"])
            # PATCH preserves new fields
            r2 = requests.patch(f"{API}/transactions/{ids[0]}", headers=auth,
                                json={"remarks": "updated_remarks", "group": "TEST_v20_CFGrp2"}, timeout=15)
            assert r2.status_code == 200
            assert r2.json()["remarks"] == "updated_remarks"
            assert r2.json()["group"] == "TEST_v20_CFGrp2"
            # reorder
            r3 = requests.post(f"{API}/transactions/reorder", headers=auth,
                               json={"ids": ids}, timeout=15)
            assert r3.status_code == 200
            # groups endpoint
            g = requests.get(f"{API}/groups/transactions", headers=auth, timeout=15).json()
            assert "TEST_v20_CFGrp" in g["groups"] or "TEST_v20_CFGrp2" in g["groups"]
        finally:
            for tid in ids:
                requests.delete(f"{API}/transactions/{tid}", headers=auth, timeout=15)


# ───────── loans + investments wiped ─────────
class TestLoansInvestmentsWipe:
    def test_loans_empty_after_startup(self, auth):
        r = requests.get(f"{API}/loans", headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json() == [], f"loans should be [] after startup wipe, got {r.json()}"

    def test_investments_empty_after_startup(self, auth):
        r = requests.get(f"{API}/investments", headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json() == [], f"investments should be [] after startup wipe, got {r.json()}"


# ───────── reminders source_page + source_context ─────────
class TestRemindersSource:
    def test_reminder_with_source(self, auth):
        src_ctx = {"task": "Call Brinda", "details": "repair", "name": "Brinda"}
        r = requests.post(f"{API}/reminders", headers=auth, timeout=15, json={
            "title": "TEST_v20 Reminder",
            "fire_at": "2099-01-01T10:00:00+00:00",
            "source_page": "tasks",
            "source_context": src_ctx,
        })
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["source_page"] == "tasks"
        assert b["source_context"] == src_ctx
        rid = b["id"]
        # GET preserves
        lst = requests.get(f"{API}/reminders", headers=auth, timeout=15).json()
        rem = next((x for x in lst if x["id"] == rid), None)
        assert rem is not None
        assert rem["source_page"] == "tasks"
        assert rem["source_context"] == src_ctx
        requests.delete(f"{API}/reminders/{rid}", headers=auth, timeout=15)


# ───────── reorder unsupported ─────────
class TestReorderGuards:
    def test_unsupported_resource_400(self, auth):
        r = requests.post(f"{API}/notes/reorder", headers=auth,
                          json={"ids": ["x"]}, timeout=15)
        assert r.status_code == 400
