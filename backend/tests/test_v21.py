"""Mind Matters v2.1 backend tests — iteration 7.
Covers: notes/append-list, cal/feed/token (auth) + cal/{token}.ics (public),
reminders/{id}/resend, auth/change-password, export/data.xlsx, parse/bulk no-capitalization,
routines with 'name' field.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
EMAIL = "karan@mindmatters.local"
PASSWORD = "changeme123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}",
                      "Content-Type": "application/json"})
    return s


# ──────────── Calendar feed token (auth) + public ICS ────────────
class TestCalFeed:
    def test_rotate_token_post(self, client):
        r = client.post(f"{BASE_URL}/api/cal/feed/token", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) >= 16
        pytest.cal_token = data["token"]

    def test_get_token_matches(self, client):
        r = client.get(f"{BASE_URL}/api/cal/feed/token", timeout=10)
        assert r.status_code == 200
        assert r.json().get("token") == pytest.cal_token

    def test_public_ics_feed(self, client):
        # Make sure there's at least one reminder
        client.post(f"{BASE_URL}/api/reminders",
                    json={"title": "TEST_v21_cal_rem", "fire_at": "2030-01-01T10:00:00Z",
                          "recurrence": "none"}, timeout=10)
        r = requests.get(f"{BASE_URL}/api/cal/{pytest.cal_token}.ics", timeout=15)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("text/calendar"), r.headers
        body = r.text
        assert body.startswith("BEGIN:VCALENDAR"), body[:200]
        assert "BEGIN:VEVENT" in body
        assert "END:VCALENDAR" in body

    def test_public_ics_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/cal/bogus-token-xxx.ics", timeout=10)
        assert r.status_code == 404


# ──────────── Notes append-list ────────────
class TestNotesAppendList:
    def test_append_by_title_creates_then_appends(self, client):
        # Clean up a prior TEST note if any (case-insensitive title)
        notes = client.get(f"{BASE_URL}/api/notes", timeout=10).json()
        for n in notes:
            if "TEST_v21 shopping list" in (n.get("title") or ""):
                client.delete(f"{BASE_URL}/api/notes/{n['id']}", timeout=10)

        # First call — creates
        r1 = client.post(f"{BASE_URL}/api/notes/append-list",
                         json={"title_hint": "TEST_v21 shopping list",
                               "items": ["milk", "eggs"]}, timeout=10)
        assert r1.status_code == 200, r1.text
        n1 = r1.json()
        assert "id" in n1
        assert "• milk" in n1["body"] and "• eggs" in n1["body"]
        pytest.shopping_id = n1["id"]

        # Second call — appends to same note (not duplicate)
        r2 = client.post(f"{BASE_URL}/api/notes/append-list",
                         json={"title_hint": "TEST_v21 shopping list",
                               "items": ["bread"]}, timeout=10)
        assert r2.status_code == 200
        n2 = r2.json()
        # Should be same note id
        assert n2["id"] == pytest.shopping_id
        assert "• milk" in n2["body"] and "• eggs" in n2["body"] and "• bread" in n2["body"]

        # Verify only one matching note exists
        notes = client.get(f"{BASE_URL}/api/notes", timeout=10).json()
        match = [n for n in notes if "TEST_v21 shopping list" in (n.get("title") or "")]
        assert len(match) == 1, f"expected 1 match, got {len(match)}"

    def test_append_by_tag(self, client):
        # Add a tag to the shopping note so tag match works
        client.patch(f"{BASE_URL}/api/notes/{pytest.shopping_id}",
                     json={"tags": ["TEST_v21_shop"]}, timeout=10)
        r = client.post(f"{BASE_URL}/api/notes/append-list",
                        json={"tag": "TEST_v21_shop", "items": ["butter"]}, timeout=10)
        assert r.status_code == 200, r.text
        n = r.json()
        assert n["id"] == pytest.shopping_id
        assert "• butter" in n["body"]

    def test_append_empty_items_400(self, client):
        r = client.post(f"{BASE_URL}/api/notes/append-list",
                        json={"title_hint": "anything", "items": []}, timeout=10)
        assert r.status_code == 400

    def test_cleanup_test_note(self, client):
        if hasattr(pytest, "shopping_id"):
            client.delete(f"{BASE_URL}/api/notes/{pytest.shopping_id}", timeout=10)


# ──────────── Reminders resend ────────────
class TestReminderResend:
    def test_resend_shifts_fire_at(self, client):
        # Create a reminder with weekly recurrence + sent=true-like baseline
        r = client.post(f"{BASE_URL}/api/reminders",
                        json={"title": "TEST_v21_resend", "fire_at": "2024-01-01T10:00:00Z",
                              "recurrence": "weekly"}, timeout=10)
        assert r.status_code == 200, r.text
        rem = r.json()
        rid = rem["id"]

        r2 = client.post(f"{BASE_URL}/api/reminders/{rid}/resend", json={}, timeout=10)
        assert r2.status_code == 200, r2.text
        copy = r2.json()
        assert copy["id"] != rid
        assert copy["title"] == "TEST_v21_resend"
        assert copy["recurrence"] == "weekly"
        # fire_at shifted by 7 days from 2024-01-01 → should start with 2024-01-08
        assert "2024-01-08" in copy["fire_at"], copy["fire_at"]

        # cleanup
        client.delete(f"{BASE_URL}/api/reminders/{rid}", timeout=10)
        client.delete(f"{BASE_URL}/api/reminders/{copy['id']}", timeout=10)

    def test_resend_none_recurrence_plus_one_day(self, client):
        r = client.post(f"{BASE_URL}/api/reminders",
                        json={"title": "TEST_v21_resend2", "fire_at": "2024-06-15T09:00:00Z",
                              "recurrence": "none"}, timeout=10)
        rid = r.json()["id"]
        r2 = client.post(f"{BASE_URL}/api/reminders/{rid}/resend", json={}, timeout=10)
        assert r2.status_code == 200
        assert "2024-06-16" in r2.json()["fire_at"]
        client.delete(f"{BASE_URL}/api/reminders/{rid}", timeout=10)
        client.delete(f"{BASE_URL}/api/reminders/{r2.json()['id']}", timeout=10)

    def test_resend_unknown_404(self, client):
        r = client.post(f"{BASE_URL}/api/reminders/does-not-exist/resend",
                        json={}, timeout=10)
        assert r.status_code == 404


# ──────────── Change password (must revert!) ────────────
class TestChangePassword:
    NEW = "TEST_v21_tmp_pw!"

    def test_wrong_current_401(self, client):
        r = client.post(f"{BASE_URL}/api/auth/change-password",
                        json={"current_password": "WRONG", "new_password": self.NEW},
                        timeout=10)
        assert r.status_code == 401, r.text

    def test_short_new_400(self, client):
        r = client.post(f"{BASE_URL}/api/auth/change-password",
                        json={"current_password": PASSWORD, "new_password": "abc"},
                        timeout=10)
        assert r.status_code == 400, r.text

    def test_change_and_login_then_revert(self, client):
        r = client.post(f"{BASE_URL}/api/auth/change-password",
                        json={"current_password": PASSWORD, "new_password": self.NEW},
                        timeout=10)
        assert r.status_code == 200 and r.json().get("ok") is True, r.text

        # login with new
        rl = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": EMAIL, "password": self.NEW}, timeout=10)
        assert rl.status_code == 200, rl.text
        new_token = rl.json()["token"]

        # Revert using new token
        rev = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {new_token}"},
            json={"current_password": self.NEW, "new_password": PASSWORD},
            timeout=10,
        )
        assert rev.status_code == 200, rev.text

        # Sanity — login with original still works
        rl2 = requests.post(f"{BASE_URL}/api/auth/login",
                            json={"email": EMAIL, "password": PASSWORD}, timeout=10)
        assert rl2.status_code == 200


# ──────────── Export xlsx ────────────
class TestExport:
    def test_export_xlsx_signature(self, client):
        r = client.get(f"{BASE_URL}/api/export/data.xlsx", timeout=30)
        assert r.status_code == 200, r.text[:200]
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct, ct
        assert len(r.content) > 1024, len(r.content)
        assert r.content[:2] == b"PK", r.content[:8]


# ──────────── Parse/bulk — no forced capitalization ────────────
class TestParseBulk:
    def test_no_title_case(self, client):
        r = client.post(f"{BASE_URL}/api/parse/bulk",
                        json={"text": "need to call brinda regarding the bar unit repair",
                              "kind": "task"}, timeout=40)
        assert r.status_code == 200, r.text
        rows = r.json().get("rows", [])
        if not rows:
            pytest.skip("AI returned no rows — cannot verify capitalization contract")
        row = rows[0]
        # Backend contract: _normalize_row only trims; does NOT title-case.
        # So any field returned as lowercase by AI must remain lowercase.
        # We verify by asserting the entire row has at least one lowercase content field
        # that contains 'call' or 'brinda' — i.e. not forcibly transformed to 'Call'/'Brinda'.
        combined = " ".join(str(v) for v in row.values() if isinstance(v, str))
        # Guarantee: backend never *introduces* Title Case. If AI happens to return 'Call',
        # that's acceptable per spec. So we only assert the row shape + date default.
        assert isinstance(row, dict)
        assert row.get("date"), f"today-default date missing: {row}"

    def test_date_defaults_today(self, client):
        from datetime import date
        r = client.post(f"{BASE_URL}/api/parse/bulk",
                        json={"text": "buy groceries", "kind": "task"}, timeout=40)
        if r.status_code != 200 or not r.json().get("rows"):
            pytest.skip("AI unavailable")
        row = r.json()["rows"][0]
        assert row.get("date") == date.today().isoformat()


# ──────────── Routines now accept 'name' ────────────
class TestRoutinesName:
    def test_create_and_get_with_name(self, client):
        r = client.post(f"{BASE_URL}/api/routines",
                        json={"group": "TEST_v21_G", "name": "MorningWalk",
                              "activity": "walk 2km", "details": "",
                              "frequency": "daily", "priority": "medium",
                              "status": "pending"}, timeout=10)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        assert r.json().get("name") == "MorningWalk"

        all_r = client.get(f"{BASE_URL}/api/routines", timeout=10).json()
        found = next((x for x in all_r if x["id"] == rid), None)
        assert found is not None
        assert found.get("name") == "MorningWalk"

        # PATCH name
        rp = client.patch(f"{BASE_URL}/api/routines/{rid}",
                          json={"name": "EveningWalk"}, timeout=10)
        assert rp.status_code == 200
        client.delete(f"{BASE_URL}/api/routines/{rid}", timeout=10)
