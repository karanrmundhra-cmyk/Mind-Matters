"""v2.23 — Email-only project invites + invite landing.

Tests:
  - POST /projects/{pid}/share returns invite_token + invite_url
  - Re-share same email -> idempotent updated:true
  - GET /invites/{token} PUBLIC (no auth) -> full landing data
  - GET /invites/<bogus> -> 404
  - POST /invites/{token}/accept requires matching email; 403 on mismatch
"""
import os
import time
import uuid
import pytest
import requests

def _load_frontend_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"

KARAN_EMAIL = "karan@mindmatters.local"
KARAN_PASS = "changeme123"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def karan_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": KARAN_EMAIL, "password": KARAN_PASS},
                      timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def karan_headers(karan_token):
    return {"Authorization": f"Bearer {karan_token}",
            "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def karan_project_id(karan_headers):
    r = requests.get(f"{API}/projects", headers=karan_headers, timeout=20)
    assert r.status_code == 200
    projects = r.json()
    # Use first owned project we are admin of (default project)
    assert len(projects) >= 1
    return projects[0]["id"]


@pytest.fixture
def fresh_email():
    return f"invitee_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.local"


# ---------- Share endpoint ----------
class TestShareInvite:
    def test_share_returns_invite_token_and_url(self, karan_headers,
                                                karan_project_id, fresh_email):
        r = requests.post(
            f"{API}/projects/{karan_project_id}/share",
            headers=karan_headers,
            json={"email": fresh_email, "role": "editor"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("invite_token"), str) and len(data["invite_token"]) >= 16
        assert data.get("invite_url", "").endswith(f"/invite/{data['invite_token']}")
        # accepted=False because invitee has no account
        assert data.get("accepted") is False

    def test_share_same_email_twice_is_idempotent(self, karan_headers,
                                                  karan_project_id, fresh_email):
        # First share as editor
        r1 = requests.post(
            f"{API}/projects/{karan_project_id}/share",
            headers=karan_headers,
            json={"email": fresh_email, "role": "editor"},
            timeout=20,
        ).json()
        token1 = r1["invite_token"]

        # Re-share as commenter
        r2 = requests.post(
            f"{API}/projects/{karan_project_id}/share",
            headers=karan_headers,
            json={"email": fresh_email, "role": "commenter"},
            timeout=20,
        )
        assert r2.status_code == 200, r2.text
        data2 = r2.json()
        assert data2.get("updated") is True
        # token reused
        assert data2["invite_token"] == token1
        assert data2["invite_url"].endswith(f"/invite/{token1}")

        # Lookup confirms role updated
        lookup = requests.get(f"{API}/invites/{token1}", timeout=20).json()
        assert lookup["role"] == "commenter"


# ---------- Public lookup ----------
class TestInviteLookup:
    def test_lookup_is_public_no_auth(self, karan_headers,
                                      karan_project_id, fresh_email):
        share = requests.post(
            f"{API}/projects/{karan_project_id}/share",
            headers=karan_headers,
            json={"email": fresh_email, "role": "viewer"},
            timeout=20,
        ).json()
        token = share["invite_token"]

        # NO Authorization header
        r = requests.get(f"{API}/invites/{token}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "project" in data and "id" in data["project"] and "name" in data["project"]
        assert data["project"]["id"] == karan_project_id
        assert "inviter" in data
        assert "first_name" in data["inviter"]
        assert "email" in data["inviter"]
        assert data["inviter"]["email"].lower() == KARAN_EMAIL
        assert data["role"] == "viewer"
        assert data["invited_email"].lower() == fresh_email.lower()
        assert data["accepted"] is False
        assert data["has_account"] is False

    def test_lookup_bogus_token_returns_404(self):
        r = requests.get(f"{API}/invites/bogus_token_xyz_does_not_exist", timeout=20)
        assert r.status_code == 404
        detail = r.json().get("detail", "")
        assert "not found" in detail.lower() or "revoked" in detail.lower()

    def test_lookup_has_account_true_when_user_exists(self, karan_headers,
                                                      karan_project_id):
        # Share with Karan's own email won't work (self-invite blocked) — use a
        # signed-up unique user.
        new_email = f"hasacct_{uuid.uuid4().hex[:8]}@test.local"
        sign = requests.post(f"{API}/auth/signup", json={
            "first_name": "HasAcct", "email": new_email, "password": "password123"
        }, timeout=20)
        assert sign.status_code == 200

        share = requests.post(
            f"{API}/projects/{karan_project_id}/share",
            headers=karan_headers,
            json={"email": new_email, "role": "viewer"},
            timeout=20,
        ).json()
        token = share["invite_token"]

        data = requests.get(f"{API}/invites/{token}", timeout=20).json()
        assert data["has_account"] is True


# ---------- Accept ----------
class TestInviteAccept:
    def test_accept_with_matching_email_succeeds(self, karan_headers,
                                                 karan_project_id):
        invitee_email = f"acceptor_{uuid.uuid4().hex[:8]}@test.local"
        # Invite first
        share = requests.post(
            f"{API}/projects/{karan_project_id}/share",
            headers=karan_headers,
            json={"email": invitee_email, "role": "editor"},
            timeout=20,
        ).json()
        token = share["invite_token"]

        # Signup invitee
        sign = requests.post(f"{API}/auth/signup", json={
            "first_name": "Acceptor",
            "email": invitee_email,
            "password": "password123",
        }, timeout=20)
        assert sign.status_code == 200, sign.text
        invitee_token = sign.json()["token"]

        # Accept
        r = requests.post(f"{API}/invites/{token}/accept",
                          headers={"Authorization": f"Bearer {invitee_token}"},
                          timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("project_id") == karan_project_id
        assert body.get("role") == "editor"

        # Lookup now shows accepted=true
        data = requests.get(f"{API}/invites/{token}", timeout=20).json()
        assert data["accepted"] is True

        # Invitee can now list the project
        plist = requests.get(
            f"{API}/projects",
            headers={"Authorization": f"Bearer {invitee_token}"},
            timeout=20,
        ).json()
        assert any(p["id"] == karan_project_id for p in plist)

    def test_accept_with_mismatched_email_returns_403(self, karan_headers,
                                                     karan_project_id):
        target_email = f"target_{uuid.uuid4().hex[:8]}@test.local"
        share = requests.post(
            f"{API}/projects/{karan_project_id}/share",
            headers=karan_headers,
            json={"email": target_email, "role": "viewer"},
            timeout=20,
        ).json()
        token = share["invite_token"]

        # A different user signs up with different email
        other_email = f"other_{uuid.uuid4().hex[:8]}@test.local"
        sign = requests.post(f"{API}/auth/signup", json={
            "first_name": "Other",
            "email": other_email,
            "password": "password123",
        }, timeout=20)
        assert sign.status_code == 200
        other_token = sign.json()["token"]

        r = requests.post(f"{API}/invites/{token}/accept",
                          headers={"Authorization": f"Bearer {other_token}"},
                          timeout=20)
        assert r.status_code == 403
        detail = r.json().get("detail", "")
        assert target_email in detail
        assert "sign in" in detail.lower()

    def test_accept_requires_auth(self, karan_headers, karan_project_id):
        target_email = f"unauth_{uuid.uuid4().hex[:8]}@test.local"
        share = requests.post(
            f"{API}/projects/{karan_project_id}/share",
            headers=karan_headers,
            json={"email": target_email, "role": "viewer"},
            timeout=20,
        ).json()
        token = share["invite_token"]
        r = requests.post(f"{API}/invites/{token}/accept", timeout=20)
        assert r.status_code in (401, 403)

    def test_accept_bogus_token_returns_404(self, karan_headers):
        r = requests.post(f"{API}/invites/bogus_xyz/accept",
                          headers=karan_headers, timeout=20)
        assert r.status_code == 404


# ---------- v2.22 regression smoke ----------
class TestRegressionSmoke:
    def test_tasks_list_works(self, karan_headers):
        r = requests.get(f"{API}/tasks", headers=karan_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_projects_list_works(self, karan_headers):
        r = requests.get(f"{API}/projects", headers=karan_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_routines_list_works(self, karan_headers):
        r = requests.get(f"{API}/routines", headers=karan_headers, timeout=20)
        assert r.status_code == 200
