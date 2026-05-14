"""v2.10 backend tests:
- GET /api/cashflow/loan-summary aggregation
- POST/DELETE /api/tasks/{id}/attachments (incl. 4MB cap)
- TaskIn.parent_id + cascade delete on parent
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "karan@mindmatters.local"
PASSWORD = "changeme123"


# ──────── auth fixture ────────
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    if r.status_code != 200:
        # try signup once
        r2 = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={"first_name": "Karan", "email": EMAIL, "password": PASSWORD},
            timeout=20,
        )
        assert r2.status_code == 200, f"signup failed {r2.status_code} {r2.text}"
        return r2.json()["token"]
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def H(token):
    return {"Authorization": f"Bearer {token}"}


# ──────── loan summary ────────
class TestLoanSummary:
    def test_loan_summary_shape_and_emi(self, H):
        # Ensure at least one liability with rate+date+amount exists.
        # Iter_7 supposedly seeded an HDFC liability. If missing, create one.
        txs = requests.get(f"{BASE_URL}/api/transactions", headers=H, timeout=20).json()
        has_liab = any(
            t.get("category") == "liability" and (t.get("interest_rate") or t.get("emi") or t.get("repayment_date"))
            for t in txs
        )
        created_id = None
        if not has_liab:
            payload = {
                "name": "TEST_LOAN_HDFC",
                "vendor": "HDFC",
                "amount": 120000,
                "category": "liability",
                "date": "2024-02-15",
                "interest_rate": 9.5,
                "repayment_date": "2029-02-15",
                "emi": 2500,
            }
            r = requests.post(f"{BASE_URL}/api/transactions", headers=H, json=payload, timeout=20)
            assert r.status_code == 200, r.text
            created_id = r.json()["id"]

        r = requests.get(f"{BASE_URL}/api/cashflow/loan-summary", headers=H, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_monthly_emi" in data
        assert "active_loans" in data
        assert "next_repayment" in data
        assert isinstance(data["total_monthly_emi"], (int, float))
        assert isinstance(data["active_loans"], int)
        assert data["next_repayment"] is None or isinstance(data["next_repayment"], dict)
        assert data["active_loans"] >= 1, f"expected >=1 active loan, got {data}"
        assert data["total_monthly_emi"] > 0, f"expected total_emi>0, got {data}"

        if created_id:
            requests.delete(f"{BASE_URL}/api/transactions/{created_id}", headers=H, timeout=20)


# ──────── attachments ────────
class TestAttachments:
    def _create_task(self, H, label="TEST_ATT_TASK"):
        r = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=H,
            json={"task": label, "name": "test"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_upload_list_delete_attachment(self, H):
        tid = self._create_task(H, "TEST_ATT_TASK_1")
        try:
            files = {"file": ("hello.txt", io.BytesIO(b"hello world"), "text/plain")}
            r = requests.post(
                f"{BASE_URL}/api/tasks/{tid}/attachments",
                headers=H,
                files=files,
                timeout=30,
            )
            assert r.status_code == 200, r.text
            att = r.json()
            for k in ("id", "name", "mime", "size", "data_url"):
                assert k in att, f"missing {k} in {att}"
            assert att["name"] == "hello.txt"
            assert att["size"] == 11
            assert att["data_url"].startswith("data:text/plain;base64,")

            # GET /api/tasks confirms attachments array grew
            r2 = requests.get(f"{BASE_URL}/api/tasks", headers=H, timeout=20).json()
            t = next(x for x in r2 if x["id"] == tid)
            assert len(t.get("attachments") or []) == 1
            assert t["attachments"][0]["id"] == att["id"]

            # DELETE attachment
            r3 = requests.delete(
                f"{BASE_URL}/api/tasks/{tid}/attachments/{att['id']}",
                headers=H,
                timeout=20,
            )
            assert r3.status_code == 200
            r4 = requests.get(f"{BASE_URL}/api/tasks", headers=H, timeout=20).json()
            t2 = next(x for x in r4 if x["id"] == tid)
            assert len(t2.get("attachments") or []) == 0
        finally:
            requests.delete(f"{BASE_URL}/api/tasks/{tid}", headers=H, timeout=20)

    def test_attachment_5mb_returns_413(self, H):
        tid = self._create_task(H, "TEST_ATT_BIG")
        try:
            big = b"x" * (5 * 1024 * 1024)  # 5MB
            files = {"file": ("big.bin", io.BytesIO(big), "application/octet-stream")}
            r = requests.post(
                f"{BASE_URL}/api/tasks/{tid}/attachments",
                headers=H,
                files=files,
                timeout=60,
            )
            assert r.status_code == 413, f"expected 413, got {r.status_code} {r.text[:200]}"
        finally:
            requests.delete(f"{BASE_URL}/api/tasks/{tid}", headers=H, timeout=20)


# ──────── parent_id cascade ────────
class TestSubtasksCascade:
    def test_create_child_and_cascade_delete(self, H):
        # P1
        rp = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=H,
            json={"task": "TEST_PARENT", "name": "x"},
            timeout=20,
        )
        assert rp.status_code == 200, rp.text
        p1 = rp.json()

        # C1 directly with parent_id (TaskIn now exposes it)
        rc = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=H,
            json={"task": "TEST_CHILD", "name": "x", "parent_id": p1["id"]},
            timeout=20,
        )
        assert rc.status_code == 200, rc.text
        c1 = rc.json()
        assert c1.get("parent_id") == p1["id"], f"parent_id not persisted: {c1}"

        # confirm both in list
        all_tasks = requests.get(f"{BASE_URL}/api/tasks", headers=H, timeout=20).json()
        ids = {t["id"] for t in all_tasks}
        assert p1["id"] in ids and c1["id"] in ids

        # DELETE parent → child should cascade
        rd = requests.delete(f"{BASE_URL}/api/tasks/{p1['id']}", headers=H, timeout=20)
        assert rd.status_code == 200, rd.text

        all_tasks2 = requests.get(f"{BASE_URL}/api/tasks", headers=H, timeout=20).json()
        ids2 = {t["id"] for t in all_tasks2}
        assert p1["id"] not in ids2, "parent still present"
        assert c1["id"] not in ids2, f"child {c1['id']} not cascade-deleted"
