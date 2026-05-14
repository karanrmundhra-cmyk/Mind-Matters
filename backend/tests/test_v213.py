"""v2.13 tests: Service Worker + PWA manifest static endpoints + AI Pattern Detector backend."""
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


# --- PWA / Service Worker static assets ---
class TestPWAStatic:
    def test_sw_js_served(self):
        r = requests.get(f"{BASE_URL}/sw.js", timeout=15)
        assert r.status_code == 200, f"sw.js status={r.status_code}"
        ct = r.headers.get("content-type", "")
        assert "javascript" in ct.lower(), f"Unexpected content-type: {ct}"
        assert "CACHE_VERSION" in r.text or "self.addEventListener" in r.text

    def test_manifest_json_served(self):
        r = requests.get(f"{BASE_URL}/manifest.json", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("short_name") == "Mind Matters"
        assert data.get("display") == "standalone"
        assert isinstance(data.get("icons"), list) and len(data["icons"]) >= 1

    def test_index_links_manifest(self):
        r = requests.get(f"{BASE_URL}/", timeout=15)
        assert r.status_code == 200
        body = r.text
        assert "manifest.json" in body, "index.html missing manifest reference"
        assert "apple-touch-icon" in body, "index.html missing apple-touch-icon"


# --- AI Pattern Detector backend ---
class TestAiPatterns:
    def test_ai_patterns_returns_json_array(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/reports/ai-patterns",
            headers=auth_headers,
            timeout=45,
        )
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:200]}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data).__name__}"
        # If LLM returns items, verify structure
        for item in data:
            assert isinstance(item, dict)
            assert "title" in item and isinstance(item["title"], str)
            assert "detail" in item and isinstance(item["detail"], str)
            assert len(item["title"]) > 0

    def test_ai_patterns_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/reports/ai-patterns", timeout=10)
        assert r.status_code in (401, 403), f"Expected auth error, got {r.status_code}"


# --- v2.12 regression: still working ---
class TestRegressionV212:
    def test_patterns_rule_based(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/reports/patterns", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_timeline(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/reports/timeline", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_cashflow_monthly(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/reports/cashflow-monthly", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_tasks_list(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_notes_list(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/notes", headers=auth_headers, timeout=15)
        assert r.status_code == 200
