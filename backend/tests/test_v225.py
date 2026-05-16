"""v2.25 backend tests — project-scoped Sections (Todoist-style row dividers).

Covers:
  * POST   /projects/{pid}/sections                       — create
  * GET    /projects/{pid}/sections?module=...            — list ordered
  * PATCH  /sections/{sid}                                — rename / re-position
  * POST   /projects/{pid}/sections/reorder               — bulk reorder
  * DELETE /sections/{sid}                                — cascades to rows
  * PATCH  /tasks/{id}  {section_id: <sid> | null}        — moves row
  * Permissions — viewer / non-member 403s
  * Validation — module restricted to tasks/routines/transactions (422)
"""
import os
import uuid
from typing import Dict, List

import pytest
import requests


def _resolve_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _resolve_base_url()
KARAN = {"email": "karan@mindmatters.local", "password": "changeme123"}


# ─────────────────── fixtures ───────────────────
@pytest.fixture(scope="module")
def karan_token() -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json=KARAN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def karan_headers(karan_token):
    return {"Authorization": f"Bearer {karan_token}"}


@pytest.fixture(scope="module")
def project_id(karan_headers) -> str:
    """Create a throwaway project so we don't pollute the user's default project
    AND so the viewer-share flow won't accidentally expose unrelated data."""
    name = f"TEST_v225_{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{BASE_URL}/api/projects",
        json={"name": name, "color": "#C9A961"},
        headers=karan_headers,
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def viewer_account():
    """Create a fresh viewer-role account so we can test 403s end-to-end."""
    email = f"viewer_{uuid.uuid4().hex[:8]}@v225.test"
    payload = {"first_name": "Viewer", "email": email, "password": "viewerpass123"}
    r = requests.post(f"{BASE_URL}/api/auth/signup", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    return {
        "email": email,
        "token": r.json()["token"],
        "user": r.json()["user"],
    }


@pytest.fixture(scope="module")
def viewer_headers(viewer_account):
    return {"Authorization": f"Bearer {viewer_account['token']}"}


@pytest.fixture(scope="module")
def shared_project_with_viewer(karan_headers, project_id, viewer_account):
    """Invite the viewer account to the karan project with role=viewer, then
    accept the invite as the viewer. Returns project_id."""
    inv = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/share",
        json={"email": viewer_account["email"], "role": "viewer"},
        headers=karan_headers,
        timeout=15,
    )
    assert inv.status_code in (200, 201), inv.text
    token = inv.json().get("invite_token") or inv.json().get("token")
    if token:
        # Accept invite as the viewer (correct endpoint: /invites/{token}/accept)
        acc = requests.post(
            f"{BASE_URL}/api/invites/{token}/accept",
            headers={"Authorization": f"Bearer {viewer_account['token']}"},
            timeout=15,
        )
        assert acc.status_code in (200, 201, 204, 404, 409), acc.text
    return project_id


# ─────────────────── tests ───────────────────
# Item 1 — POST /projects/{pid}/sections
class TestCreateSection:
    def test_create_returns_full_section_doc(self, karan_headers, project_id):
        body = {"module": "tasks", "name": f"TEST_v225_MORNING_{uuid.uuid4().hex[:6]}"}
        r = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections",
            json=body, headers=karan_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["name"] == body["name"]
        assert doc["module"] == "tasks"
        assert doc["project_id"] == project_id
        assert isinstance(doc.get("id"), str) and len(doc["id"]) > 0
        assert isinstance(doc.get("position"), int) and doc["position"] >= 1
        assert isinstance(doc.get("created_by"), str)
        assert "created_at" in doc and "updated_at" in doc

    def test_create_rejects_invalid_module(self, karan_headers, project_id):
        r = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections",
            json={"module": "notes", "name": "Bad"},
            headers=karan_headers, timeout=15,
        )
        # Literal validation → 422
        assert r.status_code == 422, r.text

    def test_create_rejects_blank_name(self, karan_headers, project_id):
        r = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections",
            json={"module": "tasks", "name": "   "},
            headers=karan_headers, timeout=15,
        )
        assert r.status_code == 400, r.text


# Item 2 — GET ordering
class TestListSections:
    def test_list_returns_ascending_position(self, karan_headers, project_id):
        # Create 3 sections in a fresh module bucket so ordering is deterministic.
        suffix = uuid.uuid4().hex[:6]
        created: List[Dict] = []
        for n in ["TEST_A", "TEST_B", "TEST_C"]:
            r = requests.post(
                f"{BASE_URL}/api/projects/{project_id}/sections",
                json={"module": "routines", "name": f"{n}_{suffix}"},
                headers=karan_headers, timeout=15,
            )
            assert r.status_code == 200, r.text
            created.append(r.json())
        # List filtered by module
        r = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/sections?module=routines",
            headers=karan_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        listed = r.json()
        positions = [s["position"] for s in listed]
        assert positions == sorted(positions), f"Not ascending: {positions}"
        ours = [s for s in listed if s["name"].endswith(f"_{suffix}")]
        assert [s["name"] for s in ours] == [c["name"] for c in created]


# Item 3 — PATCH /sections/{sid}
class TestPatchSection:
    def test_rename_and_reposition(self, karan_headers, project_id):
        r = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections",
            json={"module": "transactions", "name": f"TEST_v225_OLD_{uuid.uuid4().hex[:6]}"},
            headers=karan_headers, timeout=15,
        )
        sid = r.json()["id"]
        new_name = f"TEST_v225_EVENING_{uuid.uuid4().hex[:6]}"
        r2 = requests.patch(
            f"{BASE_URL}/api/sections/{sid}",
            json={"name": new_name},
            headers=karan_headers, timeout=15,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["name"] == new_name

        r3 = requests.patch(
            f"{BASE_URL}/api/sections/{sid}",
            json={"position": 99},
            headers=karan_headers, timeout=15,
        )
        assert r3.status_code == 200, r3.text
        assert r3.json()["position"] == 99


# Item 4 — reorder
class TestReorderSections:
    def test_reorder_assigns_1_to_N(self, karan_headers, project_id):
        suffix = uuid.uuid4().hex[:6]
        ids = []
        for n in ["TEST_R1", "TEST_R2", "TEST_R3"]:
            r = requests.post(
                f"{BASE_URL}/api/projects/{project_id}/sections",
                json={"module": "tasks", "name": f"{n}_{suffix}"},
                headers=karan_headers, timeout=15,
            )
            ids.append(r.json()["id"])
        # Reorder reversed
        rev = list(reversed(ids))
        r = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections/reorder",
            json={"module": "tasks", "ids": rev},
            headers=karan_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("count") == 3

        # Verify positions 1..3 in the reordered order
        listed = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/sections?module=tasks",
            headers=karan_headers, timeout=15,
        ).json()
        by_id = {s["id"]: s for s in listed}
        for expected_pos, sid in enumerate(rev, start=1):
            assert by_id[sid]["position"] == expected_pos


# Item 5 — DELETE cascades section_id=null on rows
class TestDeleteSectionCascade:
    def test_delete_unsets_section_id_on_tasks(self, karan_headers, project_id):
        sec = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections",
            json={"module": "tasks", "name": f"TEST_v225_DEL_{uuid.uuid4().hex[:6]}"},
            headers=karan_headers, timeout=15,
        ).json()
        sid = sec["id"]
        # Create a task and assign it to the section
        t = requests.post(
            f"{BASE_URL}/api/tasks",
            json={
                "name": f"TEST_v225_task_{uuid.uuid4().hex[:6]}",
                "task": "ph",
                "status": "Pending",
                "date": "2026-01-15",
                "project_id": project_id,
                "section_id": sid,
            },
            headers=karan_headers, timeout=15,
        )
        assert t.status_code in (200, 201), t.text
        task = t.json()
        assert task.get("section_id") == sid
        # Delete the section
        r = requests.delete(
            f"{BASE_URL}/api/sections/{sid}", headers=karan_headers, timeout=15
        )
        assert r.status_code == 200, r.text
        # Verify the task still exists but section_id is None.
        # GET /tasks/{id} is not exposed; verify via list.
        listed = requests.get(
            f"{BASE_URL}/api/tasks?project_id={project_id}",
            headers=karan_headers, timeout=15,
        ).json()
        row = next((x for x in listed if x["id"] == task["id"]), None)
        assert row is not None, "Task vanished after section delete (bug!)"
        assert row.get("section_id") in (None, ""), row

    def test_delete_section_404_for_missing(self, karan_headers):
        r = requests.delete(
            f"{BASE_URL}/api/sections/does-not-exist-xyz",
            headers=karan_headers, timeout=15,
        )
        assert r.status_code == 404


# Item 6 — PATCH task with section_id
class TestPatchTaskSection:
    def test_patch_task_section_id_set_and_clear(self, karan_headers, project_id):
        sec = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections",
            json={"module": "tasks", "name": f"TEST_v225_PATCH_{uuid.uuid4().hex[:6]}"},
            headers=karan_headers, timeout=15,
        ).json()
        t = requests.post(
            f"{BASE_URL}/api/tasks",
            json={
                "name": f"TEST_v225_ptask_{uuid.uuid4().hex[:6]}",
                "task": "ph",
                "status": "Pending",
                "date": "2026-01-15",
                "project_id": project_id,
            },
            headers=karan_headers, timeout=15,
        ).json()
        # Set section
        r1 = requests.patch(
            f"{BASE_URL}/api/tasks/{t['id']}",
            json={"section_id": sec["id"]},
            headers=karan_headers, timeout=15,
        )
        assert r1.status_code == 200, r1.text
        assert r1.json().get("section_id") == sec["id"]
        # Clear section
        r2 = requests.patch(
            f"{BASE_URL}/api/tasks/{t['id']}",
            json={"section_id": None},
            headers=karan_headers, timeout=15,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json().get("section_id") in (None, "")


# Item 6b — PATCH routine with section_id
class TestPatchRoutineSection:
    def test_patch_routine_section_id_set_and_clear(self, karan_headers, project_id):
        sec = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections",
            json={"module": "routines", "name": f"TEST_v225_RPATCH_{uuid.uuid4().hex[:6]}"},
            headers=karan_headers, timeout=15,
        ).json()
        # Create a routine
        rr = requests.post(
            f"{BASE_URL}/api/routines",
            json={
                "name": f"TEST_v225_rout_{uuid.uuid4().hex[:6]}",
                "task": "ph",
                "activity": "TEST_v225_activity",
                "frequency": "Daily",
                "project_id": project_id,
            },
            headers=karan_headers, timeout=15,
        )
        assert rr.status_code in (200, 201), rr.text
        routine = rr.json()
        # Set section
        r1 = requests.patch(
            f"{BASE_URL}/api/routines/{routine['id']}",
            json={"section_id": sec["id"]},
            headers=karan_headers, timeout=15,
        )
        assert r1.status_code == 200, r1.text
        assert r1.json().get("section_id") == sec["id"]
        # GET back to verify persistence
        listed = requests.get(
            f"{BASE_URL}/api/routines?project_id={project_id}",
            headers=karan_headers, timeout=15,
        ).json()
        row = next((x for x in listed if x["id"] == routine["id"]), None)
        assert row is not None and row.get("section_id") == sec["id"]
        # Clear section
        r2 = requests.patch(
            f"{BASE_URL}/api/routines/{routine['id']}",
            json={"section_id": None},
            headers=karan_headers, timeout=15,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json().get("section_id") in (None, "")


# Item 6c — PATCH transaction with section_id
class TestPatchTransactionSection:
    def test_patch_transaction_section_id_set_and_clear(self, karan_headers, project_id):
        sec = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/sections",
            json={"module": "transactions", "name": f"TEST_v225_TPATCH_{uuid.uuid4().hex[:6]}"},
            headers=karan_headers, timeout=15,
        ).json()
        # Create a transaction
        tx = requests.post(
            f"{BASE_URL}/api/transactions",
            json={
                "name": f"TEST_v225_tx_{uuid.uuid4().hex[:6]}",
                "amount": 10.50,
                "type": "Expense",
                "date": "2026-01-15",
                "project_id": project_id,
            },
            headers=karan_headers, timeout=15,
        )
        assert tx.status_code in (200, 201), tx.text
        txn = tx.json()
        # Set section
        r1 = requests.patch(
            f"{BASE_URL}/api/transactions/{txn['id']}",
            json={"section_id": sec["id"]},
            headers=karan_headers, timeout=15,
        )
        assert r1.status_code == 200, r1.text
        assert r1.json().get("section_id") == sec["id"]
        # GET back to verify persistence
        listed = requests.get(
            f"{BASE_URL}/api/transactions?project_id={project_id}",
            headers=karan_headers, timeout=15,
        ).json()
        row = next((x for x in listed if x["id"] == txn["id"]), None)
        assert row is not None and row.get("section_id") == sec["id"]
        # Clear section
        r2 = requests.patch(
            f"{BASE_URL}/api/transactions/{txn['id']}",
            json={"section_id": None},
            headers=karan_headers, timeout=15,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json().get("section_id") in (None, "")


# Item 7 — Permissions
class TestPermissions:
    def test_non_member_get_returns_403(self, viewer_headers, karan_headers):
        # Create a brand-new project owned by karan that the viewer is NOT in
        r = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": f"TEST_v225_private_{uuid.uuid4().hex[:6]}"},
            headers=karan_headers, timeout=15,
        )
        pid = r.json()["id"]
        r2 = requests.get(
            f"{BASE_URL}/api/projects/{pid}/sections",
            headers=viewer_headers, timeout=15,
        )
        assert r2.status_code == 403, r2.status_code

    def test_viewer_can_get_but_not_write(self, karan_headers, viewer_headers, shared_project_with_viewer):
        pid = shared_project_with_viewer
        # Karan creates a section
        sec = requests.post(
            f"{BASE_URL}/api/projects/{pid}/sections",
            json={"module": "tasks", "name": f"TEST_v225_PERM_{uuid.uuid4().hex[:6]}"},
            headers=karan_headers, timeout=15,
        ).json()
        # Viewer GET → 200
        rget = requests.get(
            f"{BASE_URL}/api/projects/{pid}/sections?module=tasks",
            headers=viewer_headers, timeout=15,
        )
        assert rget.status_code == 200, rget.text
        ids = [s["id"] for s in rget.json()]
        assert sec["id"] in ids
        # Viewer POST → 403
        rpost = requests.post(
            f"{BASE_URL}/api/projects/{pid}/sections",
            json={"module": "tasks", "name": "ViewerNo"},
            headers=viewer_headers, timeout=15,
        )
        assert rpost.status_code == 403, rpost.status_code
        # Viewer PATCH → 403
        rpatch = requests.patch(
            f"{BASE_URL}/api/sections/{sec['id']}",
            json={"name": "ViewerRename"},
            headers=viewer_headers, timeout=15,
        )
        assert rpatch.status_code == 403, rpatch.status_code
        # Viewer DELETE → 403
        rdel = requests.delete(
            f"{BASE_URL}/api/sections/{sec['id']}",
            headers=viewer_headers, timeout=15,
        )
        assert rdel.status_code == 403, rdel.status_code


# ─────────────────── cleanup ───────────────────
@pytest.fixture(scope="module", autouse=True)
def _cleanup(karan_headers, project_id):
    yield
    # Best-effort teardown: delete the throwaway test project (cascades).
    try:
        requests.delete(
            f"{BASE_URL}/api/projects/{project_id}", headers=karan_headers, timeout=15
        )
    except Exception:
        pass
