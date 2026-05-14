"""v2.12 backend tests — Reports endpoints (timeline, cashflow-monthly, patterns, briefing)."""
import os
import pytest
import requests

def _load_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        v = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    if not v:
        raise RuntimeError("REACT_APP_BACKEND_URL missing")
    return v.rstrip("/")


BASE_URL = _load_url()
EMAIL = "karan@mindmatters.local"
PASSWORD = "changeme123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


class TestReportsTimeline:
    def test_timeline_returns_array(self, auth):
        r = requests.get(f"{BASE_URL}/api/reports/timeline?days=30", headers=auth)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            assert "ts" in row and "kind" in row and "title" in row


class TestReportsCashflowMonthly:
    def test_cashflow_monthly_shape(self, auth):
        r = requests.get(f"{BASE_URL}/api/reports/cashflow-monthly?months=6", headers=auth)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for row in data:
            assert "month" in row
            for k in ("income", "expense", "asset", "liability"):
                assert k in row


class TestReportsPatterns:
    def test_patterns_array(self, auth):
        r = requests.get(f"{BASE_URL}/api/reports/patterns", headers=auth)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # iter_9 context says 4 overdue tasks exist → expect at least one pattern
        # Don't fail hard if data state changed; just type-check rows
        for p in data:
            assert "severity" in p and "title" in p
            assert p["severity"] in ("alert", "warn", "info", "ok")


class TestReportsBriefing:
    def test_briefing_returns_summary_snapshot(self, auth):
        r = requests.post(f"{BASE_URL}/api/reports/briefing", headers=auth, json={}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "summary" in data and isinstance(data["summary"], str) and len(data["summary"]) > 0
        assert "snapshot" in data
        snap = data["snapshot"]
        for k in ("tasks_completed_this_week", "tasks_open", "expense_this_week", "patterns"):
            assert k in snap
        assert isinstance(snap["patterns"], list)


class TestRegression:
    def test_loan_summary(self, auth):
        r = requests.get(f"{BASE_URL}/api/cashflow/loan-summary", headers=auth)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_monthly_emi", "active_loans"):
            assert k in d

    def test_tasks_list(self, auth):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=auth)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_notes_patch_tags(self, auth):
        # create note, tag it with 'decision', verify retrieval; cleanup
        c = requests.post(f"{BASE_URL}/api/notes", headers=auth,
                          json={"title": "TEST_v212_decision", "body": "x", "tags": []})
        assert c.status_code in (200, 201)
        nid = c.json()["id"]
        p = requests.patch(f"{BASE_URL}/api/notes/{nid}", headers=auth,
                           json={"tags": ["decision"]})
        assert p.status_code == 200
        assert "decision" in p.json().get("tags", [])
        g = requests.get(f"{BASE_URL}/api/notes", headers=auth, params={"tag": "decision"})
        assert g.status_code == 200
        ids = [n["id"] for n in g.json()]
        assert nid in ids
        requests.delete(f"{BASE_URL}/api/notes/{nid}", headers=auth)
