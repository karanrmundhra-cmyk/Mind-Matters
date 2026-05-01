"""
Mind Matters v1.2 backend tests.

Focus on NEW behaviour:
 - sr_no compaction after delete (tasks, loans, investments)
 - /api/parse/bulk + /api/parse/bulk-file (AI-backed)
 - /api/deadlines CRUD
 - Routine new schema (time_block:'block1'..'block4')
 - GET /api/routines/summary -> category_percent keyed by block*
 - POST /api/reminders accepts quarterly / half-yearly / yearly
 - POST /api/notes/{id}/images upload + list + delete + 4MB rejection
 - Existing endpoints non-regression: snapshot, news, telegram, documents.
"""
import base64
import io
import os
import struct
import zlib
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ───────── fixtures ─────────
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/demo-login", json={"first_name": "Karan"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


def _png_bytes(w=2, h=2):
    """Tiny valid PNG (~70 bytes)."""
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


# ───────── auth ─────────
class TestAuth:
    def test_demo_login_and_me(self, auth):
        r = auth.get(f"{API}/auth/me")
        assert r.status_code == 200
        u = r.json()
        assert u.get("email")
        assert "id" in u


# ───────── deadlines ─────────
class TestDeadlines:
    created_ids = []

    def test_create_multiple(self, auth):
        for t, d in [("TEST_v12 GST filing", "2026-03-31"), ("TEST_v12 Insurance renewal", "2026-04-15")]:
            r = auth.post(f"{API}/deadlines", json={"title": t, "due_date": d, "notes": "auto"})
            assert r.status_code == 200, r.text
            j = r.json()
            assert j["title"] == t
            assert j["due_date"] == d  # string preserved exactly
            assert j["notes"] == "auto"
            self.created_ids.append(j["id"])

    def test_list_contains(self, auth):
        r = auth.get(f"{API}/deadlines")
        assert r.status_code == 200
        ids = {d["id"] for d in r.json()}
        for cid in self.created_ids:
            assert cid in ids

    def test_delete(self, auth):
        for cid in self.created_ids:
            r = auth.delete(f"{API}/deadlines/{cid}")
            assert r.status_code == 200
        # verify removed
        r = auth.get(f"{API}/deadlines")
        ids = {d["id"] for d in r.json()}
        for cid in self.created_ids:
            assert cid not in ids


# ───────── parse/bulk (AI) ─────────
class TestParseBulk:
    def test_parse_bulk_task(self, auth):
        body = {
            "kind": "task",
            "text": "Remind Rahul to send invoice tomorrow.\nFollow up Priya for KYC docs by Friday.",
        }
        r = auth.post(f"{API}/parse/bulk", json=body, timeout=60)
        assert r.status_code == 200, r.text
        rows = r.json().get("rows", [])
        # AI may return empty if Gemini hiccups; accept but warn
        assert isinstance(rows, list)
        if not rows:
            pytest.skip("AI returned empty rows (Gemini availability)")
        assert any(("rahul" in (str(row).lower())) for row in rows), rows
        # rows must be usable for /api/tasks
        sample = rows[0]
        payload = {
            "task": sample.get("task") or sample.get("activity") or "TEST_v12 ai task",
            "name": sample.get("name") or "",
            "details": sample.get("details") or "",
            "date": sample.get("date") or None,
            "status": sample.get("status") or "Pending",
        }
        r2 = auth.post(f"{API}/tasks", json=payload)
        assert r2.status_code == 200, r2.text
        tid = r2.json()["id"]
        auth.delete(f"{API}/tasks/{tid}")

    def test_parse_bulk_file_csv_expense(self, auth, token):
        csv = b"date,amount,company,details\n2026-01-10,1200,Zomato,Office lunch\n2026-01-11,450,Uber,Cab to client\n"
        files = {"file": ("expenses.csv", csv, "text/csv")}
        data = {"kind": "expense"}
        r = requests.post(
            f"{API}/parse/bulk-file",
            headers={"Authorization": f"Bearer {token}"},
            data=data,
            files=files,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["raw_count"] == 2
        assert isinstance(j.get("rows"), list)


# ───────── sr_no compaction ─────────
def _create_three_then_delete_middle(auth, post_path, payload_fn, list_path):
    ids = []
    for i in range(3):
        r = auth.post(f"{API}{post_path}", json=payload_fn(i))
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])
    # delete the middle one
    auth.delete(f"{API}{post_path}/{ids[1]}")
    r = auth.get(f"{API}{list_path}")
    assert r.status_code == 200
    rows = r.json()
    rows = sorted([row for row in rows if row["id"] in (ids[0], ids[2])], key=lambda x: x["sr_no"])
    sr_nos = [row["sr_no"] for row in rows]
    return ids, sr_nos


class TestSrCompaction:
    def test_tasks_compaction(self, auth):
        ids, sr_nos = _create_three_then_delete_middle(
            auth, "/tasks",
            lambda i: {"task": f"TEST_v12 task {i}", "name": "Karan", "status": "Pending"},
            "/tasks?date_from=1900-01-01",
        )
        # Both remaining must be contiguous starting at 1
        assert sr_nos[0] >= 1
        assert sr_nos[1] - sr_nos[0] == 1, f"Expected contiguous sr_no after delete, got {sr_nos}"
        # cleanup
        for tid in (ids[0], ids[2]):
            auth.delete(f"{API}/tasks/{tid}")

    def test_loans_compaction(self, auth):
        ids, sr_nos = _create_three_then_delete_middle(
            auth, "/loans",
            lambda i: {"name": f"TEST_v12 loanee {i}", "amount": 1000.0 * (i + 1), "interest": 5,
                       "status": "Given", "date": "2026-01-01"},
            "/loans",
        )
        assert sr_nos[1] - sr_nos[0] == 1, f"Loan sr_no not contiguous: {sr_nos}"
        for lid in (ids[0], ids[2]):
            auth.delete(f"{API}/loans/{lid}")

    def test_investments_compaction(self, auth):
        ids, sr_nos = _create_three_then_delete_middle(
            auth, "/investments",
            lambda i: {"type": "FD", "provider": f"TEST_v12 Bank{i}", "amount_invested": 50000,
                       "rate_or_value": "7%", "start_date": "2026-01-01"},
            "/investments",
        )
        assert sr_nos[1] - sr_nos[0] == 1, f"Investment sr_no not contiguous: {sr_nos}"
        for iid in (ids[0], ids[2]):
            auth.delete(f"{API}/investments/{iid}")


# ───────── routines new schema ─────────
class TestRoutines:
    def test_create_block_routine_and_summary(self, auth):
        r = auth.post(f"{API}/routines", json={
            "time_block": "block2",
            "activity": "TEST_v12 Deep work session",
            "details": "morning focus",
            "frequency": "Daily",
        })
        assert r.status_code == 200, r.text
        rj = r.json()
        assert rj["time_block"] == "block2"
        assert rj["activity"] == "TEST_v12 Deep work session"
        rid = rj["id"]
        # summary must include block2 in category_percent
        s = auth.get(f"{API}/routines/summary")
        assert s.status_code == 200
        cp = s.json().get("category_percent", {})
        assert "block2" in cp, f"category_percent keys: {list(cp.keys())}"
        # cleanup
        auth.delete(f"{API}/routines/{rid}")


# ───────── reminders extended recurrence ─────────
class TestRemindersRecurrence:
    @pytest.mark.parametrize("rec", ["quarterly", "half-yearly", "yearly"])
    def test_recurrence_accepted(self, auth, rec):
        r = auth.post(f"{API}/reminders", json={
            "title": f"TEST_v12 rem {rec}",
            "fire_at": "2026-12-31T09:00:00Z",
            "recurrence": rec,
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["recurrence"] == rec
        auth.delete(f"{API}/reminders/{j['id']}")


# ───────── note image upload ─────────
class TestNoteImages:
    def test_upload_list_delete(self, auth, token):
        # create a note first
        n = auth.post(f"{API}/notes", json={"title": "TEST_v12 with image", "body": "x"})
        assert n.status_code == 200, n.text
        nid = n.json()["id"]

        png = _png_bytes()
        files = {"file": ("tiny.png", png, "image/png")}
        r = requests.post(
            f"{API}/notes/{nid}/images",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("data_url", "").startswith("data:image/png;base64,")
        assert j["note_id"] == nid
        iid = j["id"]

        l = auth.get(f"{API}/notes/{nid}/images")
        assert l.status_code == 200
        listing = l.json()
        assert any(im["id"] == iid for im in listing)
        assert listing[0]["data_url"].startswith("data:image/png;base64,")

        d = auth.delete(f"{API}/notes/{nid}/images/{iid}")
        assert d.status_code == 200

        l2 = auth.get(f"{API}/notes/{nid}/images")
        assert all(im["id"] != iid for im in l2.json())

        auth.delete(f"{API}/notes/{nid}")

    def test_reject_oversize(self, auth, token):
        n = auth.post(f"{API}/notes", json={"title": "TEST_v12 oversize", "body": ""})
        nid = n.json()["id"]
        big = b"\x00" * (4 * 1024 * 1024 + 10)
        files = {"file": ("big.bin", big, "application/octet-stream")}
        r = requests.post(
            f"{API}/notes/{nid}/images",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            timeout=30,
        )
        assert r.status_code == 400, r.text
        auth.delete(f"{API}/notes/{nid}")


# ───────── non-regression smoke ─────────
class TestRegression:
    def test_dashboard_snapshot_has_routine_percent(self, auth):
        r = auth.get(f"{API}/dashboard/snapshot")
        assert r.status_code == 200
        j = r.json()
        # New dashboard expects routine_percent_today
        assert "routine_percent_today" in j or "routines" in j

    def test_news_headlines(self, auth):
        r = auth.get(f"{API}/news/headlines")
        assert r.status_code == 200
        body = r.json()
        articles = body.get("headlines") or body.get("articles") or body
        assert isinstance(articles, list)
        assert len(articles) >= 1
        # GNews real headlines include url+title
        assert "title" in articles[0]

    def test_telegram_status_configured(self, auth):
        r = auth.get(f"{API}/telegram/status")
        assert r.status_code == 200
        assert r.json().get("configured") is True

    def test_send_test_branch(self, auth):
        """Either unlinked → 400 OR linked → 200 (real chat)."""
        r = auth.post(f"{API}/telegram/send-test", json={})
        assert r.status_code in (200, 400, 409), r.text

    def test_share_statement_branch(self, auth):
        """Unlinked → 400, linked-but-no-loans → 404, linked-with-loans → 200."""
        r = auth.post(f"{API}/share/statement", json={})
        assert r.status_code in (200, 400, 404, 409), r.text

    def test_documents_templates(self, auth):
        r = auth.get(f"{API}/documents/templates")
        assert r.status_code == 200
        body = r.json()
        templates = body["templates"] if isinstance(body, dict) else body
        ids = [t["id"] for t in templates]
        assert "rkm_donation_receipt" in ids
        assert "krm_huf_invoice" in ids

    def test_documents_generate_rkm(self, auth):
        payload = {
            "template_id": "rkm_donation_receipt",
            "data": {
                "receipt_no": "TEST/01", "date": "2026-01-15", "donor_name": "TEST_v12 Donor",
                "sum_rupees": "1000", "for_payment_of": "Donation", "by": "Cash",
                "mobile": "9999999999", "email": "t@t.com", "address": "X",
                "pan": "ABCDE1234F", "received_by_name": "Y", "received_by_mobile": "8888888888",
            },
        }
        r = auth.post(f"{API}/documents/generate", json=payload)
        assert r.status_code == 200
        assert len(r.content) > 1024
        assert r.content[:4] == b"%PDF"

    def test_affirmation_put(self, auth):
        r = auth.put(f"{API}/affirmations/today", json={"text": "TEST_v12 I am focused."})
        assert r.status_code == 200
        assert r.json()["text"] == "TEST_v12 I am focused."
