import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import Logo from "@/components/Logo";
import { toast } from "sonner";

function formatErr(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await signup(firstName.trim() || "Friend", email.trim().toLowerCase(), password);
        toast.success(`Welcome, ${firstName || "friend"}`);
      } else {
        await login(email.trim().toLowerCase(), password);
        toast.success("Welcome back");
      }
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(formatErr(err?.response?.data?.detail) || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setMode(mode === "login" ? "signup" : "login");
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6"
      data-testid="login-page"
    >
      <div className="mm-glass w-full max-w-md p-6 sm:p-10 mm-fade-in">
        <div className="flex flex-col items-center text-center">
          <Logo size={88} />
          <div className="mt-4 mm-font-serif text-2xl sm:text-3xl text-white">Mind Matters</div>
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/40 mt-2">
            Personal Operating System
          </div>
          <div className="mm-wave-line mt-5" />
        </div>

        <form onSubmit={submit} className="mt-6 sm:mt-8 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-white/50">
                Your name
              </label>
              <input
                data-testid="signup-firstname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Karan"
                className="mm-input mt-2"
                autoFocus
                required
              />
            </div>
          )}
          <div>
            <label className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-white/50">
              Email
            </label>
            <input
              type="email"
              data-testid={mode === "signup" ? "signup-email" : "login-email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mm-input mt-2"
              autoFocus={mode === "login"}
              required
            />
          </div>
          <div>
            <label className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-white/50">
              Password
            </label>
            <input
              type="password"
              data-testid={mode === "signup" ? "signup-password" : "login-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Min 6 characters" : "••••••••"}
              className="mm-input mt-2"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mm-btn-primary w-full text-sm disabled:opacity-50"
            data-testid={mode === "signup" ? "signup-submit-btn" : "login-submit-btn"}
          >
            {loading
              ? mode === "signup"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-white/55">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={toggle}
            className="mm-text-gold-bright underline underline-offset-2"
            data-testid="toggle-auth-mode"
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>

        <div className="mt-6 sm:mt-8 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60 text-center">
          Calm · Intelligent · In control
        </div>
      </div>
    </div>
  );
}
