const rawConfigured = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

// BhuDrishti's public API. Keep a hard fallback so a Vercel build cannot
// accidentally send API calls back to the static Vercel site (/api/*), which
// produces 405 Method Not Allowed for POST auth requests.
const PUBLIC_API = "https://bhudrishti.onrender.com/api";
const isVercelHost = typeof window !== "undefined" && /(^|\.)vercel\.app$/i.test(window.location.hostname);
const isAbsoluteHttpUrl = /^https?:\/\//i.test(rawConfigured);

// For the public Vercel deployment, only accept an explicit absolute API URL.
// Relative values such as "/api" are intentionally ignored because Vercel is
// hosting the SPA, not the Express API.
const configured = isAbsoluteHttpUrl
  ? (rawConfigured.endsWith("/api") ? rawConfigured : `${rawConfigured}/api`)
  : "";

export const API_BASE = configured || (isVercelHost ? PUBLIC_API : "/api");

// Useful in the browser console when troubleshooting a deployment.
if (typeof window !== "undefined") {
  window.__BHUDRISHTI_API_BASE__ = API_BASE;
}
