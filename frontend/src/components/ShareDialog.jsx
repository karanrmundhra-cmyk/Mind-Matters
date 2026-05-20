import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Users, X, UserPlus, Crown, Pencil, MessageSquare, Eye } from "lucide-react";
import { useProjects } from "@/lib/projects";

const ROLES = [
  { value: "admin", label: "Admin", desc: "Full control", icon: Crown },
  { value: "editor", label: "Editor", desc: "Create + edit rows", icon: Pencil },
  { value: "commenter", label: "Commenter", desc: "View + comment", icon: MessageSquare },
  { value: "viewer", label: "Viewer", desc: "Read-only", icon: Eye },
];

export default function ShareDialog({ project, onClose }) {
  const [members, setMembers] = useState(null);
  const [owner, setOwner] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const { reload } = useProjects();

  const load = useCallback(async () => {
    if (!project) return;
    try {
      const { data } = await api.get(`/projects/${project.id}/members`);
      setOwner(data.owner);
      setMembers(data.members || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load members");
    }
  }, [project]);

  useEffect(() => {
    if (project) {
      setMembers(null);
      setOwner(null);
      setEmail("");
      setRole("editor");
      load();
    }
  }, [project, load]);

  if (!project) return null;

  const handleInvite = async (e) => {
    e?.preventDefault?.();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${project.id}/share`, {
        email: email.trim(),
        role,
      });
      const link = data.invite_url
        ? `${window.location.origin}${data.invite_url.startsWith("/") ? "" : "/"}${data.invite_url.replace(/^https?:\/\/[^/]+/, "")}`
        : null;
      if (link) {
        try {
          await navigator.clipboard.writeText(link);
          toast.success(`Invited ${email.trim()} — invite link copied!`);
        } catch {
          toast.success(`Invited ${email.trim()}`);
        }
      } else {
        toast.success(`Invited ${email.trim()}`);
      }
      setEmail("");
      await load();
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not invite");
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (memberId, newRole) => {
    try {
      await api.patch(`/projects/${project.id}/members/${memberId}`, { role: newRole });
      await load();
      toast.success("Role updated");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not update");
    }
  };

  const removeMember = async (memberId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await api.delete(`/projects/${project.id}/members/${memberId}`);
      await load();
      await reload();
      toast.success("Removed");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not remove");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="share-dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mm-glass rounded-2xl border border-[rgba(201,169,97,0.3)] p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
              Share project
            </div>
            <div className="mm-font-display text-lg mm-text-gold-bright mt-1 flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project.color || "#C9A961" }}
              />
              {project.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition"
            data-testid="share-close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70 block mb-1.5">
              Invite by email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@email.com"
              className="w-full px-4 py-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(201,169,97,0.25)] rounded-lg text-sm text-[var(--mm-text)] placeholder-[#B7A98A]/50 focus:outline-none focus:ring-2 focus:ring-[#C9A961]/50 focus:border-[#C9A961]/60 transition"
              data-testid="share-email-input"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70 block mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(201,169,97,0.25)] rounded-lg text-sm text-[var(--mm-text)] focus:outline-none focus:ring-2 focus:ring-[#C9A961]/50 focus:border-[#C9A961]/60 transition"
              data-testid="share-role-select"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-3 bg-[#C9A961] hover:bg-[#E4C98C] text-black font-medium rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition"
            data-testid="share-invite-btn"
          >
            <UserPlus size={15} /> {busy ? "Sending…" : "Send Invite"}
          </button>
        </form>

        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70 mb-2 flex items-center gap-2">
            <Users size={11} /> Members
          </div>
          {!members ? (
            <div className="text-xs text-[#B7A98A]/50 py-3 text-center">Loading…</div>
          ) : (
            <div className="space-y-1.5">
              {owner && (
                <div
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[rgba(201,169,97,0.18)] bg-[rgba(201,169,97,0.05)]"
                  data-testid="share-owner-row"
                >
                  <Crown size={13} className="text-[#E4C98C]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs mm-text-gold-bright truncate">
                      {owner.first_name || owner.email}
                    </div>
                    <div className="text-[10px] text-[#B7A98A]/55 truncate">
                      {owner.email}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[#B7A98A]/65">
                    Owner
                  </span>
                </div>
              )}
              {members.length === 0 && (
                <div className="text-xs text-[#B7A98A]/45 py-3 text-center border border-dashed border-[rgba(201,169,97,0.15)] rounded-lg">
                  No collaborators yet — invite someone above.
                </div>
              )}
              {members.map((m) => {
                const RoleIcon =
                  ROLES.find((r) => r.value === m.role)?.icon || Eye;
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[rgba(201,169,97,0.15)] hover:border-[rgba(201,169,97,0.3)] transition"
                    data-testid={`share-member-${m.id}`}
                  >
                    <RoleIcon size={13} className="text-[#B7A98A]/75" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs mm-text-gold-bright truncate">
                        {m.invited_email}
                      </div>
                      <div className="text-[10px] text-[#B7A98A]/55">
                        {m.accepted ? "Joined" : "Invitation pending"}
                      </div>
                    </div>
                    <select
                      value={m.role}
                      onChange={(e) => updateRole(m.id, e.target.value)}
                      className="mm-input-ghost text-xs !py-1 w-28"
                      data-testid={`share-member-role-${m.id}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeMember(m.id)}
                      className="p-1 rounded text-[#B7A98A]/55 hover:text-red-300 hover:bg-[rgba(255,100,100,0.1)] transition"
                      title="Remove"
                      data-testid={`share-member-remove-${m.id}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
