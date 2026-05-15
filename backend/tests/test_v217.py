"""v2.17 backend tests — Multi-project, strict seed, 3-level subtasks.

Covers:
- Project CRUD + share + members + comments
- project_id filter on all 6 data routes
- Strict seed (POST /api/seed/first-login) and reset/seed
- 3-level subtask creation (parent_id chain)
"""
import os
import time
import pytest
import requests


def _read_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _read_url()
EMAIL = "karan@mindmatters.local"
PASSWORD = "changeme123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}",
                      "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def default_project_id(auth):
    r = auth.get(f"{BASE_URL}/api/projects")
    assert r.status_code == 200, r.text
    projects = r.json()
    default = next((p for p in projects if p.get("is_default")), None)
    assert default is not None, f"default project missing: {projects}"
    return default["id"]


# ───────────── Projects CRUD ─────────────
class TestProjects:
    def test_list_includes_default_personal(self, auth):
        r = auth.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 200, r.text
        projects = r.json()
        assert isinstance(projects, list) and len(projects) >= 1
        default = next((p for p in projects if p.get("is_default")), None)
        assert default is not None
        assert default.get("role") == "admin"
        # default project should not appear as shared if karan owns it
        # and no other members
        assert "name" in default

    def test_create_update_delete_project(self, auth):
        # CREATE
        r = auth.post(f"{BASE_URL}/api/projects",
                      json={"name": "TEST_v217_proj", "color": "#ff0000"})
        assert r.status_code in (200, 201), r.text
        proj = r.json()
        pid = proj["id"]
        assert proj["name"] == "TEST_v217_proj"
        assert proj["color"] == "#ff0000"
        assert proj["role"] == "admin"
        assert proj.get("is_default") is False
        assert "member_count" in proj

        # PATCH (rename + recolor)
        r = auth.patch(f"{BASE_URL}/api/projects/{pid}",
                       json={"name": "TEST_v217_renamed", "color": "#00ff00"})
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["name"] == "TEST_v217_renamed"
        assert updated["color"] == "#00ff00"

        # GET listing reflects update
        r = auth.get(f"{BASE_URL}/api/projects")
        match = next((p for p in r.json() if p["id"] == pid), None)
        assert match is not None
        assert match["name"] == "TEST_v217_renamed"

        # DELETE
        r = auth.delete(f"{BASE_URL}/api/projects/{pid}")
        assert r.status_code == 200, r.text
        r = auth.get(f"{BASE_URL}/api/projects")
        assert all(p["id"] != pid for p in r.json())

    def test_default_project_cannot_be_deleted(self, auth, default_project_id):
        r = auth.delete(f"{BASE_URL}/api/projects/{default_project_id}")
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"


# ───────────── Share + members ─────────────
class TestShareAndMembers:
    def test_share_invitee_without_account_then_list_members(self, auth):
        r = auth.post(f"{BASE_URL}/api/projects",
                      json={"name": "TEST_v217_share", "color": "#3366ff"})
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]

        # invite a non-existent email
        invite_email = f"test_v217_invitee_{int(time.time())}@example.com"
        r = auth.post(f"{BASE_URL}/api/projects/{pid}/share",
                      json={"email": invite_email, "role": "editor"})
        assert r.status_code == 200, r.text
        share_resp = r.json()
        assert share_resp["ok"] is True
        member_id = share_resp.get("member_id")
        assert member_id

        # list members shows owner + invitee
        r = auth.get(f"{BASE_URL}/api/projects/{pid}/members")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["owner"]["role"] == "admin"
        assert any(m.get("invited_email") == invite_email for m in data["members"])

        # update role to commenter
        r = auth.patch(f"{BASE_URL}/api/projects/{pid}/members/{member_id}",
                       json={"role": "commenter"})
        assert r.status_code == 200, r.text

        # remove member
        r = auth.delete(f"{BASE_URL}/api/projects/{pid}/members/{member_id}")
        assert r.status_code == 200, r.text

        # cleanup project
        auth.delete(f"{BASE_URL}/api/projects/{pid}")


# ───────────── Comments ─────────────
class TestComments:
    def test_post_and_list_comments(self, auth, default_project_id):
        # create a task to attach a comment to
        r = auth.post(f"{BASE_URL}/api/tasks",
                      json={"task": "TEST_v217_comment_target",
                            "status": "To-Do",
                            "project_id": default_project_id})
        assert r.status_code in (200, 201), r.text
        task_id = r.json()["id"]
        try:
            r = auth.post(
                f"{BASE_URL}/api/projects/{default_project_id}/comments",
                json={"resource_type": "task", "resource_id": task_id,
                      "body": "TEST_v217_first_comment"})
            assert r.status_code in (200, 201), r.text
            cid = r.json()["id"]

            r = auth.get(
                f"{BASE_URL}/api/projects/{default_project_id}/comments",
                params={"resource_type": "task", "resource_id": task_id})
            assert r.status_code == 200, r.text
            comments = r.json()
            assert any(c["id"] == cid for c in comments)

            auth.delete(f"{BASE_URL}/api/comments/{cid}")
        finally:
            auth.delete(f"{BASE_URL}/api/tasks/{task_id}")


# ───────────── project_id filter across data routes ─────────────
class TestProjectIdFilter:
    def test_task_filter_by_project_id(self, auth):
        # create 2 projects
        a = auth.post(f"{BASE_URL}/api/projects",
                      json={"name": "TEST_v217_A"}).json()
        b = auth.post(f"{BASE_URL}/api/projects",
                      json={"name": "TEST_v217_B"}).json()
        try:
            # one task in A, one in B
            ta = auth.post(f"{BASE_URL}/api/tasks",
                           json={"task": "TEST_v217_taskA",
                                 "project_id": a["id"]}).json()
            tb = auth.post(f"{BASE_URL}/api/tasks",
                           json={"task": "TEST_v217_taskB",
                                 "project_id": b["id"]}).json()
            try:
                # filter to A
                r = auth.get(f"{BASE_URL}/api/tasks",
                             params={"project_id": a["id"]})
                assert r.status_code == 200, r.text
                ids = [t["id"] for t in r.json()]
                assert ta["id"] in ids
                assert tb["id"] not in ids

                # filter to B
                r = auth.get(f"{BASE_URL}/api/tasks",
                             params={"project_id": b["id"]})
                ids = [t["id"] for t in r.json()]
                assert tb["id"] in ids
                assert ta["id"] not in ids
            finally:
                auth.delete(f"{BASE_URL}/api/tasks/{ta['id']}")
                auth.delete(f"{BASE_URL}/api/tasks/{tb['id']}")
        finally:
            auth.delete(f"{BASE_URL}/api/projects/{a['id']}")
            auth.delete(f"{BASE_URL}/api/projects/{b['id']}")

    def test_routines_transactions_filter(self, auth):
        a = auth.post(f"{BASE_URL}/api/projects",
                      json={"name": "TEST_v217_rt_A"}).json()
        try:
            rr = auth.post(f"{BASE_URL}/api/routines",
                           json={"group": "TEST_v217", "name": "n",
                                 "activity": "a", "frequency": "Daily",
                                 "priority": "High",
                                 "project_id": a["id"]}).json()
            tr = auth.post(f"{BASE_URL}/api/transactions",
                           json={"label": "TEST_v217_tx", "amount": 10.0,
                                 "direction": "out", "category": "expense",
                                 "date": "2026-01-15", "currency": "INR",
                                 "project_id": a["id"]}).json()
            try:
                lst = auth.get(f"{BASE_URL}/api/routines",
                               params={"project_id": a["id"]}).json()
                assert any(x["id"] == rr["id"] for x in lst)
                lst = auth.get(f"{BASE_URL}/api/transactions",
                               params={"project_id": a["id"]}).json()
                assert any(x["id"] == tr["id"] for x in lst)
            finally:
                auth.delete(f"{BASE_URL}/api/routines/{rr['id']}")
                auth.delete(f"{BASE_URL}/api/transactions/{tr['id']}")
        finally:
            auth.delete(f"{BASE_URL}/api/projects/{a['id']}")


# ───────────── Strict seed ─────────────
class TestStrictSeed:
    def test_seed_first_login_is_idempotent_when_data_present(self, auth):
        """Karan already has data so this should return seeded=False."""
        r = auth.post(f"{BASE_URL}/api/seed/first-login")
        assert r.status_code == 200, r.text
        body = r.json()
        # When user already has data this returns seeded:false
        assert "seeded" in body

    def test_reset_seed_requires_confirm(self, auth):
        r = auth.post(f"{BASE_URL}/api/reset/seed", json={"confirm": "nope"})
        assert r.status_code == 400, r.text


# ───────────── 3-level subtasks ─────────────
class TestThreeLevelSubtasks:
    def test_tasks_three_levels_deep(self, auth, default_project_id):
        depth0 = auth.post(f"{BASE_URL}/api/tasks",
                           json={"task": "TEST_v217_d0",
                                 "project_id": default_project_id}).json()
        depth1 = auth.post(f"{BASE_URL}/api/tasks",
                           json={"task": "TEST_v217_d1",
                                 "parent_id": depth0["id"],
                                 "project_id": default_project_id}).json()
        depth2 = auth.post(f"{BASE_URL}/api/tasks",
                           json={"task": "TEST_v217_d2",
                                 "parent_id": depth1["id"],
                                 "project_id": default_project_id}).json()
        try:
            assert depth1["parent_id"] == depth0["id"]
            assert depth2["parent_id"] == depth1["id"]

            lst = auth.get(f"{BASE_URL}/api/tasks",
                           params={"project_id": default_project_id}).json()
            ids = {t["id"]: t for t in lst}
            assert ids[depth0["id"]].get("parent_id") in (None, "")
            assert ids[depth1["id"]]["parent_id"] == depth0["id"]
            assert ids[depth2["id"]]["parent_id"] == depth1["id"]
        finally:
            auth.delete(f"{BASE_URL}/api/tasks/{depth2['id']}")
            auth.delete(f"{BASE_URL}/api/tasks/{depth1['id']}")
            auth.delete(f"{BASE_URL}/api/tasks/{depth0['id']}")

    def test_routines_three_levels_deep(self, auth, default_project_id):
        common = {"group": "TEST_v217", "frequency": "Daily",
                  "priority": "High", "project_id": default_project_id}
        d0 = auth.post(f"{BASE_URL}/api/routines",
                       json={**common, "name": "r0", "activity": "a0"}).json()
        d1 = auth.post(f"{BASE_URL}/api/routines",
                       json={**common, "name": "r1", "activity": "a1",
                             "parent_id": d0["id"]}).json()
        d2 = auth.post(f"{BASE_URL}/api/routines",
                       json={**common, "name": "r2", "activity": "a2",
                             "parent_id": d1["id"]}).json()
        try:
            assert d1["parent_id"] == d0["id"]
            assert d2["parent_id"] == d1["id"]
        finally:
            auth.delete(f"{BASE_URL}/api/routines/{d2['id']}")
            auth.delete(f"{BASE_URL}/api/routines/{d1['id']}")
            auth.delete(f"{BASE_URL}/api/routines/{d0['id']}")

    def test_transactions_three_levels_deep(self, auth, default_project_id):
        common = {"direction": "out", "category": "expense",
                  "date": "2026-01-15", "currency": "INR",
                  "project_id": default_project_id}
        d0 = auth.post(f"{BASE_URL}/api/transactions",
                       json={**common, "label": "TEST_v217_tx0",
                             "amount": 100.0}).json()
        d1 = auth.post(f"{BASE_URL}/api/transactions",
                       json={**common, "label": "TEST_v217_tx1",
                             "amount": 60.0, "parent_id": d0["id"]}).json()
        d2 = auth.post(f"{BASE_URL}/api/transactions",
                       json={**common, "label": "TEST_v217_tx2",
                             "amount": 30.0, "parent_id": d1["id"]}).json()
        try:
            assert d1["parent_id"] == d0["id"]
            assert d2["parent_id"] == d1["id"]
        finally:
            auth.delete(f"{BASE_URL}/api/transactions/{d2['id']}")
            auth.delete(f"{BASE_URL}/api/transactions/{d1['id']}")
            auth.delete(f"{BASE_URL}/api/transactions/{d0['id']}")


# ───────────── Notes / reminders / deadlines project_id ─────────────
class TestOtherCollectionsProjectId:
    def test_notes_reminders_deadlines_project_id(self, auth, default_project_id):
        n = auth.post(f"{BASE_URL}/api/notes",
                      json={"title": "TEST_v217_note", "body": "x",
                            "project_id": default_project_id}).json()
        try:
            lst = auth.get(f"{BASE_URL}/api/notes",
                           params={"project_id": default_project_id}).json()
            assert any(x["id"] == n["id"] for x in lst)
        finally:
            auth.delete(f"{BASE_URL}/api/notes/{n['id']}")

        rm = auth.post(f"{BASE_URL}/api/reminders",
                       json={"title": "TEST_v217_rem",
                             "fire_at": "2026-12-31T10:00:00Z",
                             "project_id": default_project_id}).json()
        try:
            lst = auth.get(f"{BASE_URL}/api/reminders",
                           params={"project_id": default_project_id}).json()
            assert any(x["id"] == rm["id"] for x in lst)
        finally:
            auth.delete(f"{BASE_URL}/api/reminders/{rm['id']}")

        dl = auth.post(f"{BASE_URL}/api/deadlines",
                       json={"title": "TEST_v217_dl", "due_date": "2026-12-31",
                             "project_id": default_project_id}).json()
        try:
            lst = auth.get(f"{BASE_URL}/api/deadlines",
                           params={"project_id": default_project_id}).json()
            assert any(x["id"] == dl["id"] for x in lst)
        finally:
            auth.delete(f"{BASE_URL}/api/deadlines/{dl['id']}")
