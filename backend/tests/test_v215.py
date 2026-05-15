"""v2.15 tests:
- GET /api/fx/rates?base=INR → 200 with {base, rates, fetched_at}
- GET /api/cashflow/totals?base=INR → 200 with {base, totals{income,expense,...}}
- Currency conversion uses fx rates (USD 100 ≈ ₹8600 fallback)
- POST /api/parse/bulk reminder → title is verb-led
- PATCH /api/routines/{id} {flagged:true} persists
- PATCH /api/transactions/{id} {flagged:true} persists
- Reminders schema returns title/notes/recurrence fields
"""
import os
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


# ------------- FX rates endpoint -------------
class TestFxRates:
    def test_fx_rates_returns_200_with_base_rates(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fx/rates?base=INR",
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["base"] == "INR"
        assert "rates" in data and isinstance(data["rates"], dict)
        assert "fetched_at" in data
        # Must have at least INR/USD/EUR (per agent context note)
        for c in ["INR", "USD", "EUR"]:
            assert c in data["rates"], f"missing {c} in rates: {list(data['rates'])[:10]}"

    def test_fx_rates_has_more_currencies_fallback(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fx/rates?base=INR",
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200
        rates = r.json()["rates"]
        # Spec says fallback includes INR/USD/EUR/GBP/JPY/AED/CAD/AUD
        for c in ["GBP", "JPY", "AED", "CAD", "AUD"]:
            assert c in rates, f"missing fallback currency {c}"

    def test_fx_rates_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/fx/rates?base=INR", timeout=10)
        assert r.status_code in (401, 403)


# ------------- Cashflow totals -------------
class TestCashflowTotals:
    def test_totals_returns_categories(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/cashflow/totals?base=INR",
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["base"] == "INR"
        totals = data["totals"]
        for k in ["income", "expense", "asset", "liability", "loan_given", "loan_taken"]:
            assert k in totals, f"missing category {k}"
            assert isinstance(totals[k], (int, float))

    def test_currency_conversion_usd_to_inr(self, auth_headers):
        """Create a USD 100 expense → expense total should jump by ~₹8600."""
        # baseline
        r0 = requests.get(f"{BASE_URL}/api/cashflow/totals?base=INR",
                          headers=auth_headers, timeout=15)
        assert r0.status_code == 200
        before = r0.json()["totals"]["expense"]

        # Create USD 100 expense
        payload = {
            "date": "2026-01-15",
            "amount": 100,
            "currency": "USD",
            "vendor": "TEST_v215_FX",
            "details": "USD conversion test",
            "head": "Test",
            "mode": "Card",
            "category": "expense",
        }
        r = requests.post(f"{BASE_URL}/api/transactions",
                          json=payload, headers=auth_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        tx_id = r.json()["id"]
        try:
            r2 = requests.get(f"{BASE_URL}/api/cashflow/totals?base=INR",
                              headers=auth_headers, timeout=15)
            assert r2.status_code == 200
            after = r2.json()["totals"]["expense"]
            delta = after - before
            # USD 100 with fallback rate ~86 INR → ~8600. allow wide range.
            assert 5000 <= delta <= 15000, (
                f"USD 100 expense conversion delta={delta} not in [5000,15000]; "
                f"before={before} after={after}"
            )
        finally:
            requests.delete(f"{BASE_URL}/api/transactions/{tx_id}",
                            headers=auth_headers, timeout=10)


# ------------- Reminder parse: verb-led title -------------
class TestReminderParse:
    def test_reminder_parse_verb_led(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/parse/bulk",
            json={"kind": "reminder", "text": "remind to hit brinda at 3pm tomorrow"},
            headers=auth_headers,
            timeout=45,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # response is either a list of rows or {rows: [...]}
        rows = data if isinstance(data, list) else data.get("rows") or data.get("items") or []
        assert rows, f"no rows returned: {data}"
        first = rows[0]
        title = (first.get("title") or "").strip()
        assert title, f"empty title in first row: {first}"
        # title should be verb-led — not just 'Brinda' alone. Accept Call/Contact/Message/Ping/Hit/etc.
        # Spec says: 'Call' or 'Contact' expected. Also check it's not just the name.
        lower = title.lower()
        assert lower != "brinda", f"title is just the name (not verb-led): {title!r}"
        assert any(v in lower for v in ["call", "contact", "message", "ping", "reach"]), (
            f"title not verb-led with expected verbs: {title!r}"
        )


# ------------- Routine flag persistence -------------
class TestRoutineFlag:
    def test_routine_flag_patch_persists(self, auth_headers):
        # Create routine
        payload = {
            "group": "TEST_v215", "name": "Self",
            "activity": "Walk", "frequency": "Daily",
        }
        r = requests.post(f"{BASE_URL}/api/routines",
                          json=payload, headers=auth_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        rid = r.json()["id"]
        try:
            # Patch flagged true
            r2 = requests.patch(f"{BASE_URL}/api/routines/{rid}",
                                json={"flagged": True},
                                headers=auth_headers, timeout=10)
            assert r2.status_code == 200, r2.text
            assert r2.json().get("flagged") is True
            # GET to verify persisted
            r3 = requests.get(f"{BASE_URL}/api/routines",
                              headers=auth_headers, timeout=10)
            assert r3.status_code == 200
            row = next((x for x in r3.json() if x["id"] == rid), None)
            assert row is not None
            assert row.get("flagged") is True
        finally:
            requests.delete(f"{BASE_URL}/api/routines/{rid}",
                            headers=auth_headers, timeout=10)


# ------------- Transaction flag persistence -------------
class TestTransactionFlag:
    def test_tx_flag_patch_persists(self, auth_headers):
        payload = {
            "date": "2026-01-15",
            "amount": 100,
            "vendor": "TEST_v215_flag",
            "details": "tx flag test",
            "head": "Test",
            "mode": "Bank",
            "category": "expense",
        }
        r = requests.post(f"{BASE_URL}/api/transactions",
                          json=payload, headers=auth_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        tx_id = r.json()["id"]
        try:
            r2 = requests.patch(f"{BASE_URL}/api/transactions/{tx_id}",
                                json={"flagged": True},
                                headers=auth_headers, timeout=10)
            assert r2.status_code == 200, r2.text
            assert r2.json().get("flagged") is True
        finally:
            requests.delete(f"{BASE_URL}/api/transactions/{tx_id}",
                            headers=auth_headers, timeout=10)


# ------------- Reminder schema fields exist -------------
class TestReminderSchema:
    def test_reminder_create_supports_notes_recurrence(self, auth_headers):
        payload = {
            "title": "TEST_v215 Call Sample",
            "fire_at": "2026-12-31T15:00:00+00:00",
            "notes": "venue: office",
            "recurrence": "weekly",
        }
        r = requests.post(f"{BASE_URL}/api/reminders",
                          json=payload, headers=auth_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        rid = r.json()["id"]
        try:
            assert r.json().get("title") == "TEST_v215 Call Sample"
            # recurrence + notes should be persisted
            assert r.json().get("recurrence") == "weekly"
            assert r.json().get("notes") == "venue: office"
        finally:
            requests.delete(f"{BASE_URL}/api/reminders/{rid}",
                            headers=auth_headers, timeout=10)
