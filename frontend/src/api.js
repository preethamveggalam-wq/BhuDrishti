const configured = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

// Public SIH deployment fallback: if Vercel was deployed without the
// VITE_API_URL variable, keep API calls pointed at the live Render backend.
const publicFallback = typeof window !== "undefined" && /(^|\.)vercel\.app$/i.test(window.location.hostname)
  ? "https://bhudrishti.onrender.com/api"
  : "/api";

export const API_BASE = configured
  ? (configured.endsWith("/api") ? configured : `${configured}/api`)
  : publicFallback;
