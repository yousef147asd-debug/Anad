/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — themes.js
   Rose Garden · Lavender Dreams · Midnight Letters
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const THEMES = ["rose-garden", "lavender-dreams", "midnight-letters"];
  const LS_KEY = "olw-theme"; // harmless UI preference only

  function apply(theme) {
    if (!THEMES.includes(theme)) theme = THEMES[0];
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll(".theme-swatch").forEach((b) =>
      b.setAttribute("aria-checked", String(b.dataset.themeChoice === theme)));
    try { localStorage.setItem(LS_KEY, theme); } catch (_) {}
  }

  async function persist(theme) {
    // Saved to the database when a real connection exists;
    // localStorage is only ever a convenience fallback.
    if (OLW.state.mode === "live" && OLW.state.persona) {
      try {
        await OLW.backend.saveTheme(OLW_IDS.PROFILES[OLW.state.persona], theme);
      } catch (e) { console.warn("Theme save failed:", e.message); }
    }
  }

  async function restoreForPersona() {
    let theme = null;
    if (OLW.state.mode === "live" && OLW.state.persona) {
      try { theme = await OLW.backend.getTheme(OLW_IDS.PROFILES[OLW.state.persona]); }
      catch (e) { console.warn("Theme load failed:", e.message); }
    }
    if (!theme) { try { theme = localStorage.getItem(LS_KEY); } catch (_) {} }
    apply(theme || THEMES[0]);
  }

  function init() {
    document.getElementById("theme-picker")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".theme-swatch");
      if (!btn) return;
      apply(btn.dataset.themeChoice);
      persist(btn.dataset.themeChoice);
    });
    // Apply saved preference immediately (before persona is known)
    let saved = null;
    try { saved = localStorage.getItem(LS_KEY); } catch (_) {}
    if (saved) apply(saved);
  }

  OLW.themes = { init, apply, restoreForPersona };
})();
