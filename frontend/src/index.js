import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Apply saved theme + focus mode before first paint to avoid a flash.
(() => {
  try {
    const t = localStorage.getItem("mm_theme");
    if (t === "light") document.documentElement.classList.add("light");
    if (localStorage.getItem("mm_focus_mode") === "1")
      document.documentElement.classList.add("focus-mode");
  } catch { /* */ }
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for offline page caching. Skipped on localhost dev
// reloads to avoid stale-cache pain; runs on every other origin (preview + prod).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const isLocalDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocalDev) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW register failed:", err));
  });
}
