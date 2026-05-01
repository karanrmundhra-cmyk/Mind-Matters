import React, { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const SUGGESTIONS = [
  "What is my total loan exposure with interest?",
  "How much did I spend on food this month?",
  "Which routines did I skip most this week?",
  "Who has the most pending tasks?",
  "Give me a 5-line morning briefing",
];

export default function AiChat({ open, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "I am your Mind Matters assistant. Ask me about your tasks, loans, cash flow, routines, or investments.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setSending(true);
    try {
      const { data } = await api.post("/ai/chat", { message: msg });
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (e) {
      toast.error("AI service unavailable");
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Sorry, I could not reach the intelligence layer right now." },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed z-50 bottom-24 md:bottom-24 right-4 md:right-6 w-[calc(100vw-2rem)] md:w-[420px] h-[560px] mm-glass flex flex-col mm-fade-in"
      data-testid="ai-chat-panel"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} strokeWidth={1.5} />
          <div className="mm-font-display text-sm">Mind Matters AI</div>
        </div>
        <button
          data-testid="ai-chat-close"
          onClick={onClose}
          className="text-white/50 hover:text-white transition"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="ai-chat-messages">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2.5 text-sm rounded-2xl ${
                m.role === "user"
                  ? "bg-white text-black rounded-br-sm"
                  : "bg-white/[0.04] border border-white/10 text-white/90 rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="text-xs text-white/40 px-1">Thinking…</div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="mm-chip hover:bg-white/[0.08] transition"
              data-testid="ai-chat-suggestion"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-white/5 flex gap-2">
        <input
          data-testid="ai-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask anything about your life…"
          className="mm-input text-sm"
        />
        <button
          data-testid="ai-chat-send"
          onClick={() => send()}
          disabled={sending || !input.trim()}
          className="mm-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
