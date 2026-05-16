"""v2.24 backend regression tests.

Covers:
  * Attachment size cap (5 MB / file, 10 MB total / row) on /tasks/{id}/attachments
    and the universal /{module}/{rid}/attachments endpoint.
  * Filtered export — /export/{module}.csv|.pdf with ?ids=
  * Reminder resend with explicit fire_at.
"""
import io
import os
import time
import uuid

import pytest
import requests

def _resolve_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    # Fallback: read /app/frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _resolve_base_url()
CREDS = {"email": "karan@mindmatters.local", "password": "changeme123"}


@pytest.fixture(scope="module")
def token() -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CREDS, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ───────────────────── helpers ─────────────────────
def _mk_task(headers, title):
    r = requests.post(
        f"{BASE_URL}/api/tasks",
        json={"name": title, "task": title, "status": "Pending", "date": "2026-01-15"},
        headers=headers, timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


def _mk_routine(headers, title):
    r = requests.post(
        f"{BASE_URL}/api/routines",
        json={"name": title, "activity": title, "frequency": "Daily",
              "priority": "Medium", "status": "Active"},
        headers=headers, timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


def _mk_txn(headers, title):
    r = requests.post(
        f"{BASE_URL}/api/transactions",
        json={"name": title, "amount": 100, "category": "Expense",
              "mode": "Cash", "date": "2026-01-15"},
        headers=headers, timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


def _bytes(n):
    # Distinct content so server stores all bytes
    return os.urandom(n)


# ───────────────────── ATTACHMENTS — /tasks/{id}/attachments ─────────────────────
class TestTaskAttachments:
    def test_under_5mb_file_accepted(self, auth_headers):
        task = _mk_task(auth_headers, f"TEST_v224_attach_small_{uuid.uuid4().hex[:6]}")
        small = _bytes(1 * 1024 * 1024)  # 1MB
        r = requests.post(
            f"{BASE_URL}/api/tasks/{task['id']}/attachments",
            files={"file": ("small.bin", io.BytesIO(small), "application/octet-stream")},
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get("size") == len(small)

    def test_over_5mb_file_rejected_413(self, auth_headers):
        task = _mk_task(auth_headers, f"TEST_v224_attach_big_{uuid.uuid4().hex[:6]}")
        big = _bytes(5 * 1024 * 1024 + 1024)  # 5MB + 1KB
        r = requests.post(
            f"{BASE_URL}/api/tasks/{task['id']}/attachments",
            files={"file": ("big.bin", io.BytesIO(big), "application/octet-stream")},
            headers=auth_headers, timeout=60,
        )
        assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text[:200]}"
        assert "5MB" in r.text or "5 MB" in r.text or "too large" in r.text.lower()

    def test_total_quota_10mb_enforced(self, auth_headers):
        task = _mk_task(auth_headers, f"TEST_v224_attach_quota_{uuid.uuid4().hex[:6]}")
        chunk = _bytes(4 * 1024 * 1024)  # 4MB chunks → 4+4+4 = 12 > 10
        for i in range(2):
            r = requests.post(
                f"{BASE_URL}/api/tasks/{task['id']}/attachments",
                files={"file": (f"c{i}.bin", io.BytesIO(chunk), "application/octet-stream")},
                headers=auth_headers, timeout=60,
            )
            assert r.status_code == 200, f"chunk {i}: {r.status_code} {r.text[:200]}"
        # 3rd 4MB chunk pushes past 10MB → expect 413
        r3 = requests.post(
            f"{BASE_URL}/api/tasks/{task['id']}/attachments",
            files={"file": ("c2.bin", io.BytesIO(chunk), "application/octet-stream")},
            headers=auth_headers, timeout=60,
        )
        assert r3.status_code == 413, f"expected 413, got {r3.status_code}: {r3.text[:200]}"
        assert "10" in r3.text  # mentions 10MB cap


# ───────────────────── ATTACHMENTS — /{module}/{rid}/attachments ─────────────────────
class TestUniversalAttachments:
    def test_routine_over_5mb_rejected(self, auth_headers):
        row = _mk_routine(auth_headers, f"TEST_v224_runi_{uuid.uuid4().hex[:6]}")
        big = _bytes(5 * 1024 * 1024 + 2048)
        r = requests.post(
            f"{BASE_URL}/api/routines/{row['id']}/attachments",
            files={"file": ("big.bin", io.BytesIO(big), "application/octet-stream")},
            headers=auth_headers, timeout=60,
        )
        assert r.status_code == 413

    def test_transaction_quota_enforced(self, auth_headers):
        row = _mk_txn(auth_headers, f"TEST_v224_tuni_{uuid.uuid4().hex[:6]}")
        chunk = _bytes(4 * 1024 * 1024)
        for i in range(2):
            r = requests.post(
                f"{BASE_URL}/api/transactions/{row['id']}/attachments",
                files={"file": (f"c{i}.bin", io.BytesIO(chunk), "application/octet-stream")},
                headers=auth_headers, timeout=60,
            )
            assert r.status_code == 200, f"chunk {i}: {r.status_code}"
        r3 = requests.post(
            f"{BASE_URL}/api/transactions/{row['id']}/attachments",
            files={"file": ("c2.bin", io.BytesIO(chunk), "application/octet-stream")},
            headers=auth_headers, timeout=60,
        )
        assert r3.status_code == 413


# ───────────────────── FILTERED EXPORT ─────────────────────
class TestFilteredExport:
    @pytest.fixture(scope="class")
    def seed_tasks(self, auth_headers):
        ids = []
        for i in range(3):
            t = _mk_task(auth_headers, f"TEST_v224_exp_{uuid.uuid4().hex[:6]}_{i}")
            ids.append(t["id"])
        return ids

    def test_tasks_csv_filtered_by_ids(self, auth_headers, seed_tasks):
        sel = seed_tasks[:2]
        r = requests.get(
            f"{BASE_URL}/api/export/tasks.csv?ids={','.join(sel)}",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "").lower()
        body = r.text
        # body has header row + data rows
        data_lines = [l for l in body.splitlines() if l.strip()][1:]
        assert len(data_lines) == 2, f"expected 2 data rows, got {len(data_lines)}: {body[:300]}"

    def test_tasks_csv_no_ids_returns_all(self, auth_headers, seed_tasks):
        r = requests.get(f"{BASE_URL}/api/export/tasks.csv", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data_lines = [l for l in r.text.splitlines() if l.strip()][1:]
        assert len(data_lines) >= 3  # at least our 3 seeded

    def test_tasks_pdf_filtered(self, auth_headers, seed_tasks):
        sel = seed_tasks[:1]
        r = requests.get(
            f"{BASE_URL}/api/export/tasks.pdf?ids={','.join(sel)}",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        assert "pdf" in r.headers.get("content-type", "").lower()
        assert r.content.startswith(b"%PDF"), "Response body is not a PDF"

    def test_cashflow_csv_filtered(self, auth_headers):
        txns = [_mk_txn(auth_headers, f"TEST_v224_cfexp_{uuid.uuid4().hex[:6]}_{i}") for i in range(2)]
        sel = [txns[0]["id"]]
        r = requests.get(
            f"{BASE_URL}/api/export/cashflow.csv?ids={sel[0]}",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        data_lines = [l for l in r.text.splitlines() if l.strip()][1:]
        assert len(data_lines) == 1, f"expected 1 row, got {len(data_lines)}"

    def test_routines_csv_filtered(self, auth_headers):
        rs = [_mk_routine(auth_headers, f"TEST_v224_rexp_{uuid.uuid4().hex[:6]}_{i}") for i in range(2)]
        sel = [rs[0]["id"], rs[1]["id"]]
        r = requests.get(
            f"{BASE_URL}/api/export/routines.csv?ids={','.join(sel)}",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        data_lines = [l for l in r.text.splitlines() if l.strip()][1:]
        assert len(data_lines) == 2


# ───────────────────── REMINDER RESEND ─────────────────────
class TestReminderResend:
    def test_resend_with_explicit_fire_at(self, auth_headers):
        # Create reminder
        r = requests.post(
            f"{BASE_URL}/api/reminders",
            json={"title": f"TEST_v224_rem_{uuid.uuid4().hex[:6]}",
                  "fire_at": "2026-01-15T10:00:00+00:00", "recurrence": "none"},
            headers=auth_headers, timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        orig = r.json()
        # Mark as sent (simulate)
        new_fire = "2026-03-01T14:30:00+00:00"
        r2 = requests.post(
            f"{BASE_URL}/api/reminders/{orig['id']}/resend",
            json={"fire_at": new_fire},
            headers=auth_headers, timeout=15,
        )
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body.get("sent") is False
        # fire_at should match the iso we sent (parse + compare)
        assert new_fire in body.get("fire_at", "") or body.get("fire_at", "").startswith("2026-03-01T14:30"), \
            f"fire_at mismatch: {body.get('fire_at')}"
        assert body.get("id") != orig["id"], "resend must create new reminder"
        assert body.get("title") == orig["title"]


# ───────────────────── REGRESSION SMOKE ─────────────────────
class TestSmoke:
    def test_auth_me(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_list_tasks(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_list_routines(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/routines", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_list_transactions(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_list_projects(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers, timeout=15)
        assert r.status_code == 200
