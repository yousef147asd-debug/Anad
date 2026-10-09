/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — login.js
   Welcome screen: persona cards, name entry, optional
   Supabase Auth (email mode).
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const APPROVED = { yousef: "Yousef", agatha: "Agatha" };

  function normalize(name) {
    return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function validateName(raw) {
    return APPROVED[normalize(raw)] || null;
  }

  function showError(msg) {
    const err = document.getElementById("name-error");
    const input = document.getElementById("name-input");
    err.textContent = msg;
    err.hidden = false;
    input.classList.remove("shake");
    void input.offsetWidth; // restart animation
    input.classList.add("shake");
    input.focus();
  }

  /* Enter the app as a persona */
  async function enter(persona) {
    OLW.state.persona = persona;
    OLW.util.toast(`Welcome back, ${persona} ♡`);
    OLW.anim.leaveWelcome(() => OLW.app.start());
  }

  /* In email mode the name form becomes a real sign-in form */
  function adaptForAuthMode() {
    if (OLW_CONFIG.AUTH_MODE !== "email") return;
    const form = document.getElementById("name-form");
    const input = document.getElementById("name-input");
    input.type = "email";
    input.placeholder = "Your email…";
    input.autocomplete = "email";
    input.maxLength = 120;

    const pass = document.createElement("input");
    pass.type = "password";
    pass.id = "pass-input";
    pass.placeholder = "Your password…";
    pass.autocomplete = "current-password";
    pass.maxLength = 120;
    pass.style.cssText = input.style.cssText;
    pass.className = input.className;
    form.insertBefore(pass, form.querySelector("button"));

    // Profile cards require a session in email mode
    document.querySelectorAll(".profile-enter").forEach((b) => {
      b.disabled = true;
      b.textContent = "Sign in below first";
    });
  }

  function init() {
    adaptForAuthMode();

    document.querySelectorAll(".profile-enter").forEach((btn) => {
      btn.addEventListener("click", () => enter(btn.dataset.enter));
    });

    document.getElementById("name-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      document.getElementById("name-error").hidden = true;

      if (OLW_CONFIG.AUTH_MODE === "email") {
        const email = document.getElementById("name-input").value.trim();
        const pass = document.getElementById("pass-input").value;
        if (!email || !pass) { showError("Enter your email and password, love."); return; }
        const btn = e.target.querySelector("button[type=submit]");
        btn.disabled = true; btn.textContent = "Signing in…";
        try {
          const persona = await OLW.backend.signIn(email, pass);
          await enter(persona);
        } catch (err) {
          console.warn("Sign-in failed:", err.message);
          showError("Couldn't sign in — check your email and password.");
        } finally {
          btn.disabled = false; btn.textContent = "Step Inside ♡";
        }
        return;
      }

      const persona = validateName(document.getElementById("name-input").value);
      if (persona) {
        await enter(persona);
      } else {
        showError("Hmm… this little world is only for Yousef and Agatha. ♡");
      }
    });

    document.getElementById("name-input").addEventListener("input", () => {
      document.getElementById("name-error").hidden = true;
    });
  }

  OLW.login = { init, validateName };
})();
