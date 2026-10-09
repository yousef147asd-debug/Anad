/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — favorites.js
   "Little Things I Love ♡" — personal bookmarked messages
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const { esc, fmtDate, fmtTime, toast } = OLW.util;

  async function render() {
    const list = document.getElementById("favorites-list");
    const empty = document.getElementById("favorites-empty");
    list.innerHTML = "";

    let favs = [];
    try {
      favs = await OLW.backend.listFavorites(OLW_IDS.PROFILES[OLW.state.persona]);
    } catch (e) {
      console.error("Favorites load failed:", e);
      toast("Couldn't load your favorites.", true);
    }

    empty.hidden = favs.length > 0;

    for (const f of favs) {
      const m = f.message;
      const sender = OLW.messages.nameOf(m.sender_id);
      const item = document.createElement("button");
      item.className = "favorite-item";
      item.innerHTML = `
        <span class="favorite-icon"><i data-lucide="bookmark"></i></span>
        <div class="favorite-body">
          <p class="favorite-text">${m.message_text ? esc(m.message_text) : "<em>📷 Photo message</em>"}</p>
          <div class="favorite-meta">
            <strong>${esc(sender)}</strong>
            <span>${esc(fmtDate(m.created_at))} · ${esc(fmtTime(m.created_at))}</span>
            <span>Tap to view in conversation</span>
          </div>
        </div>
        ${m.attachment_path ? `<img class="favorite-thumb" alt="Attachment" data-fav-thumb="${esc(m.attachment_path)}" />` : ""}`;
      item.addEventListener("click", () => jumpToMessage(m.id));
      list.appendChild(item);
    }

    // hydrate thumbnails
    for (const img of list.querySelectorAll("[data-fav-thumb]")) {
      const url = await OLW.uploads.urlFor(OLW_IDS.BUCKETS.attachments, img.dataset.favThumb);
      if (url) img.src = url; else img.remove();
    }
    OLW.anim.refreshIcons();
  }

  function jumpToMessage(id) {
    OLW.app.showView("chat");
    const row = document.querySelector(`[data-msg-id="${id}"]`);
    if (row) {
      row.scrollIntoView({ behavior: OLW.anim.reduced() ? "auto" : "smooth", block: "center" });
      row.style.transition = "filter .3s";
      row.style.filter = "drop-shadow(0 0 12px var(--accent))";
      setTimeout(() => (row.style.filter = ""), 1600);
    } else {
      toast("That message is further back — load older messages to see it in context.");
    }
  }

  OLW.favorites = { render };
})();
