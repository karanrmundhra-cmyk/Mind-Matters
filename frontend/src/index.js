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
