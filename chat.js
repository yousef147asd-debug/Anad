/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — chat.js
   Composer, attachments, conversation chrome
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const { toast } = OLW.util;
  let attachedFile = null;

  function setAttachment(file) {
    const err = OLW.uploads.validateImage(file);
    if (err) { toast(err, true); return; }
    attachedFile = file;
    const bar = document.getElementById("attachment-preview");
    document.getElementById("attachment-preview-img").src = URL.createObjectURL(file);
    document.getElementById("attachment-preview-name").textContent = file.name;
    document.getElementById("attachment-preview-size").textContent = OLW.util.bytes(file.size);
    bar.hidden = false;
    document.getElementById("composer-input").focus();
  }

  function clearAttachment() {
    attachedFile = null;
    document.getElementById("attachment-preview").hidden = true;
    document.getElementById("attach-input").value = "";
  }

  function autoGrow(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  }

  function init() {
    const form = document.getElementById("composer");
    const input = document.getElementById("composer-input");
    const attachBtn = document.getElementById("attach-btn");
    const attachInput = document.getElementById("attach-input");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      OLW.messages.send({ text: input.value, attachment: attachedFile });
    });

    // Enter sends, Shift+Enter = newline (mobile keyboards keep their own button)
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && matchMedia("(min-width: 861px)").matches) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    input.addEventListener("input", () => autoGrow(input));

    attachBtn.addEventListener("click", () => attachInput.click());
    attachInput.addEventListener("change", (e) => {
      if (e.target.files[0]) setAttachment(e.target.files[0]);
    });
    document.getElementById("attachment-cancel").addEventListener("click", clearAttachment);

    document.getElementById("header-memories-btn").addEventListener("click", () =>
      OLW.app.showView("memories"));
    document.getElementById("header-gallery-btn").addEventListener("click", () =>
      OLW.app.showView("gallery"));

  }

  /* Personalized composer greeting — called once the persona is known */
  function personalize() {
    const input = document.getElementById("composer-input");
    input.placeholder = OLW.state.persona === "Yousef"
      ? "Write something lovely for Agatha…"
      : "Write something lovely for Yousef…";
  }

  OLW.chat = { init, clearAttachment, personalize };
})();
