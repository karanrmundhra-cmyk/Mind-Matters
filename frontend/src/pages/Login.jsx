import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import Logo from "@/components/Logo";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      await login(name.trim() || "Friend");
      toast.success("Welcome to Mind Matters");
      navigate(from, { replace: true });
    } catch (err) {
      toast.error("Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6" data-testid="login-page">
      <div className="mm-glass w-full max-w-md p-10 mm-fade-in">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <div className="mt-4 mm-font-serif text-3xl text-white">Mind Matters</div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/40 mt-2">
            Personal Operating System
          </div>
          <div className="mm-wave-line mt-5" />
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.25em] text-white/50">
              First name
            </label>
            <input
              data-testid="login-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arjun"
              className="mm-input mt-2"
              autoFocus
            />
            <div className="text-xs text-white/35 mt-1.5">
              Used to greet you on the dashboard.
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mm-btn-primary w-full text-sm disabled:opacity-50"
            data-testid="login-submit-btn"
          >
            {loading ? "Entering…" : "Enter Mind Matters"}
          </button>
        </form>

        <div className="mt-8 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60 text-center">
          Calm · Intelligent · In control
        </div>
      </div>
    </div>
  );
}
