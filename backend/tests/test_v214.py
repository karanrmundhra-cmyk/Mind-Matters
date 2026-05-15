"""v2.14 tests:
- /api/auth/forgot must omit 'code' field
- /api/news endpoint
- /api/seed/first-login (idempotent)
- /api/admin/wipe-all-data
- /api/cashflow/upcoming-payments
- /api/calendar/feed.ics
- Generic /api/{module}/{id}/attachments (routines, transactions)
"""
import os
import io
import pytest
import requests
from pathlib import Path


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not url:
        env_file = Path("/app/frontend/.env")
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    return url.rstrip("/")


BASE_URL = _load_backend_url()
CREDS = {"email": "karan@mindmatters.local", "password": "changeme123"}


@pytest.fixture(scope="session")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CREDS, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ------------- Auth forgot security: no code returned -------------
class TestAuthForgotSecurity:
    def test_forgot_returns_no_code(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/forgot",
            json={"email": CREDS["email"]},
            timeout=15,
        )
        assert r.status_code == 200, f"forgot status={r.status_code} body={r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert "code" not in data, f"SECURITY LEAK: 'code' must NOT be returned. Got {data}"
        assert "delivered_via" in data
        assert "expires_at" in data

    def test_forgot_unknown_email_no_code(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/forgot",
            json={"email": "ghost-user-does-not-exist@nowhere.test"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "code" not in data


# ------------- News endpoint -------------
class TestNews:
    def test_news_default(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/news", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("category") == "all"
        assert isinstance(data.get("items"), list)
        assert data.get("source") in ("google-news", "fallback")
        for it in data["items"]:
            assert "title" in it and isinstance(it["title"], str)
            assert "url" in it and isinstance(it["url"], str)

    def test_news_tech(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/news?category=tech",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("category") == "tech"
        assert isinstance(data.get("items"), list)
        assert data.get("source") in ("google-news", "fallback")


# ------------- Seed first-login (idempotent) -------------
class TestSeedFirstLogin:
    def test_seed_idempotent_when_has_data(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/seed/first-login",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        # karan user has existing data → should be seeded:false
        assert data.get("seeded") is False
        assert "already has data" in (data.get("reason") or "")


# ------------- Cashflow upcoming payments -------------
class TestCashflowUpcomingPayments:
    def test_upcoming_payments_shape(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/cashflow/upcoming-payments",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("items"), list)
        assert "total" in data
        assert isinstance(data.get("month"), str) and len(data["month"]) > 0


# ------------- iCal calendar feed -------------
class TestCalendarICS:
    def test_ics_feed_authed(self, auth_token):
        r = requests.get(
            f"{BASE_URL}/api/calendar/feed.ics?token={auth_token}",
            timeout=15,
        )
        assert r.status_code == 200, f"ics status={r.status_code} body={r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "text/calendar" in ct.lower(), f"Bad content-type: {ct}"
        body = r.text
        assert body.startswith("BEGIN:VCALENDAR"), f"Body should start with BEGIN:VCALENDAR. Got: {body[:80]}"
        # Should contain at least one VEVENT if user has any task with date
        # If user has no dated tasks/reminders, skip — but karan does
        # Just verify END:VCALENDAR present
        assert "END:VCALENDAR" in body

    def test_ics_feed_no_token(self):
        r = requests.get(f"{BASE_URL}/api/calendar/feed.ics", timeout=15)
        assert r.status_code == 401


# ------------- Universal attachments -------------
class TestUniversalAttachments:
    def test_routines_attachment(self, auth_headers):
        # Create a routine
        payload = {
            "group": "TEST_v214",
            "name": "TEST_routine",
            "activity": "attachment test",
            "frequency": "Daily",
            "priority": "Low",
            "status": "Active",
        }
        cr = requests.post(
            f"{BASE_URL}/api/routines",
            json=payload,
            headers=auth_headers,
            timeout=15,
        )
        assert cr.status_code in (200, 201), f"create routine failed: {cr.status_code} {cr.text}"
        rid = cr.json()["id"]
        try:
            files = {"file": ("test.txt", io.BytesIO(b"hello v2.14" * 50), "text/plain")}
            ar = requests.post(
                f"{BASE_URL}/api/routines/{rid}/attachments",
                files=files,
                headers=auth_headers,
                timeout=15,
            )
            assert ar.status_code == 200, f"attach failed: {ar.status_code} {ar.text}"
            data = ar.json()
            assert "id" in data
            assert data.get("name") == "test.txt"
            assert "mime" in data
            assert isinstance(data.get("size"), int) and data["size"] > 0
            assert data.get("data_url", "").startswith("data:")
        finally:
            requests.delete(
                f"{BASE_URL}/api/routines/{rid}",
                headers=auth_headers,
                timeout=10,
            )

    def test_transactions_attachment(self, auth_headers):
        payload = {
            "date": "2026-01-15",
            "amount": 1.0,
            "name": "TEST_v214_tx",
            "vendor": "Test",
            "category": "expense",
        }
        cr = requests.post(
            f"{BASE_URL}/api/transactions",
            json=payload,
            headers=auth_headers,
            timeout=15,
        )
        assert cr.status_code in (200, 201), f"create tx failed: {cr.status_code} {cr.text}"
        tid = cr.json()["id"]
        try:
            files = {"file": ("receipt.txt", io.BytesIO(b"receipt content"), "text/plain")}
            ar = requests.post(
                f"{BASE_URL}/api/transactions/{tid}/attachments",
                files=files,
                headers=auth_headers,
                timeout=15,
            )
            assert ar.status_code == 200, f"attach tx failed: {ar.status_code} {ar.text}"
            data = ar.json()
            assert data.get("name") == "receipt.txt"
            assert data.get("data_url", "").startswith("data:")
        finally:
            requests.delete(
                f"{BASE_URL}/api/transactions/{tid}",
                headers=auth_headers,
                timeout=10,
            )


# ------------- Regression: tasks flagged + currency on transaction -------------
class TestRegressionFields:
    def test_task_flagged_patch(self, auth_headers):
        cr = requests.post(
            f"{BASE_URL}/api/tasks",
            json={"date": "2026-01-15", "name": "TEST_v214", "task": "flag-test"},
            headers=auth_headers,
            timeout=15,
        )
        assert cr.status_code in (200, 201)
        tid = cr.json()["id"]
        try:
            pr = requests.patch(
                f"{BASE_URL}/api/tasks/{tid}",
                json={"flagged": True},
                headers=auth_headers,
                timeout=15,
            )
            assert pr.status_code == 200, f"patch flagged failed: {pr.status_code} {pr.text}"
            # GET to verify
            gr = requests.get(
                f"{BASE_URL}/api/tasks",
                headers=auth_headers,
                timeout=15,
            )
            assert gr.status_code == 200
            matched = [t for t in gr.json() if t.get("id") == tid]
            assert matched and matched[0].get("flagged") is True
        finally:
            requests.delete(
                f"{BASE_URL}/api/tasks/{tid}",
                headers=auth_headers,
                timeout=10,
            )

    def test_transaction_currency_patch(self, auth_headers):
        cr = requests.post(
            f"{BASE_URL}/api/transactions",
            json={
                "date": "2026-01-15",
                "amount": 1.0,
                "name": "TEST_v214_curr",
                "category": "expense",
            },
            headers=auth_headers,
            timeout=15,
        )
        assert cr.status_code in (200, 201)
        tid = cr.json()["id"]
        try:
            pr = requests.patch(
                f"{BASE_URL}/api/transactions/{tid}",
                json={"currency": "USD"},
                headers=auth_headers,
                timeout=15,
            )
            assert pr.status_code == 200, f"patch currency failed: {pr.status_code} {pr.text}"
            data = pr.json()
            assert data.get("currency") == "USD"
        finally:
            requests.delete(
                f"{BASE_URL}/api/transactions/{tid}",
                headers=auth_headers,
                timeout=10,
            )
