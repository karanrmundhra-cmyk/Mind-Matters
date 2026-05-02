"""v1.3 backend tests — Universal AI confirmation flow + Loans interest_type +
Investments tabs + Cash Flow duplicates + Invoice AI parse."""
import io
import os
import csv
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def auth():
    r = requests.post(f"{API}/auth/demo-login", json={"first_name": "Karan"}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    return {"Authorization": f"Bearer {tok}"}


# ───────────── /api/parse/bulk — task ─────────────
class TestParseBulkTask:
    def test_task_oneword_verb_titlecase_today(self, auth):
        r = requests.post(f"{API}/parse/bulk", headers=auth, timeout=60,
                          json={"text": "call brinda regarding bar unit repair", "kind": "task"})
        assert r.status_code == 200, r.text
        rows = r.json().get("rows", [])
        assert isinstance(rows, list) and len(rows) >= 1, f"no rows: {r.json()}"
        row = rows[0]
        # verb must be one word, title-cased
        verb = (row.get("task") or "").strip()
        assert verb and " " not in verb, f"task field not one-word: {verb!r}"
        assert verb[0].isupper(), f"task not title-cased: {verb!r}"
        # name title-cased
        if row.get("name"):
            assert row["name"][0].isupper(), f"name not title-cased: {row['name']!r}"
        # details title-cased proper-nouns (Bar Unit) — at minimum has 'Bar' and 'Unit' or generally Title-Case
        details = row.get("details") or ""
        assert details, "details missing"
        # auto-today
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert row.get("date") == today, f"expected today's date {today}, got {row.get('date')}"


# ───────────── /api/parse/bulk — loan ─────────────
class TestParseBulkLoan:
    def test_loan_flat_interest(self, auth):
        r = requests.post(f"{API}/parse/bulk", headers=auth, timeout=60,
                          json={"text": "loan given to ramesh 50000 with 1500 fixed interest", "kind": "loan"})
        assert r.status_code == 200
        rows = r.json().get("rows", [])
        assert rows, r.json()
        assert rows[0].get("interest_type") == "fixed", rows[0]

    def test_loan_percent_interest(self, auth):
        r = requests.post(f"{API}/parse/bulk", headers=auth, timeout=60,
                          json={"text": "loan given to suresh 100000 at 12% per annum", "kind": "loan"})
        assert r.status_code == 200
        rows = r.json().get("rows", [])
        assert rows, r.json()
        assert rows[0].get("interest_type") == "percent", rows[0]


# ───────────── /api/parse/bulk — investment vs insurance ─────────────
class TestParseBulkInvestment:
    def test_insurance_keyword_routing(self, auth):
        r = requests.post(f"{API}/parse/bulk", headers=auth, timeout=60,
                          json={"text": "LIC term policy 5000 for wife", "kind": "investment"})
        assert r.status_code == 200
        rows = r.json().get("rows", [])
        assert rows, r.json()
        row = rows[0]
        assert row.get("kind") == "insurance", f"expected insurance, got {row}"
        ins_for = (row.get("insured_for") or "").lower()
        assert "wife" in ins_for, f"insured_for not Wife: {row.get('insured_for')!r}"


# ───────────── /api/investments — kind & insured_for accepted ─────────────
class TestInvestmentsKindInsuredFor:
    def test_post_insurance_and_patch_kind(self, auth):
        # POST insurance
        r = requests.post(f"{API}/investments", headers=auth, timeout=30, json={
            "kind": "insurance", "type": "Insurance", "provider": "TEST_v13 LIC",
            "amount_invested": 12000, "insured_for": "Mother", "notes": "TEST_v13",
        })
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["kind"] == "insurance"
        assert inv["insured_for"] == "Mother"
        iid = inv["id"]
        # PATCH back to investment + clear insured_for
        r2 = requests.patch(f"{API}/investments/{iid}", headers=auth, timeout=30,
                            json={"kind": "investment", "insured_for": None})
        assert r2.status_code == 200, r2.text
        assert r2.json()["kind"] == "investment"
        # cleanup
        requests.delete(f"{API}/investments/{iid}", headers=auth, timeout=30)

    def test_summary_separates_counts(self, auth):
        # create 1 invest + 1 insurance
        r1 = requests.post(f"{API}/investments", headers=auth, timeout=30, json={
            "kind": "investment", "type": "FD", "provider": "TEST_v13 FD",
            "amount_invested": 5000, "notes": "TEST_v13"})
        r2 = requests.post(f"{API}/investments", headers=auth, timeout=30, json={
            "kind": "insurance", "type": "Insurance", "provider": "TEST_v13 LIC2",
            "amount_invested": 7000, "insured_for": "Self", "notes": "TEST_v13"})
        assert r1.status_code == 200 and r2.status_code == 200
        i1, i2 = r1.json()["id"], r2.json()["id"]
        try:
            s = requests.get(f"{API}/investments/summary", headers=auth, timeout=30).json()
            for k in ("total_invested", "total_insurance", "investments_count", "insurance_count"):
                assert k in s, f"summary missing {k}: {s}"
            assert s["investments_count"] >= 1
            assert s["insurance_count"] >= 1
        finally:
            requests.delete(f"{API}/investments/{i1}", headers=auth, timeout=30)
            requests.delete(f"{API}/investments/{i2}", headers=auth, timeout=30)


# ───────────── /api/transactions/upload — duplicates ─────────────
class TestTransactionsUploadDuplicates:
    def _csv(self, rows):
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        w.writeheader()
        for r in rows:
            w.writerow(r)
        return buf.getvalue().encode("utf-8")

    def test_skip_duplicates_returns_pending(self, auth):
        rows = [{"date": "2025-12-15", "amount": "1234.56",
                 "company": "TEST_v13_DupCo", "expense_head": "Food",
                 "mode": "UPI", "direction": "out", "notes": ""}]
        csv_bytes = self._csv(rows)
        # 1st upload — should insert
        files = {"file": ("test.csv", csv_bytes, "text/csv")}
        data = {"account": "Personal", "skip_duplicates": "true"}
        r1 = requests.post(f"{API}/transactions/upload", headers=auth,
                           files=files, data=data, timeout=120)
        assert r1.status_code == 200, r1.text
        first = r1.json()
        # 2nd upload — same row should appear in duplicates
        files = {"file": ("test.csv", csv_bytes, "text/csv")}
        r2 = requests.post(f"{API}/transactions/upload", headers=auth,
                           files=files, data=data, timeout=120)
        assert r2.status_code == 200, r2.text
        out = r2.json()
        assert "duplicates" in out and "duplicate_count" in out, out
        assert out["duplicate_count"] >= 1, f"expected duplicate, got {out}"
        assert isinstance(out["duplicates"], list) and len(out["duplicates"]) >= 1
        # cleanup the inserted txns
        all_tx = requests.get(f"{API}/transactions", headers=auth, timeout=30).json()
        for t in (all_tx if isinstance(all_tx, list) else []):
            if t.get("company") == "TEST_v13_DupCo":
                requests.delete(f"{API}/transactions/{t['id']}", headers=auth, timeout=30)


# ───────────── /api/parse/invoice ─────────────
class TestParseInvoice:
    def test_krm_huf_invoice_subset_keys(self, auth):
        text = ("Invoice for ABC Pvt Ltd, GSTIN 27AAAAA0000A1Z5, "
                "1 unit Wireless Mouse @ 600 each, GST 18%, today")
        r = requests.post(f"{API}/parse/invoice", headers=auth, timeout=60,
                          json={"template_id": "krm_huf_invoice", "text": text})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "data" in body, body
        data = body["data"]
        assert isinstance(data, dict)
        # fetch template required_fields
        tpls_resp = requests.get(f"{API}/documents/templates", headers=auth, timeout=30).json()
        tpls = tpls_resp["templates"] if isinstance(tpls_resp, dict) else tpls_resp
        assert isinstance(tpls, list)
        krm = next((t for t in tpls if t.get("id") == "krm_huf_invoice"), None)
        assert krm, "krm_huf_invoice template not found"
        required = {f.get("key") for f in (krm.get("required_fields") or []) if f.get("key")}
        for k in data.keys():
            assert k in required, f"key {k!r} not in template required_fields {required}"


# ───────────── /api/loans — interest_type & accrued ─────────────
class TestLoansInterestType:
    def test_loan_fixed_and_percent(self, auth):
        # fixed loan
        r1 = requests.post(f"{API}/loans", headers=auth, timeout=30, json={
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "name": "TEST_v13 Fixed", "amount": 50000, "interest": 1500,
            "interest_type": "fixed", "reason": "Test", "status": "Given",
        })
        assert r1.status_code == 200, r1.text
        l1 = r1.json()
        assert l1.get("interest_type") == "fixed"
        l1id = l1["id"]
        # percent loan
        r2 = requests.post(f"{API}/loans", headers=auth, timeout=30, json={
            "date": "2024-01-01",
            "name": "TEST_v13 Percent", "amount": 100000, "interest": 12,
            "interest_type": "percent", "reason": "Test", "status": "Given",
        })
        assert r2.status_code == 200, r2.text
        l2id = r2.json()["id"]
        try:
            lst = requests.get(f"{API}/loans", headers=auth, timeout=30).json()
            f_loan = next(l for l in lst if l["id"] == l1id)
            p_loan = next(l for l in lst if l["id"] == l2id)
            assert f_loan["interest_type"] == "fixed"
            assert p_loan["interest_type"] == "percent"
            # fixed accrued must equal flat amount (1500)
            assert abs(float(f_loan.get("accrued_interest", 0)) - 1500) < 1, f_loan
            # percent accrued must be > 0 (pro-rated for ~1+ year @12% on 100000 = ≥12000)
            assert float(p_loan.get("accrued_interest", 0)) >= 11000, p_loan
        finally:
            requests.delete(f"{API}/loans/{l1id}", headers=auth, timeout=30)
            requests.delete(f"{API}/loans/{l2id}", headers=auth, timeout=30)
