import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle } from "@/components/Primitives";
import {
  Send, Link as LinkIcon, Unlink, Copy, Sparkles, Download, Calendar, KeyRound, LogOut, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

function formatErr(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail?.msg || detail);
}

export default function Settings() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState(null);
  const [linkCode, setLinkCode] = useState("");
  const [calToken, setCalToken] = useState(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwBusy, setPwBusy] = useState(false);

  const refresh = async () => {
    const [s, c] = await Promise.all([
      api.get("/telegram/status"),
      api.get("/cal/feed/token"),
    ]);
    setStatus(s.data);
    setCalToken(c.data?.token || null);
  };
  useEffect(() => {
    refresh();
  }, []);

  const generate = async () => {
    const { data } = await api.post("/telegram/link-code", {});
    setLinkCode(data.code);
  };
  const deeplink =
    linkCode && status?.bot_username
      ? `https://t.me/${status.bot_username}?start=${linkCode}`
      : null;
  const copy = (text, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };
  const unlink = async () => {
    if (!window.confirm("Unlink Telegram?")) return;
    await api.post("/telegram/unlink", {});
    setLinkCode("");
    await refresh();
    toast.success("Unlinked");
  };
  const test = async () => {
    try {
      await api.post("/telegram/send-test", {
        text: `Mind Matters test ping — hi ${user?.first_name || "there"}!`,
      });
      toast.success("Sent! Check Telegram.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const rotateCal = async () => {
    const { data } = await api.post("/cal/feed/token", {});
    setCalToken(data.token);
    toast.success("Calendar feed URL rotated");
  };

  const base = process.env.REACT_APP_BACKEND_URL;
  const icsUrl = calToken ? `${base}/api/cal/${calToken}.ics` : null;
  const webcalUrl = icsUrl ? icsUrl.replace(/^https?:/, "webcal:") : null;

  const downloadExport = async () => {
    try {
      const res = await api.get("/export/data.xlsx", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mind-matters-export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch {
      toast.error("Export failed");
    }
  };

  const changePassword = async (e) => {
    e?.preventDefault();
    setPwBusy(true);
    try {
      await api.post("/auth/change-password", {
        current_password: pw.current,
        new_password: pw.next,
      });
      toast.success("Password updated");
      setPw({ current: "", next: "" });
    } catch (err) {
      toast.error(formatErr(err?.response?.data?.detail));
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="space-y-6 mm-fade-in" data-testid="settings-page">
      <SectionTitle subtitle="Preferences" title="Settings" />

      {/* Account */}
      <Card className="p-5" data-testid="settings-account">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-3">
          Account
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/55">Name</div>
            <div className="mt-1 mm-text-gold-bright" data-testid="settings-name">{user?.first_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/55">Email</div>
            <div className="mt-1 mm-text-gold-bright truncate" data-testid="settings-email">{user?.email || "—"}</div>
          </div>
          <div className="flex items-end justify-end">
            <button
              onClick={logout}
              className="mm-btn-ghost text-xs flex items-center gap-1.5"
              data-testid="settings-logout"
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-5" data-testid="settings-password">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-3">
          <KeyRound size={12} /> Change Password
        </div>
        <form onSubmit={changePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="password"
            placeholder="Current password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            className="mm-input text-sm"
            data-testid="pw-current"
            required
          />
          <input
            type="password"
            placeholder="New password (≥6 chars)"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            className="mm-input text-sm"
            data-testid="pw-next"
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={pwBusy || !pw.current || !pw.next}
            className="mm-btn-primary text-sm disabled:opacity-40"
            data-testid="pw-submit"
          >
            {pwBusy ? "Updating…" : "Update password"}
          </button>
        </form>
      </Card>

      {/* Calendar subscription */}
      <Card className="p-5" data-testid="settings-calendar">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-3">
          <Calendar size={12} /> Calendar Subscription
        </div>
        <p className="text-sm text-[#B7A98A]/70 leading-relaxed">
          Paste the URL below into your phone/computer calendar and every reminder you create
          will auto-appear as an event. Works on iPhone Calendar, Google Calendar, Outlook and Apple Mail.
        </p>
        {!calToken ? (
          <button
            onClick={rotateCal}
            className="mm-btn-primary text-sm mt-4 flex items-center gap-1.5"
            data-testid="cal-generate"
          >
            <Sparkles size={12} /> Generate calendar feed URL
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
              <input
                readOnly
                value={icsUrl || ""}
                className="mm-input text-xs flex-1 font-mono"
                data-testid="cal-url"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={() => copy(icsUrl, "Calendar URL copied")}
                className="mm-btn-ghost text-xs flex items-center gap-1.5"
                data-testid="cal-copy"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[rgba(201,169,97,0.2)] p-3">
                <div className="mm-text-gold-bright font-medium mb-1">📱 iPhone / iPad</div>
                <ol className="list-decimal pl-4 space-y-0.5 text-[#B7A98A]/75">
                  <li>Settings → Calendar → Accounts → Add Account → Other</li>
                  <li>Add Subscribed Calendar</li>
                  <li>Paste the URL above</li>
                </ol>
                {webcalUrl && (
                  <a href={webcalUrl} className="mm-text-gold text-[11px] underline mt-2 inline-block" data-testid="cal-webcal">
                    Or tap here to subscribe instantly
                  </a>
                )}
              </div>
              <div className="rounded-lg border border-[rgba(201,169,97,0.2)] p-3">
                <div className="mm-text-gold-bright font-medium mb-1">🖥️ Google Calendar</div>
                <ol className="list-decimal pl-4 space-y-0.5 text-[#B7A98A]/75">
                  <li>Google Calendar → "+" next to "Other calendars"</li>
                  <li>"From URL" → paste the URL above → Add</li>
                </ol>
              </div>
            </div>
            <button
              onClick={rotateCal}
              className="mm-btn-ghost text-xs flex items-center gap-1.5"
              data-testid="cal-rotate"
            >
              <RefreshCw size={12} /> Rotate URL (old subscriptions will stop)
            </button>
          </div>
        )}
      </Card>

      {/* Telegram bot setup */}
      <Card className="p-5" data-testid="settings-telegram">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-3">
          <Send size={12} /> Connect Telegram
        </div>
        {status?.linked ? (
          <div className="space-y-3">
            <div className="text-sm mm-text-gold-bright">
              ✓ Linked to chat <span className="font-mono text-xs">#{status.chat_id}</span>
            </div>
            <p className="text-xs text-[#B7A98A]/65 leading-relaxed">
              You can now send messages or receipt photos to the bot, get confirmations, and ask
              for PDF statements like "pending tasks of Brinda" or "cash flow this month".
            </p>
            <div className="flex gap-2">
              <button onClick={test} className="mm-btn-ghost text-xs flex items-center gap-1.5" data-testid="tg-test">
                <Send size={12} /> Send test message
              </button>
              <button onClick={unlink} className="mm-btn-ghost text-xs flex items-center gap-1.5" data-testid="tg-unlink">
                <Unlink size={12} /> Unlink
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-[#B7A98A]/70 leading-relaxed">
              Each user runs their own private Telegram bot. Follow these steps once:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-[#B7A98A]/85">
              <li>Open Telegram → search <span className="mm-text-gold-bright">@BotFather</span> → send <code className="mm-text-gold">/newbot</code>. Give it a name and a unique username ending in <code>bot</code>. BotFather replies with a long token (e.g. <code className="text-xs">7123456789:AA...</code>).</li>
              <li>Paste that token into the server's <code>.env</code> under <code>TELEGRAM_BOT_TOKEN</code> and restart the backend. <span className="text-[#B7A98A]/55">(Admins only for now — will expose a UI field next iteration.)</span></li>
              <li>Once linked, your bot appears below. Click <em>Generate code</em> and tap the Telegram button to auto-link this account to your chat.</li>
            </ol>
            <div className="flex gap-2 pt-2">
              <button onClick={generate} className="mm-btn-primary text-xs flex items-center gap-1.5" data-testid="tg-generate">
                <LinkIcon size={12} /> Generate code
              </button>
              <button onClick={refresh} className="mm-btn-ghost text-xs flex items-center gap-1.5" data-testid="tg-refresh">
                <RefreshCw size={12} /> Refresh status
              </button>
            </div>
            {linkCode && (
              <div className="mt-3 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/55">Your code</div>
                <div className="flex gap-2 items-center">
                  <code className="mm-input text-sm flex-1 font-mono !py-2" data-testid="tg-code">{linkCode}</code>
                  <button
                    onClick={() => copy(`/start ${linkCode}`, "Copied")}
                    className="mm-btn-ghost text-xs flex items-center gap-1.5"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                {deeplink && (
                  <a
                    href={deeplink}
                    target="_blank"
                    rel="noreferrer"
                    className="mm-btn-primary text-xs inline-flex items-center gap-1.5"
                    data-testid="tg-deeplink"
                  >
                    <Send size={12} /> Open in Telegram
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Data export */}
      <Card className="p-5" data-testid="settings-export">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-3">
          <Download size={12} /> Export Your Data
        </div>
        <p className="text-sm text-[#B7A98A]/70">
          Download everything — tasks, routines, cash flow, notes, reminders, deadlines — as a
          multi-sheet Excel file.
        </p>
        <button
          onClick={downloadExport}
          className="mm-btn-primary text-sm mt-3 flex items-center gap-1.5"
          data-testid="export-xlsx"
        >
          <Download size={12} /> Download .xlsx
        </button>
      </Card>

      {/* About */}
      <Card className="p-5" data-testid="settings-about">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-2">About</div>
        <div className="mm-font-serif italic text-base mm-text-gold-bright">
          Mind Matters — v1 · Personal Operating System.
        </div>
        <div className="text-xs text-[#B7A98A]/60 mt-2">Calm. Intelligent. In control.</div>
      </Card>
    </div>
  );
}
