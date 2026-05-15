"""Telegram bot helper + polling + reminder scheduler for Mind Matters.

Uses long polling against api.telegram.org (no webhook needed).
Features:
  - /start <code>   → links user's Telegram chat to their Mind Matters account
  - plain text      → AI parses → confirmation (Yes/No) inline buttons → save on Yes
                       Special queries: "pending tasks of <person>", "loan statement of <person>",
                       "cash flow", "this month expenses" → reply with PDF.
  - photo / receipt → Gemini multimodal extracts amount + merchant + date → confirmation buttons
  - outbound        → tg_send, tg_send_document
  - reminders       → every 30s, scans reminders collection and pings user
"""
import asyncio
import base64
import json as _json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

logger = logging.getLogger("mind-matters.tg")

TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TG_API = f"https://api.telegram.org/bot{TG_TOKEN}" if TG_TOKEN else ""


# ───────────────────────── outbound helpers ─────────────────────────
async def tg_send(chat_id, text, parse_mode=None, reply_markup=None):
    if not TG_TOKEN or not chat_id:
        return None
    payload = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        async with httpx.AsyncClient(timeout=10) as cli:
            r = await cli.post(f"{TG_API}/sendMessage", json=payload)
            return r.json()
    except Exception as e:
        logger.warning(f"tg_send: {e}")
        return None


async def tg_send_document(chat_id, filename: str, content: bytes, caption: str = ""):
    if not TG_TOKEN or not chat_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as cli:
            files = {"document": (filename, content, "application/pdf")}
            data = {"chat_id": str(chat_id), "caption": caption or ""}
            r = await cli.post(f"{TG_API}/sendDocument", data=data, files=files)
            return r.json()
    except Exception as e:
        logger.warning(f"tg_send_document: {e}")
        return None


async def tg_answer_callback(callback_id: str, text: str = ""):
    if not TG_TOKEN or not callback_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as cli:
            r = await cli.post(
                f"{TG_API}/answerCallbackQuery",
                json={"callback_query_id": callback_id, "text": text or ""},
            )
            return r.json()
    except Exception as e:
        logger.warning(f"tg_answer_callback: {e}")
        return None


async def tg_edit_message_text(chat_id, message_id, text):
    if not TG_TOKEN:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as cli:
            r = await cli.post(
                f"{TG_API}/editMessageText",
                json={"chat_id": chat_id, "message_id": message_id, "text": text,
                      "disable_web_page_preview": True},
            )
            return r.json()
    except Exception as e:
        logger.warning(f"tg_edit_message_text: {e}")
        return None


async def tg_download_file(file_id: str) -> bytes:
    if not TG_TOKEN:
        return b""
    async with httpx.AsyncClient(timeout=30) as cli:
        r = await cli.get(f"{TG_API}/getFile", params={"file_id": file_id})
        data = r.json()
        if not data.get("ok"):
            return b""
        path = data["result"]["file_path"]
        f = await cli.get(f"https://api.telegram.org/file/bot{TG_TOKEN}/{path}")
        return f.content


# ───────────────────────── Gemini receipt OCR ─────────────────────────
async def _extract_expense_from_image(image_bytes: bytes, caption: str = "") -> dict:
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        logger.warning(f"emergentintegrations unavailable: {e}")
        return {}
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return {}
    b64 = base64.b64encode(image_bytes).decode("ascii")
    sys_msg = (
        "You read a photographed receipt or bill. Return ONLY a JSON object with keys: "
        "{kind:'expense', date:'YYYY-MM-DD' or null, amount:number, "
        "expense_head (Food/Travel/Utilities/Rent/Groceries/Salary/Misc/etc.), "
        "company (merchant name), mode ('Card'|'Cash'|'UPI'|'Bank'), "
        "direction:'out', notes (1 short line)}. "
        "If a value is unclear, set null. Use INR. Do not add prose."
    )
    chat = LlmChat(api_key=api_key, session_id=f"recipt-{datetime.now().timestamp()}",
                   system_message=sys_msg).with_model("gemini", "gemini-3-flash-preview")
    msg = UserMessage(
        text=f"User caption: {caption or '(none)'}",
        file_contents=[ImageContent(image_base64=b64)],
    )
    try:
        resp = await chat.send_message(msg)
    except Exception as e:
        logger.warning(f"Gemini multimodal failed: {e}")
        return {}
    t = (resp or "").strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.startswith("json"):
            t = t[4:]
    try:
        data = _json.loads(t)
        if isinstance(data, dict):
            return data
    except Exception:
        logger.warning(f"receipt JSON parse failed: {t[:200]}")
    return {}


# ───────────────────────── Confirmation pending store ─────────────────────────
async def _save_pending(db, chat_id, user_id, kind, parsed):
    """Stash a parsed entry waiting for Yes/No confirmation. Returns id."""
    import uuid as _uuid
    pid = _uuid.uuid4().hex[:10]
    await db.tg_pending.insert_one({
        "id": pid,
        "user_id": user_id,
        "chat_id": chat_id,
        "kind": kind,
        "parsed": parsed,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return pid


def _confirm_kbd(pid):
    return {
        "inline_keyboard": [[
            {"text": "✓ Add", "callback_data": f"yes:{pid}"},
            {"text": "✗ Discard", "callback_data": f"no:{pid}"},
        ]]
    }


def _format_preview(kind, p):
    if kind == "task":
        bits = [f"📋 *Task*"]  # noqa: F541
        if p.get("name"):
            bits.append(f"For: {p['name']}")
        bits.append(f"Task: {p.get('task') or '?'}")
        if p.get("details"):
            bits.append(f"Details: {p['details']}")
        if p.get("date"):
            bits.append(f"Date: {p['date']}")
        bits.append(f"Status: {p.get('status') or 'Pending'}")
        return "\n".join(bits)
    if kind == "expense":
        amt = p.get("amount", "?")
        try:
            amt = f"₹{float(amt):,.0f}"
        except Exception:
            pass
        head = p.get("expense_head") or "Uncategorized"
        co = p.get("company") or ""
        d = p.get("date") or "today"
        dirn = p.get("direction") or "out"
        return (f"💰 *Expense*\n"
                f"{amt} · {head}{' · ' + co if co else ''}\n"
                f"Date: {d} · Direction: {dirn}")
    if kind == "note":
        t = p.get("title") or "(untitled)"
        b = (p.get("body") or "")[:120]
        return f"📝 *Note*\n{t}{chr(10) + b if b else ''}"
    if kind.startswith("delete_"):
        res = kind.split("_", 1)[1]
        sr = p.get("sr_no")
        label = (p.get("task") or p.get("activity") or p.get("vendor")
                 or p.get("details") or "(unknown)")
        return f"🗑 *Delete {res}* #{sr}\n{label}"
    if kind == "update_task":
        sr = p.get("sr_no")
        label = p.get("task") or "(task)"
        return f"✓ *Complete task* #{sr}\n{label}"
    return f"_{kind}_\n{_json.dumps(p, default=str)[:300]}"


# ───────────────────────── Statement query parsing ─────────────────────────
def _clean_name(raw: str) -> str:
    """Strip trailing possessive 's' / apostrophe-s and Title-Case."""
    n = raw.strip().rstrip("'’")
    # If the captured token ends in a bare 's' and stripping it yields a sensible name,
    # drop it (e.g. "brindas" → "Brinda"). Skip when the name is short or already Title-Case singular.
    if len(n) > 3 and n.lower().endswith("s") and not n.lower().endswith("ss"):
        n = n[:-1]
    return n.strip().title()


def _detect_statement_query(text: str):
    """If user asked for a statement, return (kind, person_or_month). Else None."""
    if not text:
        return None
    t = text.lower().strip().rstrip("?.!")
    # Strip leading question/imperative starters so the rest of the regexes match.
    t = re.sub(r"^(what(?:'s| is| are)?|show|list|give\s+me|tell\s+me|give|fetch|get|pull|find)\s+(me\s+)?", "", t)
    t = re.sub(r"^(the\s+)?", "", t)
    # tasks/pending of NAME
    m = re.search(r"(?:pending|open|all)?\s*tasks?\s+(?:of|for)\s+([a-z][a-z .'-]{1,40})", t)
    if m:
        return ("tasks", _clean_name(m.group(1)))
    # NAME's tasks  /  NAMEs tasks
    m = re.search(r"^([a-z][a-z .'-]{1,40})['']?s?\s+(?:pending\s+)?tasks?$", t)
    if m:
        return ("tasks", _clean_name(m.group(1)))
    # NAME tasks (loose match — only when text is short)
    if len(t.split()) <= 4:
        m = re.search(r"^([a-z][a-z .'-]{1,40})\s+(?:pending\s+)?tasks?$", t)
        if m:
            return ("tasks", _clean_name(m.group(1)))
    # loan statement of NAME
    m = re.search(r"loan\s+(?:statement|summary|report|details?)\s+(?:of|for)\s+([a-z][a-z .'-]{1,40})", t)
    if m:
        return ("loan", _clean_name(m.group(1)))
    m = re.search(r"(?:statement|loan)s?\s+(?:of|for)\s+([a-z][a-z .'-]{1,40})", t)
    if m:
        return ("loan", _clean_name(m.group(1)))
    m = re.search(r"^([a-z][a-z .'-]{1,40})['']?s?\s+(?:loan|loans)\s+(?:statement|summary)?$", t)
    if m:
        return ("loan", _clean_name(m.group(1)))
    # cash flow / expenses this month
    if any(p in t for p in ("cash flow", "this month expenses", "month expenses",
                            "expense statement", "expense summary",
                            "monthly expense", "spending this month")):
        return ("transactions", None)
    return None


async def _generate_statement_pdf(db, user, kind: str, name=None, month=None):
    """Reuse the same logic as /api/share/statement but in-process."""
    # Lazy import to avoid circular at startup
    from docs_gen import render_simple_statement
    from datetime import date as _date

    def _accrued(amount, rate, start_iso, itype="percent"):
        if not start_iso or not rate:
            return 0.0
        if itype == "fixed":
            return round(float(rate), 2)
        try:
            s = (datetime.fromisoformat(start_iso).date()
                 if "T" in start_iso else _date.fromisoformat(start_iso))
        except Exception:
            return 0.0
        days = (datetime.now(timezone.utc).date() - s).days
        if days <= 0:
            return 0.0
        return round(amount * (rate / 100.0) * (days / 365.0), 2)

    if kind == "loan":
        q = {"user_id": user["id"]}
        if name:
            q["name"] = {"$regex": f"^{name}$", "$options": "i"}
        loans = await db.loans.find(q, {"_id": 0}).sort("date", 1).to_list(1000)
        if not loans:
            return None, None
        rows, tg, tt, ti = [], 0, 0, 0
        for l in loans:
            acc = _accrued(l["amount"], l.get("interest", 0), l.get("date"),
                           l.get("interest_type", "percent"))
            rows.append([
                str(l.get("sr_no")), l.get("date", ""), l["name"], l["status"],
                f"₹ {l['amount']:,.0f}",
                (f"{l.get('interest', 0)}%" if l.get("interest_type", "percent") == "percent"
                 else f"₹ {l.get('interest', 0):,.0f} flat"),
                f"₹ {acc:,.0f}", l.get("repayment_date") or "—",
            ])
            if l["status"] == "Given":
                tg += l["amount"]
            if l["status"] == "Taken":
                tt += l["amount"]
            ti += acc
        pdf = render_simple_statement(
            title=f"Loan Statement{' — ' + name if name else ''}",
            subtitle=f"{datetime.now().strftime('%d %b %Y')}",
            meta={"Records": len(loans), "Total Given": f"₹ {tg:,.0f}",
                  "Total Taken": f"₹ {tt:,.0f}", "Net": f"₹ {tg - tt:,.0f}",
                  "Accrued Interest": f"₹ {ti:,.0f}"},
            table_headers=["Sr", "Date", "Name", "Status", "Amount", "Rate", "Accrued", "Repay by"],
            table_rows=rows,
            footer="Generated by Mind Matters.",
        )
        fname = f"loan-statement{('-' + name) if name else ''}.pdf"
        return fname, pdf

    if kind == "tasks":
        q = {"user_id": user["id"]}
        if name:
            q["name"] = {"$regex": f"^{name}$", "$options": "i"}
        tasks = await db.tasks.find(q, {"_id": 0}).sort("sr_no", 1).to_list(2000)
        if not tasks:
            return None, None
        rows = [[str(t.get("sr_no")), t.get("date", ""), t.get("name", "") or "—",
                 t.get("task", ""), t.get("details", "") or "—", t.get("status", "")]
                for t in tasks]
        pdf = render_simple_statement(
            title=f"Tasks{' — ' + name if name else ''}",
            subtitle=f"{len(tasks)} task(s) · {datetime.now().strftime('%d %b %Y')}",
            meta={"Pending": sum(1 for t in tasks if t["status"] == "Pending"),
                  "Follow-Up": sum(1 for t in tasks if t["status"] == "Follow-Up"),
                  "Done": sum(1 for t in tasks if t["status"] == "Done")},
            table_headers=["Sr", "Date", "Person", "Task", "Details", "Status"],
            table_rows=rows,
            footer="Generated by Mind Matters.",
        )
        fname = f"tasks{('-' + name) if name else ''}.pdf"
        return fname, pdf

    if kind == "transactions":
        m = month or datetime.now(timezone.utc).strftime("%Y-%m")
        tx = await db.transactions.find(
            {"user_id": user["id"], "date": {"$regex": f"^{m}"}}, {"_id": 0}
        ).sort("date", 1).to_list(5000)
        if not tx:
            return None, None
        rows = [[t.get("date", ""), t.get("direction"), f"₹ {t['amount']:,.0f}",
                 t.get("expense_head", ""), t.get("company", ""), t.get("mode", "")] for t in tx]
        out = sum(t["amount"] for t in tx if t["direction"] == "out")
        inc = sum(t["amount"] for t in tx if t["direction"] == "in")
        pdf = render_simple_statement(
            title=f"Cash Flow — {m}",
            subtitle=f"{len(tx)} transactions · {datetime.now().strftime('%d %b %Y')}",
            meta={"Expense": f"₹ {out:,.0f}", "Income": f"₹ {inc:,.0f}",
                  "Net": f"₹ {inc - out:,.0f}"},
            table_headers=["Date", "Dir", "Amount", "Head", "Company", "Mode"],
            table_rows=rows,
            footer="Generated by Mind Matters.",
        )
        return f"cashflow-{m}.pdf", pdf

    return None, None


# ───────────────────────── handlers ─────────────────────────
async def _execute_pending(db, pending: dict, create_task_fn, create_expense_fn, create_note_fn):
    """Execute a saved pending action. Returns a user-facing confirmation string.

    Supports kinds: task / expense / note / delete_task / delete_routine /
    delete_expense / update_task (mark as Completed).
    """
    parsed = pending.get("parsed") or {}
    kind = pending.get("kind") or "note"
    user_id = pending.get("user_id")
    if kind == "task":
        await create_task_fn(user_id, parsed)
        return f"✓ Task added: {parsed.get('task','')}"
    if kind == "expense":
        await create_expense_fn(user_id, parsed)
        amt = parsed.get("amount", "?")
        try:
            amt = f"₹{float(amt):,.0f}"
        except Exception:
            pass
        return f"✓ Expense logged: {amt} · {parsed.get('expense_head','')}"
    if kind == "note":
        await create_note_fn(user_id, parsed)
        return "✓ Note saved"
    if kind in ("delete_task", "delete_routine", "delete_expense"):
        coll = {"delete_task": "tasks", "delete_routine": "routines",
                "delete_expense": "transactions"}[kind]
        rid = parsed.get("id")
        if rid:
            await db[coll].delete_one({"id": rid, "user_id": user_id})
            sr = parsed.get("sr_no")
            return f"🗑 Deleted {coll[:-1]} #{sr}"
        return "✗ Nothing to delete"
    if kind == "update_task":
        rid = parsed.get("id")
        if rid:
            await db.tasks.update_one(
                {"id": rid, "user_id": user_id},
                {"$set": {"status": parsed.get("status") or "Completed",
                          "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            sr = parsed.get("sr_no")
            return f"✓ Task #{sr} marked completed"
        return "✗ Task not found"
    return "✓ Noted"


async def _latest_pending_for_chat(db, chat_id):
    """Return most-recent un-consumed pending for the given chat_id, or None."""
    cur = db.tg_pending.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", -1).limit(1)
    arr = await cur.to_list(1)
    return arr[0] if arr else None


async def _handle_callback(db, create_task_fn, create_expense_fn, create_note_fn, upd: dict):
    cq = upd.get("callback_query") or {}
    data = cq.get("data") or ""
    msg = cq.get("message") or {}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    msg_id = msg.get("message_id")
    cb_id = cq.get("id")

    if not data or ":" not in data or not chat_id:
        await tg_answer_callback(cb_id, "Bad data")
        return
    action, pid = data.split(":", 1)
    pending = await db.tg_pending.find_one({"id": pid, "chat_id": chat_id}, {"_id": 0})
    if not pending:
        await tg_answer_callback(cb_id, "Already handled or expired")
        await tg_edit_message_text(chat_id, msg_id, "(Expired)")
        return

    if action == "no":
        await db.tg_pending.delete_one({"id": pid})
        await tg_answer_callback(cb_id, "Discarded")
        await tg_edit_message_text(chat_id, msg_id, "✗ Discarded")
        return

    # YES
    try:
        txt = await _execute_pending(
            db, pending, create_task_fn, create_expense_fn, create_note_fn,
        )
        await db.tg_pending.delete_one({"id": pid})
        await tg_answer_callback(cb_id, "Done")
        await tg_edit_message_text(chat_id, msg_id, txt)
    except Exception as e:
        logger.warning(f"callback save: {e}")
        await tg_answer_callback(cb_id, "Failed")
        await tg_edit_message_text(chat_id, msg_id, "✗ Failed to save — try again from the app.")


async def _handle_update(db, ai_parse_fn, create_task_fn, create_expense_fn, create_note_fn, upd: dict):
    # Callback query (button press)
    if upd.get("callback_query"):
        await _handle_callback(db, create_task_fn, create_expense_fn, create_note_fn, upd)
        return

    msg = upd.get("message") or upd.get("edited_message") or {}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    text = msg.get("text") or msg.get("caption") or ""
    if not chat_id:
        return

    # /start handling
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        code = parts[1].strip() if len(parts) > 1 else None
        if code:
            link = await db.tg_links.find_one({"code": code, "used": False}, {"_id": 0})
            if link:
                await db.tg_links.update_one(
                    {"code": code}, {"$set": {"used": True, "chat_id": chat_id}}
                )
                await db.users.update_one(
                    {"id": link["user_id"]},
                    {"$set": {"telegram_chat_id": chat_id,
                              "telegram_linked_at": datetime.now(timezone.utc).isoformat()}},
                )
                u = await db.users.find_one({"id": link["user_id"]}, {"_id": 0})
                await tg_send(
                    chat_id,
                    f"✨ Hello {u.get('first_name','friend')}! Mind Matters is now linked.\n\n"
                    "• Send text → I'll parse it and ask you to confirm before saving\n"
                    "• Send a receipt photo → AI extracts amount & merchant → confirm\n"
                    "• Ask 'pending tasks of <name>' or 'loan statement of <name>' — "
                    "I'll deliver a PDF report\n"
                    "• Ask 'cash flow this month' for an expense PDF\n"
                    "• Reminders ping you here automatically.",
                )
                return
        await tg_send(
            chat_id,
            "Welcome to Mind Matters. To link this chat to your account, open the app → Settings → "
            "Connect Telegram, then tap the button to auto-open this chat with a link code.",
        )
        return

    # find user by chat_id
    user = await db.users.find_one({"telegram_chat_id": chat_id}, {"_id": 0})
    if not user:
        await tg_send(
            chat_id,
            "This chat is not linked to a Mind Matters account yet. "
            "Open the app → Settings → Connect Telegram.",
        )
        return

    # Photo or document — pass to Gemini multimodal for receipt OCR
    file_id = None
    if msg.get("photo"):
        photos = msg["photo"]
        if photos:
            file_id = photos[-1].get("file_id")
    elif msg.get("document"):
        d = msg["document"]
        mime = (d.get("mime_type") or "").lower()
        if mime.startswith("image/"):
            file_id = d.get("file_id")

    if file_id:
        await tg_send(chat_id, "📷 Reading receipt…")
        try:
            img = await tg_download_file(file_id)
            if not img:
                await tg_send(chat_id, "Could not download the image, try again?")
                return
            extracted = await _extract_expense_from_image(img, caption=text)
            amount = extracted.get("amount")
            if amount and float(amount) > 0:
                row = {
                    "date": extracted.get("date"),
                    "amount": float(amount),
                    "expense_head": extracted.get("expense_head") or "Uncategorized",
                    "company": extracted.get("company") or "",
                    "mode": extracted.get("mode") or "Card",
                    "direction": "out",
                    "notes": extracted.get("notes") or text or "",
                }
                pid = await _save_pending(db, chat_id, user["id"], "expense", row)
                await tg_send(
                    chat_id,
                    "Confirm to save this expense?\n\n" + _format_preview("expense", row),
                    reply_markup=_confirm_kbd(pid),
                )
            else:
                await tg_send(
                    chat_id,
                    "I couldn't read the amount on that receipt. Try a clearer photo "
                    "or send the amount + merchant as text.",
                )
        except Exception as e:
            logger.warning(f"receipt OCR failed: {e}")
            await tg_send(chat_id, "Sorry — receipt OCR failed. Send the amount + merchant as text.")
        return

    if not text:
        return

    # Text-based yes/no for the most recent pending (works alongside inline buttons).
    low = text.strip().lower()

    # ───────── Inline-reply commands from digest (v2.22) ─────────
    # /done <sr>    — toggle a task to Done by Sr#
    # /comment <kind> <sr> <text>  — append a comment to a task/routine/tx
    m_done = re.match(r"^/done\s+#?(\d+)\s*$", low)
    if m_done:
        sr = int(m_done.group(1))
        row = await db.tasks.find_one(
            {"user_id": user["id"], "sr_no": sr}, {"_id": 0},
        )
        if not row:
            await tg_send(chat_id, f"No task found with Sr #{sr}.")
            return
        await db.tasks.update_one(
            {"id": row["id"]},
            {"$set": {"status": "Done",
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        await tg_send(
            chat_id,
            f"✓ Marked task #{sr} as Done: <i>{(row.get('task') or row.get('name') or '')[:80]}</i>",
            parse_mode="HTML",
        )
        return
    m_cmt = re.match(
        r"^/comment\s+(task|routine|tx|transaction)\s+#?(\d+)\s+(.+)$",
        text.strip(), flags=re.IGNORECASE | re.DOTALL,
    )
    if m_cmt:
        kind = m_cmt.group(1).lower()
        if kind == "tx":
            kind = "transaction"
        coll = {"task": "tasks", "routine": "routines",
                "transaction": "transactions"}[kind]
        sr = int(m_cmt.group(2))
        body = m_cmt.group(3).strip()
        row = await db[coll].find_one(
            {"user_id": user["id"], "sr_no": sr}, {"_id": 0},
        )
        if not row:
            await tg_send(chat_id, f"No {kind} found with Sr #{sr}.")
            return
        project_id = row.get("project_id")
        if not project_id:
            await tg_send(
                chat_id,
                f"That {kind} isn't attached to a project — open the app to add it.",
            )
            return
        doc = {
            "id": str(uuid.uuid4()), "project_id": project_id,
            "resource_type": kind, "resource_id": row["id"],
            "user_id": user["id"],
            "user_name": user.get("first_name") or
                user.get("email", "").split("@")[0] or "user",
            "body": body,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.comments.insert_one(dict(doc))
        await tg_send(
            chat_id,
            f"💬 Comment added on {kind} #{sr}.",
        )
        return
    if low in {"/help", "/commands"}:
        await tg_send(
            chat_id,
            "<b>Commands</b>\n"
            "• <code>/done &lt;sr&gt;</code> — mark a task as Done by Sr#\n"
            "• <code>/comment task|routine|tx &lt;sr&gt; &lt;text&gt;</code> — "
            "add a comment to a row\n"
            "• <code>stop digest</code> — disable the daily digest\n"
            "• Free text → AI parses into task/expense/note → confirm to save",
            parse_mode="HTML",
        )
        return
    if low in {"stop digest", "/stop_digest", "stopdigest"}:
        await db.users.update_one(
            {"id": user["id"]}, {"$set": {"digest_enabled": False}},
        )
        await tg_send(chat_id, "✓ Daily digest disabled. Re-enable from Settings → Daily Digest.")
        return
    if low in {"start digest", "/start_digest", "startdigest"}:
        await db.users.update_one(
            {"id": user["id"]}, {"$set": {"digest_enabled": True}},
        )
        await tg_send(chat_id, "✓ Daily digest re-enabled.")
        return

    if low in {"yes", "y", "ok", "confirm", "go", "sure", "save"}:
        pending = await _latest_pending_for_chat(db, chat_id)
        if pending:
            try:
                msg_out = await _execute_pending(
                    db, pending, create_task_fn, create_expense_fn, create_note_fn,
                )
                await db.tg_pending.delete_one({"id": pending["id"]})
                await tg_send(chat_id, msg_out)
            except Exception as e:
                logger.warning(f"text-yes execute: {e}")
                await tg_send(chat_id, "✗ Failed to save — try again.")
            return
        # else fall through to AI parse (interpret bare "yes" as a note)
    if low in {"no", "n", "cancel", "discard", "skip", "nope"}:
        pending = await _latest_pending_for_chat(db, chat_id)
        if pending:
            await db.tg_pending.delete_one({"id": pending["id"]})
            await tg_send(chat_id, "✗ Discarded")
            return

    # CRUD commands: delete / complete by sr_no
    m_del = re.match(
        r"^\s*(?:delete|remove|drop)\s+(task|routine|expense|transaction)\s*#?(\d+)\s*$",
        low,
    )
    if m_del:
        res = m_del.group(1)
        if res == "transaction":
            res = "expense"
        sr = int(m_del.group(2))
        coll = {"task": "tasks", "routine": "routines", "expense": "transactions"}[res]
        row = await db[coll].find_one(
            {"user_id": user["id"], "sr_no": sr}, {"_id": 0},
        )
        if not row:
            await tg_send(chat_id, f"No {res} found with Sr #{sr}.")
            return
        pid = await _save_pending(
            db, chat_id, user["id"], f"delete_{res}",
            {"id": row["id"], "sr_no": sr,
             "task": row.get("task"), "activity": row.get("activity"),
             "vendor": row.get("vendor") or row.get("name"),
             "details": row.get("details")},
        )
        await tg_send(
            chat_id,
            "Confirm to delete?\n\n" + _format_preview(f"delete_{res}", {
                "sr_no": sr, "task": row.get("task"),
                "activity": row.get("activity"),
                "vendor": row.get("vendor") or row.get("name"),
                "details": row.get("details"),
            }) + "\n\n_Or just reply yes / no_",
            reply_markup=_confirm_kbd(pid), parse_mode="Markdown",
        )
        return

    m_done = re.match(
        r"^\s*(?:complete|finish|done|mark)\s+(?:task\s+)?#?(\d+)\s*(?:done|complete|finished)?\s*$",
        low,
    )
    if m_done:
        sr = int(m_done.group(1))
        row = await db.tasks.find_one(
            {"user_id": user["id"], "sr_no": sr}, {"_id": 0},
        )
        if not row:
            await tg_send(chat_id, f"No task found with Sr #{sr}.")
            return
        pid = await _save_pending(
            db, chat_id, user["id"], "update_task",
            {"id": row["id"], "sr_no": sr, "task": row.get("task"),
             "status": "Completed"},
        )
        await tg_send(
            chat_id,
            "Confirm completion?\n\n" + _format_preview(
                "update_task", {"sr_no": sr, "task": row.get("task")}
            ) + "\n\n_Or just reply yes / no_",
            reply_markup=_confirm_kbd(pid), parse_mode="Markdown",
        )
        return

    # Statement query intent
    sq = _detect_statement_query(text)
    if sq:
        kind, name = sq
        await tg_send(chat_id, f"📑 Preparing {kind} statement{(' for ' + name) if name else ''}…")
        try:
            fname, pdf = await _generate_statement_pdf(db, user, kind, name=name)
            if pdf:
                await tg_send_document(
                    chat_id, fname, pdf,
                    caption=f"{kind.title()}{(' · ' + name) if name else ''}",
                )
            else:
                await tg_send(chat_id, f"No {kind} records{(' for ' + name) if name else ''}.")
        except Exception as e:
            logger.warning(f"statement query: {e}")
            await tg_send(chat_id, "Failed to prepare the statement — try again.")
        return

    # AI parse → ask for confirmation
    try:
        parsed = await ai_parse_fn(text, "auto")
        if not parsed:
            await tg_send(chat_id, "Noted. I couldn't structure that — send again with more detail?")
            return
        kind = parsed.get("kind") or "task"
        if kind not in ("task", "expense", "note"):
            kind = "task"
        pid = await _save_pending(db, chat_id, user["id"], kind, parsed)
        await tg_send(
            chat_id,
            "Confirm to save?\n\n" + _format_preview(kind, parsed),
            reply_markup=_confirm_kbd(pid),
        )
    except Exception as e:
        logger.warning(f"handle_update parse: {e}")
        await tg_send(chat_id, "I had trouble processing that — try again?")


async def tg_poll_loop(db, ai_parse_fn, create_task_fn, create_expense_fn, create_note_fn):
    if not TG_TOKEN:
        logger.info("Telegram token missing — poller disabled")
        return
    state = await db.tg_state.find_one({"_id": "offset"})
    offset = (state or {}).get("offset", 0)
    logger.info(f"Telegram poller starting at offset {offset}")
    async with httpx.AsyncClient(timeout=35) as cli:
        while True:
            try:
                r = await cli.get(
                    f"{TG_API}/getUpdates",
                    params={"offset": offset, "timeout": 25,
                            "allowed_updates": '["message","callback_query"]'},
                )
                data = r.json()
                if data.get("ok"):
                    for upd in data.get("result", []):
                        offset = upd["update_id"] + 1
                        try:
                            await _handle_update(
                                db, ai_parse_fn, create_task_fn, create_expense_fn, create_note_fn, upd
                            )
                        except Exception as e:
                            logger.warning(f"handle_update: {e}")
                    if data.get("result"):
                        await db.tg_state.update_one(
                            {"_id": "offset"}, {"$set": {"offset": offset}}, upsert=True
                        )
            except Exception as e:
                logger.warning(f"tg_poll loop: {e}")
                await asyncio.sleep(3)


def _next_fire_at(current_iso: str, recurrence: str, custom_recurrence: Optional[str] = None) -> Optional[str]:
    """Return the next ISO datetime (UTC) for a recurring reminder.
    Returns None when the reminder is one-time / unknown recurrence.
    Handles standard presets + a handful of common natural-language custom
    patterns ('every N days/weeks/months', 'every <weekdays>', 'weekdays',
    'weekends', 'biweekly', 'bi-monthly').
    """
    rec = (recurrence or "none").lower()
    if not current_iso:
        return None
    try:
        base = datetime.fromisoformat(current_iso.replace("Z", "+00:00"))
    except Exception:
        return None

    # Standard presets
    presets = {
        "daily": timedelta(days=1),
        "weekly": timedelta(weeks=1),
        "biweekly": timedelta(weeks=2),
    }
    if rec in presets:
        return (base + presets[rec]).isoformat()
    if rec == "monthly":
        # Use 30-day rough month so we don't have to deal with month-end edge cases here
        return (base + timedelta(days=30)).isoformat()
    if rec == "quarterly":
        return (base + timedelta(days=91)).isoformat()
    if rec in ("half-yearly", "halfyearly", "semi-annual"):
        return (base + timedelta(days=183)).isoformat()
    if rec == "yearly":
        return (base + timedelta(days=365)).isoformat()
    if rec in ("none", ""):
        return None

    # Custom — parse the human-readable string
    if rec == "custom":
        spec = (custom_recurrence or "").lower().strip()
    else:
        spec = rec
    if not spec:
        return None

    # "every N day(s)/week(s)/month(s)/year(s)"
    import re
    m = re.search(r"every\s+(\d+)\s*(day|week|month|year)s?", spec)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        delta_days = {"day": n, "week": n * 7, "month": n * 30, "year": n * 365}[unit]
        return (base + timedelta(days=delta_days)).isoformat()

    # "weekdays" → Mon-Fri only
    if spec in ("weekdays", "mon-fri", "monday-friday"):
        nxt = base + timedelta(days=1)
        while nxt.weekday() >= 5:
            nxt += timedelta(days=1)
        return nxt.isoformat()
    # "weekends" → Sat-Sun only
    if spec in ("weekends", "sat-sun"):
        nxt = base + timedelta(days=1)
        while nxt.weekday() < 5:
            nxt += timedelta(days=1)
        return nxt.isoformat()
    # "biweekly" / "every 2 weeks"
    if spec in ("biweekly", "bi-weekly", "every 2 weeks", "fortnightly"):
        return (base + timedelta(weeks=2)).isoformat()
    # "bimonthly" / "every 2 months" — every other month
    if spec in ("bimonthly", "bi-monthly", "every 2 months"):
        return (base + timedelta(days=61)).isoformat()
    # "twice a month" — every ~15 days
    if spec in ("twice a month", "semi-monthly", "semimonthly"):
        return (base + timedelta(days=15)).isoformat()

    # "every <weekday>(s)" / "every <weekday> and <weekday>"
    weekdays = {
        "monday": 0, "mon": 0, "tuesday": 1, "tue": 1, "tues": 1,
        "wednesday": 2, "wed": 2, "thursday": 3, "thu": 3, "thurs": 3,
        "friday": 4, "fri": 4, "saturday": 5, "sat": 5, "sunday": 6, "sun": 6,
    }
    found = []
    for word, idx in weekdays.items():
        if re.search(rf"\b{word}\b", spec):
            found.append(idx)
    if found:
        found = sorted(set(found))
        # Advance day-by-day until weekday matches one of the targets
        nxt = base + timedelta(days=1)
        for _ in range(8):
            if nxt.weekday() in found:
                return nxt.isoformat()
            nxt += timedelta(days=1)

    return None  # unknown pattern → one-shot


async def reminder_loop(db):
    """Every 30s, pick due reminders and notify user's Telegram.
    Recurring reminders are rescheduled to their next fire-time and `sent` is
    reset to False so they fire again at the right cadence.
    """
    while True:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            due = await db.reminders.find(
                {"fire_at": {"$lte": now_iso}, "sent": {"$ne": True}},
                {"_id": 0},
            ).to_list(200)
            for r in due:
                u = await db.users.find_one({"id": r["user_id"]}, {"_id": 0})
                cid = (u or {}).get("telegram_chat_id")
                text = f"🔔 {r.get('title','Reminder')}"
                if r.get("notes"):
                    text += f"\n{r['notes']}"
                if cid:
                    await tg_send(cid, text)
                # Reschedule if recurring; otherwise mark as sent (one-shot)
                next_iso = _next_fire_at(
                    r.get("fire_at"),
                    r.get("recurrence", "none"),
                    r.get("custom_recurrence"),
                )
                if next_iso:
                    await db.reminders.update_one(
                        {"id": r["id"]},
                        {"$set": {
                            "fire_at": next_iso,
                            "sent": False,
                            "last_sent_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
                else:
                    await db.reminders.update_one(
                        {"id": r["id"]},
                        {"$set": {"sent": True, "sent_at": datetime.now(timezone.utc).isoformat()}},
                    )
        except Exception as e:
            logger.warning(f"reminder_loop: {e}")
        await asyncio.sleep(30)


async def digest_loop(db):
    """Once-daily Telegram digest of @mentions + new row activity in the last
    24h across each user's accessible projects. Runs every 30 min; fires for
    each user once per UTC day at/after their preferred hour (default 09:00
    UTC if no preference set on the user doc as `digest_hour`).

    User can opt out by setting `digest_enabled: False` on their user doc.
    """
    import re
    while True:
        try:
            now = datetime.now(timezone.utc)
            today_key = now.date().isoformat()
            since_iso = (now - timedelta(hours=24)).isoformat()
            users = await db.users.find(
                {"telegram_chat_id": {"$exists": True, "$ne": None}},
                {"_id": 0},
            ).to_list(500)
            for u in users:
                if u.get("digest_enabled") is False:
                    continue
                hour = int(u.get("digest_hour", 9))
                if now.hour < hour:
                    continue
                if u.get("last_digest_date") == today_key:
                    continue
                # Resolve accessible project ids for this user
                owned = await db.projects.find(
                    {"owner_id": u["id"]}, {"_id": 0, "id": 1, "name": 1},
                ).to_list(200)
                pids = [p["id"] for p in owned]
                proj_by_id = {p["id"]: p for p in owned}
                members = await db.project_members.find(
                    {"user_id": u["id"], "accepted": True},
                    {"_id": 0, "project_id": 1},
                ).to_list(200)
                pids.extend(m["project_id"] for m in members)
                if not pids:
                    await db.users.update_one(
                        {"id": u["id"]}, {"$set": {"last_digest_date": today_key}},
                    )
                    continue
                # Hydrate missing project names for shared projects we don't own
                missing = [pid for pid in pids if pid not in proj_by_id]
                if missing:
                    others = await db.projects.find(
                        {"id": {"$in": missing}}, {"_id": 0, "id": 1, "name": 1},
                    ).to_list(200)
                    for p in others:
                        proj_by_id[p["id"]] = p
                # Pull last-24h comments + tasks + transactions
                comments = await db.comments.find(
                    {"project_id": {"$in": pids}, "created_at": {"$gte": since_iso}},
                    {"_id": 0},
                ).sort("created_at", -1).to_list(200)
                new_tasks = await db.tasks.count_documents(
                    {"project_id": {"$in": pids}, "created_at": {"$gte": since_iso},
                     "user_id": {"$ne": u["id"]}},
                )
                new_tx = await db.transactions.count_documents(
                    {"project_id": {"$in": pids}, "created_at": {"$gte": since_iso},
                     "user_id": {"$ne": u["id"]}},
                )
                # Detect @mentions of THIS user
                handle = (u.get("first_name") or u.get("email", "").split("@")[0] or "").lower()
                prefix = u.get("email", "").split("@")[0].lower()
                mention_re = re.compile(r"@([\w][\w.\-]{0,40})")
                mentions = [c for c in comments if any(
                    h.lower() in {handle, prefix} for h in mention_re.findall(c.get("body", ""))
                )]
                # Skip empty digest unless the user explicitly wants quiet days
                if not mentions and not comments and not new_tasks and not new_tx:
                    await db.users.update_one(
                        {"id": u["id"]}, {"$set": {"last_digest_date": today_key}},
                    )
                    continue
                # Build message
                lines = ["☀️ <b>Your daily digest</b>", ""]
                if mentions:
                    lines.append(f"💬 <b>{len(mentions)} mention{'s' if len(mentions)!=1 else ''} of you</b>")
                    for c in mentions[:5]:
                        proj_name = proj_by_id.get(c["project_id"], {}).get("name", "Project")
                        snippet = c.get("body", "").strip().replace("\n", " ")[:120]
                        lines.append(f"  · {c.get('user_name','Someone')} in <i>{proj_name}</i>: {snippet}")
                    if len(mentions) > 5:
                        lines.append(f"  …and {len(mentions) - 5} more")
                    lines.append("")
                other_comments = [c for c in comments if c not in mentions]
                if other_comments:
                    lines.append(f"💭 <b>{len(other_comments)} new comment{'s' if len(other_comments)!=1 else ''}</b> in your projects")
                    lines.append("")
                if new_tasks or new_tx:
                    bits = []
                    if new_tasks:
                        bits.append(f"{new_tasks} new task{'s' if new_tasks != 1 else ''}")
                    if new_tx:
                        bits.append(f"{new_tx} cash-flow row{'s' if new_tx != 1 else ''}")
                    lines.append(f"🆕 {' · '.join(bits)} added by collaborators")
                    lines.append("")
                lines.append("<i>Tip: reply /done &lt;sr&gt; · /comment task &lt;sr&gt; &lt;text&gt; · stop digest</i>")
                await tg_send(u["telegram_chat_id"], "\n".join(lines), parse_mode="HTML")
                await db.users.update_one(
                    {"id": u["id"]},
                    {"$set": {"last_digest_date": today_key,
                              "last_digest_sent_at": now.isoformat()}},
                )
        except Exception as e:
            logger.warning(f"digest_loop: {e}")
        await asyncio.sleep(1800)  # 30 min
