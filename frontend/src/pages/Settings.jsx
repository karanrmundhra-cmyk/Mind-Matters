import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle } from "@/components/Primitives";
import { Send, Link as LinkIcon, Unlink, Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function Settings() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [linkCode, setLinkCode] = useState("");

  const refresh = async () => {
    const { data } = await api.get("/telegram/status");
    setStatus(data);
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

  const copyCode = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(`/start ${linkCode}`);
    toast.success("Copied");
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
      toast.error("Could not send");
    }
  };

  return (
    <div className="space-y-6 mm-fade-in" data-testid="settings-page">
      <SectionTitle subtitle="Account" title="Settings" />

      {/* Profile */}
      <Card className="p-6" data-testid="profile-card">
        <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-[#B7A98A]/70 mb-4">
          Profile
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mb-1.5">
              First name
            </div>
            <div className="mm-text-gold-bright text-lg mm-font-display">
              {user?.first_name}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mb-1.5">
              Email
            </div>
            <div className="text-sm text-[#E4C98C]/75">{user?.email}</div>
          </div>
        </div>
      </Card>

      {/* Telegram */}
      <Card className="p-6" data-testid="telegram-card">
        <div className="flex items-center justify-between mb-4">
          <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-[#B7A98A]/70">
            Telegram
          </div>
          <span
            className={`mm-chip ${status?.linked ? "mm-chip-gold" : ""}`}
            data-testid="tg-connection-chip"
          >
            {status?.linked ? "Connected" : status?.configured ? "Not linked" : "Bot not configured"}
          </span>
        </div>

        {!status?.configured ? (
          <div className="text-sm text-[#B7A98A]/60">
            Telegram bot token is missing from the backend. Add{" "}
            <code className="mm-text-gold">TELEGRAM_BOT_TOKEN</code> in backend .env.
          </div>
        ) : status?.linked ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Check size={14} className="mm-text-gold" /> Linked to chat {status.chat_id} via{" "}
              <b className="mm-text-gold-bright">@{status.bot_username}</b>
            </div>
            <button
              onClick={test}
              className="mm-btn-ghost text-xs flex items-center gap-2"
              data-testid="tg-test-btn"
            >
              <Send size={12} /> Send test ping
            </button>
            <button
              onClick={unlink}
              className="mm-btn-ghost text-xs flex items-center gap-2"
              data-testid="tg-unlink-btn"
            >
              <Unlink size={12} /> Unlink
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-[#E4C98C]/85 leading-relaxed">
              Link your Telegram to receive reminders, daily digests, and AI-generated PDFs
              (loan statements, receipts, invoices). Inbound text to the bot is auto-parsed
              into tasks, expenses, or notes.
            </div>
            {!linkCode ? (
              <button
                onClick={generate}
                className="mm-btn-primary text-sm flex items-center gap-2"
                data-testid="tg-generate-code"
              >
                <LinkIcon size={14} /> Generate connect link
              </button>
            ) : (
              <div className="mm-glass p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70">
                  Your one-time code
                </div>
                <div className="flex items-center gap-3">
                  <div className="mm-font-display text-xl mm-text-gold-bright font-semibold">
                    {linkCode}
                  </div>
                  <button
                    onClick={copyCode}
                    className="mm-btn-ghost text-xs flex items-center gap-1"
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
                {deeplink && (
                  <a
                    href={deeplink}
                    target="_blank"
                    rel="noreferrer"
                    className="mm-btn-primary inline-flex items-center gap-2 text-sm"
                    data-testid="tg-open-bot"
                  >
                    <Sparkles size={13} /> Open @{status.bot_username} and tap Start
                  </a>
                )}
                <div className="text-xs text-[#B7A98A]/65">
                  Or send manually:{" "}
                  <code className="mm-text-gold-bright">/start {linkCode}</code> to{" "}
                  <b>@{status.bot_username}</b>
                </div>
                <button
                  onClick={refresh}
                  className="mm-btn-ghost text-xs"
                  data-testid="tg-refresh-status"
                >
                  I've sent it — check link
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6" data-testid="about-card">
        <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-[#B7A98A]/70 mb-3">
          About
        </div>
        <div className="text-sm text-[#B7A98A]/75 leading-relaxed">
          Mind Matters — v1.1 · Personal Operating System. Build standard: Big 4 consulting ×
          Apple UX. Calm. Intelligent. In control.
        </div>
      </Card>
    </div>
  );
}
