/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — reactions.js
   Emoji picker (composer) + reaction picker (messages/memories)
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const { esc, heartBurst, toast } = OLW.util;

  /* ── Composer emoji picker ── */
  function initEmojiPicker() {
    const picker = document.getElementById("emoji-picker");
    const btn = document.getElementById("emoji-btn");
    const input = document.getElementById("composer-input");

    picker.innerHTML = OLW_EMOJIS.map((e) =>
      `<button type="button" class="picker-emoji" role="menuitem" aria-label="Insert ${esc(e)}">${e}</button>`
    ).join("");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (picker.hidden) {
        const r = btn.getBoundingClientRect();
        picker.hidden = false;
        const pw = picker.offsetWidth;
        picker.style.left = Math.max(8, Math.min(r.left, innerWidth - pw - 8)) + "px";
        picker.style.bottom = (innerHeight - r.top + 10) + "px";
      } else picker.hidden = true;
    });

    picker.addEventListener("click", (e) => {
      const b = e.target.closest(".picker-emoji");
      if (!b) return;
      const start = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(0, start) + b.textContent + input.value.slice(input.selectionEnd ?? start);
      input.focus();
      input.selectionStart = input.selectionEnd = start + b.textContent.length;
    });

    document.addEventListener("click", (e) => {
      if (!picker.hidden && !picker.contains(e.target) && e.target !== btn) picker.hidden = true;
    });
  }

  /* ── Reaction picker popover (shared by messages & memories) ── */
  const picker = () => document.getElementById("reaction-picker");
  let pickerTarget = null; // {kind:'message'|'memory', id}

  function openReactionPicker(anchorEl, kind, id) {
    const p = picker();
    pickerTarget = { kind, id };
    p.innerHTML = OLW_EMOJIS.map((e) =>
      `<button type="button" class="picker-emoji" role="menuitem" aria-label="React ${esc(e)}">${e}</button>`
    ).join("");
    p.hidden = false;
    const r = anchorEl.getBoundingClientRect();
    const pw = p.offsetWidth, ph = p.offsetHeight;
    let left = Math.max(8, Math.min(r.left + r.width / 2 - pw / 2, innerWidth - pw - 8));
    let top = r.top - ph - 8;
    if (top < 8) top = r.bottom + 8;
    p.style.left = left + "px";
    p.style.top = top + "px";
    p.style.bottom = "auto";
  }

  function closeReactionPicker() { picker().hidden = true; pickerTarget = null; }

  function initReactionPicker() {
    picker().addEventListener("click", async (e) => {
      const b = e.target.closest(".picker-emoji");
      if (!b || !pickerTarget) return;
      const emoji = b.textContent;
      const { kind, id } = pickerTarget;
      closeReactionPicker();
      const rect = b.getBoundingClientRect();
      try {
        if (kind === "message") await OLW.messages.reactTo(id, emoji);
        else await OLW.memories.reactTo(id, emoji);
        heartBurst(rect.left + rect.width / 2, rect.top, emoji);
      } catch (err) {
        console.warn("Reaction failed:", err);
        toast("Couldn't save that reaction — please try again.", true);
      }
    });
    document.addEventListener("click", (e) => {
      const p = picker();
      if (!p.hidden && !p.contains(e.target) && !e.target.closest("[data-react-open]")) closeReactionPicker();
    });
  }

  /* ── Reaction chips rendering (shared markup) ── */
  function chipsHtml(reactions, currentUserId) {
    if (!reactions?.length) return "";
    const byEmoji = new Map();
    for (const r of reactions) {
      if (!byEmoji.has(r.reaction)) byEmoji.set(r.reaction, []);
      byEmoji.get(r.reaction).push(r);
    }
    return [...byEmoji.entries()].map(([emoji, list]) => {
      const mine = list.some((r) => r.user_id === currentUserId);
      const who = list.map((r) => OLW.messages.nameOf(r.user_id)).join(" & ");
      return `<button class="reaction-chip ${mine ? "mine" : ""}" data-emoji="${esc(emoji)}"
        aria-label="${esc(emoji)} reaction by ${esc(who)} — tap to toggle yours">
        ${emoji}<span class="who">${esc(who)}</span></button>`;
    }).join("");
  }

  OLW.reactions = { initEmojiPicker, initReactionPicker, openReactionPicker, closeReactionPicker, chipsHtml };
})();
