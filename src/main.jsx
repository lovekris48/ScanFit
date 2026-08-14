import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Claude's artifact environment provides window.storage.
// This browser fallback lets the prototype run locally using localStorage.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value === null ? null : { value };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { ok: true };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { ok: true };
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
