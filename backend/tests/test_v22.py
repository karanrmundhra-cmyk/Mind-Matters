"""
v22 backend tests — Mind Matters cluster covering:
  - Sections sub-headers (set `section` on task/routine/transaction via PATCH)
  - Per-module CSV/PDF exports (tasks, routines, cashflow, notes, reminders)
  - EMI/interest fields on transactions (POST + GET round-trip)
  - Telegram regex static validation for delete/complete/yes/no
  - Regression: parse/bulk for tasks
"""
import os
import re
import sys
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "karan@mindmatters.local"
PASSWORD = "changeme123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ───────────────────── Sections via PATCH ─────────────────────
class TestSections:
    def test_patch_task_section(self, H):
        # Find an existing task
        r = requests.get(f"{BASE_URL}/api/tasks", headers=H, timeout=20)
        assert r.status_code == 200
        tasks = r.json()
        if not tasks:
            pytest.skip("no tasks exist for user")
        tid = tasks[0]["id"]
        pr = requests.patch(
            f"{BASE_URL}/api/tasks/{tid}",
            headers=H,
            json={"section": "Today"},
            timeout=20,
        )
        assert pr.status_code == 200, pr.text
        assert pr.json().get("section") == "Today"
        # GET verify
        g = requests.get(f"{BASE_URL}/api/tasks", headers=H, timeout=20).json()
        match = [t for t in g if t["id"] == tid]
        assert match and match[0].get("section") == "Today"

    def test_patch_routine_section(self, H):
        r = requests.get(f"{BASE_URL}/api/routines", headers=H, timeout=20)
        assert r.status_code == 200
        routines = r.json()
        if not routines:
            pytest.skip("no routines exist for user")
        rid = routines[0]["id"]
        pr = requests.patch(
            f"{BASE_URL}/api/routines/{rid}",
            headers=H,
            json={"section": "Morning"},
            timeout=20,
        )
        assert pr.status_code == 200, pr.text
        assert pr.json().get("section") == "Morning"

    def test_patch_transaction_section(self, H):
        # create a tx so we have something to patch
        cr = requests.post(
            f"{BASE_URL}/api/transactions",
            headers=H,
            json={"category": "expense", "amount": 99, "vendor": "TEST_SEC_TX",
                  "details": "section test", "head": "Misc"},
            timeout=20,
        )
        assert cr.status_code == 200, cr.text
        tx = cr.json()
        tid = tx["id"]
        try:
            pr = requests.patch(
                f"{BASE_URL}/api/transactions/{tid}",
                headers=H,
                json={"section": "Daily"},
                timeout=20,
            )
            assert pr.status_code == 200, pr.text
            assert pr.json().get("section") == "Daily"
        finally:
            requests.delete(f"{BASE_URL}/api/transactions/{tid}", headers=H, timeout=20)


# ───────────────────── Per-module exports ─────────────────────
class TestExportsCSV:
    @pytest.mark.parametrize("module,first_headers", [
        ("tasks", ["Sr", "Date", "Group", "Section"]),
        ("routines", ["Sr", "Group", "Section"]),
        ("cashflow", ["Sr", "Date", "Group", "Section"]),
        ("notes", ["Title", "Body", "Tags"]),
        ("reminders", ["Title", "Notes", "Fire at"]),
    ])
    def test_csv_export(self, H, module, first_headers):
        r = requests.get(f"{BASE_URL}/api/export/{module}.csv",
                         headers={"Authorization": H["Authorization"]}, timeout=30)
        assert r.status_code == 200, f"{module}.csv → {r.status_code} {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "text/csv" in ct or "csv" in ct, f"unexpected ct: {ct}"
        first_line = r.text.splitlines()[0]
        for h in first_headers:
            assert h in first_line, f"missing header '{h}' in {module}.csv: {first_line}"


class TestExportsPDF:
    @pytest.mark.parametrize("module", ["tasks", "routines", "cashflow", "notes", "reminders"])
    def test_pdf_export(self, H, module):
        r = requests.get(f"{BASE_URL}/api/export/{module}.pdf",
                         headers={"Authorization": H["Authorization"]}, timeout=60)
        assert r.status_code == 200, f"{module}.pdf → {r.status_code} {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "application/pdf" in ct, f"unexpected ct for {module}: {ct}"
        assert len(r.content) > 200, f"PDF body too small for {module}: {len(r.content)} bytes"
        assert r.content[:4] == b"%PDF", f"not a PDF magic for {module}"


# ───────────────────── EMI / interest on transactions ─────────────────────
class TestEMITransaction:
    def test_create_with_emi_and_fetch(self, H):
        payload = {
            "category": "liability",
            "amount": 120000,
            "interest_rate": 9.5,
            "repayment_date": "2029-02-15",
            "emi": 2500,
            "vendor": "TEST_EMI_BANK",
            "details": "test loan",
            "head": "Loan",
        }
        cr = requests.post(f"{BASE_URL}/api/transactions", headers=H, json=payload, timeout=20)
        assert cr.status_code == 200, cr.text
        tx = cr.json()
        tid = tx["id"]
        try:
            assert tx.get("interest_rate") == 9.5
            assert tx.get("repayment_date") == "2029-02-15"
            assert tx.get("emi") == 2500
            assert tx.get("category") == "liability"

            # GET list and find row
            gr = requests.get(f"{BASE_URL}/api/transactions", headers=H, timeout=20)
            assert gr.status_code == 200
            rows = gr.json()
            mine = [r for r in rows if r["id"] == tid]
            assert mine, "created EMI tx not in list"
            row = mine[0]
            assert row.get("interest_rate") == 9.5
            assert row.get("repayment_date") == "2029-02-15"
            assert row.get("emi") == 2500
        finally:
            requests.delete(f"{BASE_URL}/api/transactions/{tid}", headers=H, timeout=20)


# ───────────────────── Telegram regex static validation ─────────────────────
class TestTelegramRegex:
    def test_delete_regex(self):
        pat = re.compile(
            r"^\s*(?:delete|remove|drop)\s+(task|routine|expense|transaction)\s*#?(\d+)\s*$"
        )
        cases = {
            "delete task 3": ("task", "3"),
            "delete task #5": ("task", "5"),
            "delete routine 7": ("routine", "7"),
            "remove expense 2": ("expense", "2"),
            "drop transaction #99": ("transaction", "99"),
        }
        for text, expected in cases.items():
            m = pat.match(text.lower())
            assert m, f"regex failed to match: {text}"
            assert (m.group(1), m.group(2)) == expected
        # negative
        assert not pat.match("delete something 5")

    def test_complete_regex(self):
        pat = re.compile(
            r"^\s*(?:complete|finish|done|mark)\s+(?:task\s+)?#?(\d+)\s*(?:done|complete|finished)?\s*$"
        )
        for txt, expected_n in [
            ("complete task 5", "5"),
            ("complete 5", "5"),
            ("finish task #12", "12"),
            ("done 3", "3"),
            ("mark task 7 done", "7"),
        ]:
            m = pat.match(txt.lower())
            assert m, f"complete regex failed: {txt}"
            assert m.group(1) == expected_n

    def test_yes_no_tokens(self):
        yes_set = {"yes", "y", "ok", "confirm", "go", "sure", "save"}
        no_set = {"no", "n", "cancel", "discard", "skip", "nope"}
        for v in ["yes", "Y", " OK ", "Confirm"]:
            assert v.strip().lower() in yes_set
        for v in ["No", "n", "CANCEL", "nope"]:
            assert v.strip().lower() in no_set

    def test_tg_module_imports(self):
        # ensure tg.py file exists and contains the expected regex strings
        with open("/app/backend/tg.py", "r") as f:
            src = f.read()
        assert "delete|remove|drop" in src
        assert "complete|finish|done|mark" in src
        assert "_latest_pending_for_chat" in src
        assert "_execute_pending" in src


# ───────────────────── Regression ─────────────────────
class TestRegression:
    def test_parse_bulk_task(self, H):
        r = requests.post(
            f"{BASE_URL}/api/parse/bulk",
            headers=H,
            json={"kind": "task", "text": "follow up Brinda tomorrow #Personal"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # response is usually {"rows": [...]} or list — accept either
        rows = data.get("rows") if isinstance(data, dict) else data
        assert rows, f"empty parse rows: {data}"
        assert isinstance(rows, list) and len(rows) >= 1

    def test_login_works(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            timeout=30,
        )
        assert r.status_code == 200
        assert "token" in r.json()
