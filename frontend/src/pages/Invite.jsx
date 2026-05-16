import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/projects";
import { Users, Crown, Pencil, MessageSquare, Eye, ChevronRight, Mail } from "lucide-react";
import { toast } from "sonner";

const ROLE_META = {
  admin: { icon: Crown, label: "Admin", desc: "Full control" },
  editor: { icon: Pencil, label: "Editor", desc: "Create + edit rows" },
  commenter: { icon: MessageSquare, label: "Commenter", desc: "View + comment" },
  viewer: { icon: Eye, label: "Viewer", desc: "Read-only" },
};

export default function Invite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, signup, login } = useAuth();
  const { reload, setCurrent } = useProjects();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("signup"); // signup | signin
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/invites/${token}`)
      .then(({ data }) => {
        setInvite(data);
        if (data.has_account) setMode("signin");
      })
      .catch((e) => setError(e?.response?.data?.detail || "Invite not found or revoked"));
  }, [token]);

  const acceptCurrent = useCallback(async () => {
    try {
      const { data } = await api.post(`/invites/${token}/accept`, {});
      await reload();
      setCurrent(data.project_id);
      toast.success(`Joined ${invite?.project?.name || "project"}`);
      navigate("/");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not accept invite");
    }
  }, [token, invite, navigate, reload, setCurrent]);

  // Already signed-in flow — just accept (if emails match)
  useEffect(() => {
    if (user && invite && !invite.accepted) {
      if ((user.email || "").toLowerCase() === invite.invited_email.toLowerCase()) {
        acceptCurrent();
      }
    } else if (user && invite?.accepted) {
      navigate("/");
    }
  }, [user, invite, acceptCurrent, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup(firstName.trim() || invite.invited_email.split("@")[0],
                     invite.invited_email, password);
      } else {
        await login(invite.invited_email, password);
      }
      // Auto-claim invite right after auth
      try {
        const { data } = await api.post(`/invites/${token}/accept`, {});
        await reload();
        setCurrent(data.project_id);
        toast.success(`Joined ${invite?.project?.name || "project"}`);
      } catch { /* ignore — auto-accept by email may have already claimed it */ }
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not continue");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" data-testid="invite-error">
        <div className="max-w-md w-full mm-glass border border-[rgba(201,169,97,0.3)] rounded-2xl p-8 text-center space-y-3">
          <Mail size={28} className="mm-text-gold-bright mx-auto" />
          <h1 className="mm-font-display text-xl mm-text-gold-bright">Invite unavailable</h1>
          <p className="text-sm text-[#B7A98A]/70">{error}</p>
          <Link to="/login" className="mm-btn-ghost text-xs inline-flex items-center gap-1">
            Go to sign-in <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xs mm-text-gold/55">Loading invite…</div>
      </div>
    );
  }

  const RoleIcon = ROLE_META[invite.role]?.icon || Eye;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" data-testid="invite-landing">
      <div className="max-w-md w-full mm-glass border border-[rgba(201,169,97,0.3)] rounded-2xl p-8 space-y-6">
        {/* Project header */}
        <div className="text-center space-y-3">
          <div
            className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-lg mm-font-display mm-text-gold-bright border border-[rgba(201,169,97,0.4)]"
            style={{ background: invite.project.color || "#C9A961", color: "#000" }}
            data-testid="invite-project-chip"
          >
            {(invite.project.name || "?")[0]?.toUpperCase()}
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold/70 flex items-center gap-1.5 justify-center">
            <Users size={11} /> You're invited
          </div>
          <h1 className="mm-font-display text-2xl mm-text-gold-bright">
            Join <span className="mm-font-serif italic">{invite.project.name}</span>
          </h1>
          <p className="text-sm text-[#B7A98A]/75">
            {invite.inviter.first_name || invite.inviter.email || "Someone"} invited{" "}
            <span className="mm-text-gold-bright">{invite.invited_email}</span> as
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[rgba(201,169,97,0.25)] bg-[rgba(201,169,97,0.05)]">
            <RoleIcon size={13} className="mm-text-gold-bright" />
            <span className="text-xs mm-text-gold-bright" data-testid="invite-role">
              {ROLE_META[invite.role]?.label || invite.role}
            </span>
            <span className="text-[10px] text-[#B7A98A]/60">
              · {ROLE_META[invite.role]?.desc}
            </span>
          </div>
        </div>

        {/* Auth flow */}
        {invite.accepted ? (
          <div className="text-center text-sm text-[#B7A98A]/75 space-y-3">
            <p>This invite has already been accepted.</p>
            <Link to="/" className="mm-btn-primary text-xs inline-flex items-center gap-1.5">
              Open Mind Matters <ChevronRight size={12} />
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" data-testid="invite-auth-form">
            <div className="flex gap-2 text-[10px] uppercase tracking-[0.3em] mb-1">
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-1.5 rounded transition ${
                  mode === "signup"
                    ? "mm-text-gold-bright bg-[rgba(201,169,97,0.1)]"
                    : "text-[#B7A98A]/55 hover:text-[#E4C98C]"
                }`}
                data-testid="invite-tab-signup"
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 py-1.5 rounded transition ${
                  mode === "signin"
                    ? "mm-text-gold-bright bg-[rgba(201,169,97,0.1)]"
                    : "text-[#B7A98A]/55 hover:text-[#E4C98C]"
                }`}
                data-testid="invite-tab-signin"
              >
                I have an account
              </button>
            </div>
            <input
              type="email"
              value={invite.invited_email}
              readOnly
              className="mm-input text-sm w-full opacity-75 cursor-not-allowed"
              data-testid="invite-email-readonly"
            />
            {mode === "signup" && (
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="mm-input text-sm w-full"
                data-testid="invite-firstname"
              />
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Choose a password (8+ chars)" : "Your password"}
              className="mm-input text-sm w-full"
              data-testid="invite-password"
              required
              minLength={8}
            />
            <button
              type="submit"
              disabled={busy}
              className="mm-btn-primary text-sm w-full disabled:opacity-50"
              data-testid="invite-submit"
            >
              {busy
                ? "Joining…"
                : mode === "signup"
                  ? `Create account & join`
                  : `Sign in & join`}
            </button>
            <p className="text-[10px] text-[#B7A98A]/55 text-center">
              {mode === "signup"
                ? "Your data is private. Only the project you join is shared."
                : "Your password is never shared with the inviter."}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
