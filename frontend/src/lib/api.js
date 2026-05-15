import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
