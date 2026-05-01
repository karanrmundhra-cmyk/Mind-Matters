"""Telegram bot helper + polling + reminder scheduler for Mind Matters.

Uses long polling against api.telegram.org (no webhook needed).
Features:
  - /start <code>   → links user's Telegram chat to their Mind Matters account
  - plain text      → AI-parses to task / expense / note automatically
  - photo / receipt → Gemini multimodal extracts amount + merchant + date → expense
  - outbound        → tg_send, tg_send_document
  - reminders       → every 30s, scans reminders collection and pings user
"""
import asyncio
import base64
import logging
import os
import io
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("mind-matters.tg")

TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TG_API = f"https://api.telegram.org/bot{TG_TOKEN}" if TG_TOKEN else ""


async def tg_send(chat_id, text, parse_mode=None):
    if not TG_TOKEN or not chat_id:
        return None
    payload = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if parse_mode:
        payload["parse_mode"] = parse_mode
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


async def tg_download_file(file_id: str) -> bytes:
    """Resolve a Telegram file_id and download its bytes."""
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


async def _extract_expense_from_image(image_bytes: bytes, caption: str = "") -> dict:
    """Use Gemini 3 Flash multimodal to extract expense fields from a receipt image."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        logger.warning(f"emergentintegrations unavailable: {e}")
        return {}
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return {}
    import json as _json
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


async def _handle_update(db, ai_parse_fn, create_task_fn, create_expense_fn, create_note_fn, upd: dict):
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
                    "• Send text → I'll parse it into a task, expense, or note\n"
                    "• Send a receipt photo → AI extracts amount & merchant → expense logged\n"
                    "• I'll ping you for reminders and daily task digests\n"
                    "• Ask Mind Matters to share statements — I'll deliver them as PDF here.",
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
        # photos arrive as a list of progressively higher resolutions; take the largest
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
                await create_expense_fn(user["id"], row)
                await tg_send(
                    chat_id,
                    f"✓ Expense logged from receipt: ₹{int(round(float(amount))):,} · "
                    f"{row['expense_head']}{' · ' + row['company'] if row['company'] else ''}"
                    f"{' · ' + row['date'] if row['date'] else ''}",
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

    # AI parse
    try:
        parsed = await ai_parse_fn(text, "auto")
        if not parsed:
            await tg_send(chat_id, "Noted. I couldn't structure that — send again with more detail?")
            return
        kind = parsed.get("kind") or "task"
        if kind == "task":
            await create_task_fn(user["id"], parsed)
            await tg_send(chat_id, f"✓ Task added: {parsed.get('task','')}")
        elif kind == "expense":
            await create_expense_fn(user["id"], parsed)
            await tg_send(chat_id, f"✓ Expense logged: ₹{parsed.get('amount','?')} · {parsed.get('expense_head','')}")
        elif kind == "note":
            await create_note_fn(user["id"], parsed)
            await tg_send(chat_id, "✓ Note saved")
        else:
            await tg_send(chat_id, "Noted.")
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
                    params={"offset": offset, "timeout": 25, "allowed_updates": '["message"]'},
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


async def reminder_loop(db):
    """Every 30s, pick due reminders and notify user's Telegram."""
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
                await db.reminders.update_one(
                    {"id": r["id"]},
                    {"$set": {"sent": True, "sent_at": datetime.now(timezone.utc).isoformat()}},
                )
        except Exception as e:
            logger.warning(f"reminder_loop: {e}")
        await asyncio.sleep(30)
