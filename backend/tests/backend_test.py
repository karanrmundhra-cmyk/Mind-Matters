"""Mind Matters backend test suite (pytest)."""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://command-center-368.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    r = session.post(f"{API}/auth/demo-login", json={"first_name": "Arjun"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    return data


@pytest.fixture(scope="session")
def client(session, auth):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {auth['token']}"})
    return s


# ---------- Health & Auth ----------
def test_healthcheck(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_auth_me(client, auth):
    r = client.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["id"] == auth["user"]["id"]


def test_auth_unauthenticated_blocked(session):
    r = session.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---------- Tasks ----------
def test_tasks_crud(client):
    payload = {"name": "Rahul", "task": "TEST_send invoice", "details": "TEST", "status": "Pending"}
    r = client.post(f"{API}/tasks", json=payload)
    assert r.status_code == 200, r.text
    t = r.json()
    tid = t["id"]
    assert t["task"] == "TEST_send invoice"
    assert t["sr_no"] >= 1

    # list with filter
    r = client.get(f"{API}/tasks", params={"status": "Pending"})
    assert r.status_code == 200
    assert any(x["id"] == tid for x in r.json())

    # patch
    r = client.patch(f"{API}/tasks/{tid}", json={"status": "Done"})
    assert r.status_code == 200
    assert r.json()["status"] == "Done"

    # bulk
    r = client.post(f"{API}/tasks/bulk", json=[
        {"task": "TEST_a", "name": "X"}, {"task": "TEST_b", "name": "Y"}
    ])
    assert r.status_code == 200
    assert len(r.json()) == 2
    bulk_ids = [x["id"] for x in r.json()]

    # delete
    for x in [tid] + bulk_ids:
        rd = client.delete(f"{API}/tasks/{x}")
        assert rd.status_code == 200


# ---------- Routines ----------
def test_routines_and_summary(client):
    r = client.post(f"{API}/routines", json={"category": "Health", "activity": "TEST_meditate"})
    assert r.status_code == 200
    rid = r.json()["id"]

    r = client.get(f"{API}/routines")
    assert r.status_code == 200 and any(x["id"] == rid for x in r.json())

    # log it
    r = client.post(f"{API}/routine-logs", json={"routine_id": rid, "done": True})
    assert r.status_code == 200

    r = client.get(f"{API}/routines/summary")
    assert r.status_code == 200
    s = r.json()
    for k in ("percent_today", "category_percent", "per_routine"):
        assert k in s
    assert rid in s["per_routine"]
    assert s["per_routine"][rid]["done_today"] is True
    assert s["per_routine"][rid]["streak"] >= 1

    client.delete(f"{API}/routines/{rid}")


# ---------- Loans ----------
def test_loans_and_summary(client):
    r = client.post(f"{API}/loans", json={
        "name": "TEST_Friend", "amount": 10000, "interest": 12, "status": "Given",
        "date": "2024-06-01"
    })
    assert r.status_code == 200, r.text
    lid = r.json()["id"]

    r = client.get(f"{API}/loans")
    assert r.status_code == 200
    found = next((x for x in r.json() if x["id"] == lid), None)
    assert found and "accrued_interest" in found and found["accrued_interest"] > 0

    r = client.get(f"{API}/loans/summary")
    assert r.status_code == 200
    s = r.json()
    for k in ("total_given", "total_taken", "net_exposure", "total_interest_accrued"):
        assert k in s

    client.delete(f"{API}/loans/{lid}")


# ---------- Transactions ----------
def test_transactions_crud_and_summary(client):
    r = client.post(f"{API}/transactions", json={
        "amount": 250, "company": "TEST_Cafe", "expense_head": "Food", "direction": "out",
        "date": time.strftime("%Y-%m-%d")
    })
    assert r.status_code == 200
    txid = r.json()["id"]

    month = time.strftime("%Y-%m")
    r = client.get(f"{API}/transactions", params={"month": month})
    assert r.status_code == 200
    assert any(x["id"] == txid for x in r.json())

    r = client.patch(f"{API}/transactions/{txid}", json={"amount": 300})
    assert r.status_code == 200 and r.json()["amount"] == 300

    r = client.get(f"{API}/transactions/summary", params={"month": month})
    assert r.status_code == 200
    s = r.json()
    for k in ("top_expense_heads", "change_vs_prev_month_percent", "total_out", "total_in"):
        assert k in s

    client.delete(f"{API}/transactions/{txid}")


def test_transactions_upload_csv(client):
    csv_data = (
        "date,amount,company,expense_head,direction\n"
        "2025-01-15,500,TEST_UberX,Travel,out\n"
        "2025-01-16,1200,TEST_Salary Co,Salary,in\n"
    )
    files = {"file": ("test.csv", csv_data, "text/csv")}
    headers = {"Authorization": client.headers["Authorization"]}
    r = requests.post(f"{API}/transactions/upload", files=files, data={"account": "Personal"}, headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "inserted" in body
    # cleanup any inserted
    for tx in body.get("transactions", []):
        client.delete(f"{API}/transactions/{tx['id']}")


# ---------- Investments ----------
def test_investments(client):
    r = client.post(f"{API}/investments", json={
        "type": "MF", "provider": "TEST_Fund", "amount_invested": 50000, "current_value": 55000
    })
    assert r.status_code == 200
    iid = r.json()["id"]

    r = client.get(f"{API}/investments/summary")
    assert r.status_code == 200
    s = r.json()
    for k in ("total_invested", "total_value", "allocation", "growth_percent"):
        assert k in s

    client.delete(f"{API}/investments/{iid}")


# ---------- Notes ----------
def test_notes_crud_search_pin(client):
    r = client.post(f"{API}/notes", json={
        "title": "TEST_n1", "body": "alpha beta gamma", "tags": ["test", "alpha"], "pinned": False
    })
    assert r.status_code == 200
    nid = r.json()["id"]

    r = client.get(f"{API}/notes", params={"q": "beta"})
    assert r.status_code == 200 and any(x["id"] == nid for x in r.json())

    r = client.get(f"{API}/notes", params={"tag": "alpha"})
    assert r.status_code == 200 and any(x["id"] == nid for x in r.json())

    r = client.patch(f"{API}/notes/{nid}", json={"pinned": True})
    assert r.status_code == 200 and r.json()["pinned"] is True

    client.delete(f"{API}/notes/{nid}")


# ---------- Affirmations ----------
def test_affirmations(client):
    r = client.get(f"{API}/affirmations/today")
    assert r.status_code == 200
    r = client.put(f"{API}/affirmations/today", json={"text": "TEST_ok"})
    assert r.status_code == 200 and r.json()["text"] == "TEST_ok"


# ---------- Dashboard / Weather / News ----------
def test_dashboard_snapshot(client):
    r = client.get(f"{API}/dashboard/snapshot")
    assert r.status_code == 200
    s = r.json()
    for k in ("pending_tasks_count", "routine_percent_today", "insights"):
        assert k in s


def test_weather(session):
    r = session.get(f"{API}/weather")
    assert r.status_code == 200
    assert r.status_code != 500


def test_news(session):
    r = session.get(f"{API}/news/headlines")
    assert r.status_code == 200
    assert "headlines" in r.json()


# ---------- AI ----------
def test_ai_chat(client):
    r = client.post(f"{API}/ai/chat", json={"message": "Say hi in 3 words"}, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body.get("reply"), str) and len(body["reply"].strip()) > 0


def test_ai_parse_task(client):
    r = client.post(f"{API}/ai/parse",
                    json={"text": "Remind Rahul to send invoice tomorrow", "kind": "task"},
                    timeout=60)
    assert r.status_code == 200
    body = r.json()
    assert "parsed" in body
    # Either parsed dict OR raw must contain something usable
    assert body["parsed"] is not None or body.get("raw")
