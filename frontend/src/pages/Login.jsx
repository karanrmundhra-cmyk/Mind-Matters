import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import Logo from "@/components/Logo";
import { api } from "@/lib/api";
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
  const { login, signup, refresh } = useAuth();
  // login | signup | forgot | reset
  const [mode, setMode] = useState("login");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [deliveredVia, setDeliveredVia] = useState("");
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
        navigate(from, { replace: true });
      } else if (mode === "login") {
        await login(email.trim().toLowerCase(), password);
        toast.success("Welcome back");
        navigate(from, { replace: true });
      } else if (mode === "forgot") {
        const { data } = await api.post("/auth/forgot", { email: email.trim().toLowerCase() });
        if (data?.code) {
          setIssuedCode(data.code);
          setDeliveredVia(data.delivered_via || "screen");
        }
        setMode("reset");
        toast.success(
          data?.delivered_via === "telegram+screen"
            ? "Code sent to your Telegram (also shown below)"
            : "If that email exists, a reset code was generated",
        );
      } else if (mode === "reset") {
        const { data } = await api.post("/auth/reset", {
          email: email.trim().toLowerCase(),
          code: code.trim(),
          new_password: newPassword,
        });
        // Store the freshly-issued token and go to dashboard.
        if (data?.token) {
          localStorage.setItem("mm_token", data.token);
          await refresh?.();
        }
        toast.success("Password updated — you're signed in");
        navigate(from, { replace: true });
      }
    } catch (err) {
      toast.error(formatErr(err?.response?.data?.detail) || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const goTo = (next) => {
    setMode(next);
    setIssuedCode("");
    setCode("");
    setNewPassword("");
    setPassword("");
  };

  const title = {
    login: "Sign in",
    signup: "Create account",
    forgot: "Reset password",
    reset: "Enter new password",
  }[mode];

  const cta = {
    login: loading ? "Signing in…" : "Sign in",
    signup: loading ? "Creating account…" : "Create account",
    forgot: loading ? "Sending code…" : "Send reset code",
    reset: loading ? "Saving…" : "Update password",
  }[mode];

  const ctaTestId = {
    login: "login-submit-btn",
    signup: "signup-submit-btn",
    forgot: "forgot-submit-btn",
    reset: "reset-submit-btn",
  }[mode];

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
          <div className="mt-4 text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/55">
            {title}
          </div>
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

          {mode !== "reset" && (
            <div>
              <label className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-white/50">
                Email
              </label>
              <input
                type="email"
                data-testid={
                  mode === "signup"
                    ? "signup-email"
                    : mode === "forgot"
                      ? "forgot-email"
                      : "login-email"
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mm-input mt-2"
                autoFocus={mode === "login" || mode === "forgot"}
                required
              />
            </div>
          )}

          {(mode === "login" || mode === "signup") && (
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
          )}

          {mode === "reset" && (
            <>
              <div>
                <label className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-white/50">
                  Email
                </label>
                <input
                  type="email"
                  data-testid="reset-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mm-input mt-2"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-white/50">
                  6-digit code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  data-testid="reset-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="••••••"
                  className="mm-input mt-2 tracking-[0.5em] text-center text-base"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-white/50">
                  New password
                </label>
                <input
                  type="password"
                  data-testid="reset-new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="mm-input mt-2"
                  required
                  minLength={6}
                />
              </div>
              {issuedCode && (
                <div
                  className="rounded-lg border border-[rgba(201,169,97,0.3)] bg-[rgba(201,169,97,0.06)] px-4 py-3"
                  data-testid="reset-code-hint"
                >
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/65 mb-1">
                    Your reset code
                    {deliveredVia === "telegram+screen" ? " (also sent to Telegram)" : ""}
                  </div>
                  <div className="mm-font-serif text-2xl mm-text-gold-bright tracking-[0.4em]">
                    {issuedCode}
                  </div>
                  <div className="text-[10px] text-[#B7A98A]/45 mt-1">Expires in 30 minutes.</div>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mm-btn-primary w-full text-sm disabled:opacity-50"
            data-testid={ctaTestId}
          >
            {cta}
          </button>
        </form>

        {/* Footer links */}
        {mode === "login" && (
          <div className="mt-5 text-center text-xs text-white/55 space-y-2">
            <div>
              <button
                type="button"
                onClick={() => goTo("forgot")}
                className="mm-text-gold underline underline-offset-2"
                data-testid="forgot-password-link"
              >
                Forgot password?
              </button>
            </div>
            <div>
              New here?{" "}
              <button
                type="button"
                onClick={() => goTo("signup")}
                className="mm-text-gold-bright underline underline-offset-2"
                data-testid="toggle-auth-mode"
              >
                Create account
              </button>
            </div>
          </div>
        )}

        {mode === "signup" && (
          <div className="mt-5 text-center text-xs text-white/55">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => goTo("login")}
              className="mm-text-gold-bright underline underline-offset-2"
              data-testid="toggle-auth-mode"
            >
              Sign in
            </button>
          </div>
        )}

        {(mode === "forgot" || mode === "reset") && (
          <div className="mt-5 text-center text-xs text-white/55 space-y-2">
            {mode === "reset" && (
              <div>
                <button
                  type="button"
                  onClick={() => goTo("forgot")}
                  className="mm-text-gold underline underline-offset-2"
                  data-testid="resend-code-link"
                >
                  Send a new code
                </button>
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => goTo("login")}
                className="mm-text-gold-bright underline underline-offset-2"
                data-testid="back-to-signin"
              >
                ← Back to sign in
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 sm:mt-8 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60 text-center">
          Calm · Intelligent · In control
        </div>
      </div>
    </div>
  );
}
