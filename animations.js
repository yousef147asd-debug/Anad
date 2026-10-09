/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — animations.js
   Welcome particles, entrance flourishes, modal helpers.
   All decorative motion respects prefers-reduced-motion.
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function spawnParticles() {
    if (reduced()) return;
    const field = document.getElementById("particle-field");
    if (!field || field.childElementCount) return;
    const count = innerWidth < 700 ? 14 : 26;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      const size = 3 + Math.random() * 5;
      p.style.width = p.style.height = size + "px";
      p.style.left = Math.random() * 100 + "%";
      p.style.top = 20 + Math.random() * 80 + "%";
      p.style.setProperty("--dur", 9 + Math.random() * 9 + "s");
      p.style.setProperty("--delay", -Math.random() * 12 + "s");
      field.appendChild(p);
    }
  }

  /* Smooth welcome → app transition with a small heart flourish */
  function leaveWelcome(cb) {
    const welcome = document.getElementById("welcome-screen");
    const app = document.getElementById("app");
    const heart = document.querySelector(".welcome-heart");

    const finish = () => {
      welcome.hidden = true;
      welcome.classList.remove("leaving");
      app.hidden = false;
      cb?.();
    };

    if (reduced()) { finish(); return; }

    if (heart) {
      const r = heart.getBoundingClientRect();
      OLW.util.heartBurst(r.left + r.width / 2, r.top + r.height / 2, "❤️");
    }
    welcome.classList.add("leaving");
    setTimeout(finish, 620);
  }

  /* Modal open/close with focus management */
  let lastFocus = null;
  function openModal(backdrop) {
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    const focusable = backdrop.querySelector("input, textarea, button:not(.icon-btn)");
    setTimeout(() => (focusable || backdrop.querySelector("button"))?.focus(), 60);
  }
  function closeModal(backdrop) {
    backdrop.hidden = true;
    if (lastFocus?.isConnected) lastFocus.focus();
  }

  /* Close modals on Escape + backdrop click */
  function initModalBehavior() {
    document.querySelectorAll(".modal-backdrop").forEach((bd) => {
      bd.addEventListener("click", (e) => { if (e.target === bd) closeModal(bd); });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const open = document.querySelector(".modal-backdrop:not([hidden])");
      if (open) closeModal(open);
      const viewer = document.getElementById("image-viewer");
      if (!viewer.hidden) OLW.uploads.closeViewer();
    });
  }

  function refreshIcons() {
    if (window.lucide) lucide.createIcons();
  }

  OLW.anim = { spawnParticles, leaveWelcome, openModal, closeModal, initModalBehavior, refreshIcons, reduced };
})();
