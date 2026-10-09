/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — messages.js
   Message store, rendering, pagination, realtime, actions
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const { esc, fmtTime, fmtDate, toast } = OLW.util;

  const store = {
    byId: new Map(),      // id → message object (stable IDs prevent duplicates)
    order: [],            // ids ascending by created_at
    oldestLoaded: null,   // created_at cursor for pagination
    hasMore: false,
    loadingOlder: false,
  };

  const me = () => OLW_IDS.PROFILES[OLW.state.persona];
  const otherName = () => (OLW.state.persona === "Yousef" ? "Agatha" : "Yousef");

  function nameOf(profileId) {
    for (const [name, id] of Object.entries(OLW_IDS.PROFILES))
      if (id === profileId) return name;
    return "…";
  }

  /* ── Store ops ── */
  function upsert(msg) {
    if (!msg?.id || store.byId.has(msg.id)) return false; // dedupe by stable ID
    store.byId.set(msg.id, msg);
    // insert keeping ascending created_at order
    let i = store.order.length;
    while (i > 0) {
      const prev = store.byId.get(store.order[i - 1]);
      if (new Date(prev.created_at) <= new Date(msg.created_at)) break;
      i--;
    }
    store.order.splice(i, 0, msg.id);
    return true;
  }

  /* ── Rendering ── */
  function messageHtml(msg) {
    const own = msg.sender_id === me();
    const senderName = nameOf(msg.sender_id);
    const reactions = OLW.reactions.chipsHtml(msg.message_reactions, me());
    const isFav = (msg.favorites || []).some((f) => f.user_id === me());
    const img = msg.attachment_path
      ? `<button class="msg-image" data-img-path="${esc(msg.attachment_path)}" aria-label="Open photo">
           <span class="muted" style="font-size:.8rem">Loading photo…</span></button>` : "";
    const text = msg.message_text ? `<p class="msg-text">${esc(msg.message_text)}</p>` : "";

    return `
      <div class="msg-row ${own ? "own" : "other"}" data-msg-id="${msg.id}">
        <div class="msg-bubble ${msg._pending ? "sending" : ""}">
          ${own ? "" : `<div class="msg-sender">${esc(senderName)}</div>`}
          ${img}${text}
          <div class="msg-meta">
            <span class="msg-status">${msg._failed
              ? `<span class="failed">Not sent</span> <button class="msg-retry" data-retry="${msg.id}">Retry</button>`
              : fmtTime(msg.created_at)}</span>
          </div>
        </div>
        <div class="msg-reactions" data-reactions-for="${msg.id}">${reactions}</div>
        <div class="msg-actions">
          <button class="msg-action-btn" data-react-open data-action="react" aria-label="React to message"><i data-lucide="heart"></i></button>
          <button class="msg-action-btn ${isFav ? "active" : ""}" data-action="favorite" aria-label="${isFav ? "Remove from favorites" : "Bookmark message"}"><i data-lucide="bookmark"></i></button>
        </div>
      </div>`;
  }

  function renderAll() {
    const list = document.getElementById("message-list");
    const empty = document.getElementById("chat-empty");
    empty.hidden = store.order.length > 0;

    let html = "";
    let lastDay = "";
    for (const id of store.order) {
      const msg = store.byId.get(id);
      const day = fmtDate(msg.created_at);
      if (day !== lastDay) {
        html += `<div class="date-separator">${esc(day)}</div>`;
        lastDay = day;
      }
      html += messageHtml(msg);
    }
    list.innerHTML = html;
    OLW.anim.refreshIcons();
    hydrateImages(list);
    scrollToBottom(false);
  }

  function appendMessage(msg, { scroll = true } = {}) {
    if (!upsert(msg)) return;
    renderAll();
    if (scroll) scrollToBottom(true);
  }

  function prependOlder(msgs) {
    let added = 0;
    for (const m of msgs) added += upsert(m) ? 1 : 0;
    if (added) renderAll();
    return added;
  }

  async function hydrateImages(root) {
    for (const btn of root.querySelectorAll(".msg-image[data-img-path]")) {
      if (btn.dataset.hydrated) continue;
      btn.dataset.hydrated = "1";
      const url = await OLW.uploads.urlFor(OLW_IDS.BUCKETS.attachments, btn.dataset.imgPath);
      if (url) {
        btn.innerHTML = `<img src="${url}" alt="Shared photo" loading="lazy" />`;
        btn.addEventListener("click", () =>
          OLW.uploads.openViewer([{ url, caption: "Sent with love ♡" }]));
      } else {
        btn.innerHTML = `<span class="muted" style="font-size:.8rem">Photo unavailable</span>`;
      }
    }
  }

  function scrollToBottom(smooth) {
    const sc = document.getElementById("chat-scroll");
    sc.scrollTo({ top: sc.scrollHeight, behavior: smooth && !OLW.anim.reduced() ? "smooth" : "auto" });
  }

  /* ── Loading ── */
  async function loadInitial() {
    store.byId.clear(); store.order = [];
    try {
      const msgs = await OLW.backend.listMessages({ limit: 40 });
      msgs.forEach((m) => upsert(m));
      store.hasMore = msgs.length >= 40;
      store.oldestLoaded = msgs[0]?.created_at || null;
      document.getElementById("load-older-btn").hidden = !store.hasMore;
      renderAll();
    } catch (e) {
      console.error("Message load failed:", e);
      toast("Couldn't load messages — check your connection.", true);
    }
  }

  async function loadOlder() {
    if (store.loadingOlder || !store.oldestLoaded) return;
    store.loadingOlder = true;
    const btn = document.getElementById("load-older-btn");
    btn.disabled = true; btn.textContent = "Loading…";
    try {
      const msgs = await OLW.backend.listMessages({ limit: 40, before: store.oldestLoaded });
      const sc = document.getElementById("chat-scroll");
      const prevHeight = sc.scrollHeight;
      prependOlder(msgs);
      sc.scrollTop = sc.scrollHeight - prevHeight; // keep viewport stable
      store.hasMore = msgs.length >= 40;
      if (msgs.length) store.oldestLoaded = msgs[0].created_at;
      btn.hidden = !store.hasMore;
    } catch (e) {
      console.error("Older messages failed:", e);
      toast("Couldn't load older messages.", true);
    } finally {
      btn.disabled = false; btn.textContent = "Load older messages";
      store.loadingOlder = false;
    }
  }

  /* ── Sending (with pending / failed / retry states) ── */
  async function send({ text, attachment }) {
    text = (text || "").trim();
    if (!text && !attachment) return;
    if (text.length > 4000) { toast("That message is a little too long (4000 max).", true); return; }

    const input = document.getElementById("composer-input");
    const sendBtn = document.getElementById("send-btn");
    sendBtn.disabled = true;

    // optimistic pending bubble
    const pendingId = "pending-" + OLW.util.uuid();
    const pendingMsg = {
      id: pendingId, sender_id: me(), message_text: text || null,
      attachment_path: null, created_at: new Date().toISOString(),
      message_reactions: [], favorites: [], _pending: true,
    };
    if (attachment) {
      pendingMsg._localPreview = URL.createObjectURL(attachment);
    }
    appendMessage(pendingMsg);
    input.value = ""; input.dispatchEvent(new Event("input"));

    try {
      let attachmentPath = null, attachmentType = null;
      if (attachment) {
        const res = await OLW.uploads.upload(attachment, OLW_IDS.BUCKETS.attachments);
        attachmentPath = res.path; attachmentType = attachment.type;
      }
      const saved = await OLW.backend.sendMessage({
        senderId: me(), text, attachmentPath, attachmentType,
      });
      removeMessage(pendingId);
      appendMessage(saved); // realtime echo is deduped by stable ID
      OLW.chat.clearAttachment();
    } catch (e) {
      console.error("Send failed:", e);
      const failed = store.byId.get(pendingId);
      if (failed) {
        failed._pending = false; failed._failed = true;
        failed._retryPayload = { text, attachment };
        renderAll();
      }
      toast("Message couldn't be sent — tap Retry on it.", true);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function removeMessage(id) {
    store.byId.delete(id);
    store.order = store.order.filter((x) => x !== id);
    renderAll();
  }

  async function retry(id) {
    const msg = store.byId.get(id);
    if (!msg?._retryPayload) return;
    removeMessage(id);
    await send(msg._retryPayload);
  }

  /* ── Reactions & favorites on messages ── */
  async function reactTo(messageId, emoji) {
    const msg = store.byId.get(messageId);
    if (!msg) return;
    const mine = (msg.message_reactions || []).find((r) => r.user_id === me());
    const same = mine && mine.reaction === emoji;
    // toggle off if same emoji, otherwise set/change
    const reactions = await OLW.backend.toggleReaction(messageId, me(), emoji, same);
    msg.message_reactions = reactions;
    updateReactionChips(messageId);
  }

  function updateReactionChips(messageId) {
    const msg = store.byId.get(messageId);
    const wrap = document.querySelector(`[data-reactions-for="${messageId}"]`);
    if (msg && wrap) wrap.innerHTML = OLW.reactions.chipsHtml(msg.message_reactions, me());
  }

  async function toggleFav(messageId, btn) {
    const msg = store.byId.get(messageId);
    if (!msg) return;
    const isFav = (msg.favorites || []).some((f) => f.user_id === me());
    try {
      const nowFav = await OLW.backend.toggleFavorite(me(), messageId, isFav);
      msg.favorites = nowFav
        ? [...(msg.favorites || []).filter((f) => f.user_id !== me()), { user_id: me() }]
        : (msg.favorites || []).filter((f) => f.user_id !== me());
      btn?.classList.toggle("active", nowFav);
      btn?.setAttribute("aria-label", nowFav ? "Remove from favorites" : "Bookmark message");
      toast(nowFav ? "Saved to Little Things I Love ♡" : "Removed from favorites");
      if (nowFav && btn) {
        const r = btn.getBoundingClientRect();
        OLW.util.heartBurst(r.left + r.width / 2, r.top, "💕");
      }
    } catch (e) {
      console.error("Favorite failed:", e);
      toast("Couldn't update favorites.", true);
    }
  }

  /* ── Realtime ── */
  function onRealtimeInsert(row) {
    if (store.byId.has(row.id)) return; // our own optimistic insert already shown
    appendMessage({
      ...row, message_reactions: [], favorites: [],
    });
    // Reaction changes arrive on their own channel; nothing else to fetch.
  }

  async function onRealtimeReaction(messageId) {
    if (!messageId || !store.byId.has(messageId) || OLW.state.mode !== "live") return;
    try {
      const { data } = await OLW.backend.client.from("message_reactions")
        .select("id,user_id,reaction").eq("message_id", messageId);
      const msg = store.byId.get(messageId);
      if (msg && data) { msg.message_reactions = data; updateReactionChips(messageId); }
    } catch (e) { console.warn("Reaction sync failed:", e.message); }
  }

  /* ── Event wiring ── */
  function init() {
    document.getElementById("load-older-btn").addEventListener("click", loadOlder);

    const list = document.getElementById("message-list");
    list.addEventListener("click", (e) => {
      const row = e.target.closest(".msg-row");
      if (!row) return;
      const id = row.dataset.msgId;

      const retryBtn = e.target.closest("[data-retry]");
      if (retryBtn) { retry(retryBtn.dataset.retry); return; }

      const chip = e.target.closest(".reaction-chip");
      if (chip) {
        reactTo(id, chip.dataset.emoji).catch((err) => {
          console.warn(err); toast("Couldn't update that reaction.", true);
        });
        return;
      }

      const actionBtn = e.target.closest(".msg-action-btn");
      if (actionBtn?.dataset.action === "react") {
        OLW.reactions.openReactionPicker(actionBtn, "message", id);
        return;
      }
      if (actionBtn?.dataset.action === "favorite") {
        toggleFav(id, actionBtn);
        return;
      }
    });

    // Long-press on mobile opens the reaction picker
    let pressTimer = null;
    list.addEventListener("touchstart", (e) => {
      const row = e.target.closest(".msg-row");
      if (!row) return;
      pressTimer = setTimeout(() => {
        OLW.reactions.openReactionPicker(row.querySelector(".msg-bubble"), "message", row.dataset.msgId);
      }, 550);
    }, { passive: true });
    ["touchend", "touchmove", "touchcancel"].forEach((ev) =>
      list.addEventListener(ev, () => clearTimeout(pressTimer), { passive: true }));
  }

  OLW.messages = {
    init, loadInitial, loadOlder, send, reactTo, toggleFav, nameOf,
    onRealtimeInsert, onRealtimeReaction, scrollToBottom, store,
  };
})();
