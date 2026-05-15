import axios from "axios";
import { getCurrentProjectId } from "@/lib/projects";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

// Routes that should automatically be scoped to the current project.
const PROJECT_SCOPED = [
  "/tasks", "/routines", "/transactions", "/notes",
  "/reminders", "/deadlines",
];

function shouldScope(url) {
  if (!url) return false;
  // Match `/tasks`, `/tasks/123`, `/tasks/123/attachments` etc. — but NOT
  // `/tasks/reorder` or `/notes/append-list` (those are scoped server-side
  // via user_id alone).
  return PROJECT_SCOPED.some((base) => {
    if (url === base) return true;
    if (url.startsWith(`${base}/`)) return true;
    return false;
  });
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const pid = getCurrentProjectId();
  if (pid && shouldScope(config.url || "")) {
    if ((config.method || "get").toLowerCase() === "get") {
      config.params = { ...(config.params || {}), project_id: pid };
    } else if (
      config.data &&
      typeof config.data === "object" &&
      !(config.data instanceof FormData) &&
      !Array.isArray(config.data) &&
      config.data.project_id === undefined
    ) {
      // Only inject for plain JSON object bodies on create/update calls.
      config.data = { ...config.data, project_id: pid };
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("mm_token");
    }
    return Promise.reject(err);
  }
);

// Side-effect: attaches offline-queue interceptor + boots drain loop.
// Imported here so every app load gets it without each page wiring it up.
import("./syncQueue");

/** Quick attachment upload helper used by row drag-drop in RowActions. */
export async function uploadRowAttachment(module, rowId, file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/${module}/${rowId}/attachments`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
