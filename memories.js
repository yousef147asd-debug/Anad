/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — memories.js
   The Memory Box ✨ — timeline, cards, create/edit/delete
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const { esc, fmtMemoryDate, monthKey, toast, heartBurst } = OLW.util;

  let memories = [];
  let editingId = null;
  let pendingFiles = [];      // File[] selected in the modal
  let detailId = null;

  const me = () => OLW_IDS.PROFILES[OLW.state.persona];
  const isMine = (m) => m.creator_id === me();

  /* ── Loading & timeline rendering ── */
  async function load() {
    try {
      memories = await OLW.backend.listMemories();
    } catch (e) {
      console.error("Memories load failed:", e);
      toast("Couldn't load the Memory Box.", true);
      memories = [];
    }
    render();
    renderContextPanel();
  }

  function render() {
    const timeline = document.getElementById("memory-timeline");
    const empty = document.getElementById("memory-empty");
    timeline.innerHTML = "";
    empty.hidden = memories.length > 0;
    if (!memories.length) return;

    // group newest-first by month
    const groups = new Map();
    for (const m of memories) {
      const key = monthKey(m.memory_date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }

    for (const [month, list] of groups) {
      const group = document.createElement("div");
      group.className = "memory-group";
      group.innerHTML = `<h3 class="memory-group-title">${esc(month)}</h3>`;
      const grid = document.createElement("div");
      grid.className = "memory-grid";
      for (const m of list) grid.appendChild(cardFor(m));
      group.appendChild(grid);
      timeline.appendChild(group);
    }
    hydrateCovers(timeline);
    OLW.anim.refreshIcons();
  }

  function cardFor(m) {
    const isFav = (m.memory_favorites || []).some((f) => f.user_id === me());
    const hearts = (m.memory_reactions || []).length;
    const card = document.createElement("button");
    card.className = "memory-card";
    card.dataset.memoryId = m.id;
    card.innerHTML = `
      <div class="memory-card-cover">
        ${m.memory_photos?.length
          ? `<span class="muted" data-cover-loading style="display:grid;place-items:center;height:100%">Loading…</span>`
          : `<div class="no-photo" aria-hidden="true">♡</div>`}
        ${m.memory_photos?.length > 1
          ? `<span class="memory-photo-count">${m.memory_photos.length} photos</span>` : ""}
      </div>
      <div class="memory-card-body">
        <h3 class="memory-card-title">${esc(m.title)}</h3>
        ${m.sample ? `<span class="memory-sample-tag">Sample</span>` : ""}
        ${m.caption ? `<p class="memory-card-caption">${esc(m.caption)}</p>` : ""}
        <div class="memory-card-meta">
          <time>${esc(fmtMemoryDate(m.memory_date))}</time>
          <span class="memory-card-flags">
            ${hearts ? `<span>❤️ ${hearts}</span>` : ""}
            ${isFav ? `<span class="fav"><i data-lucide="bookmark"></i></span>` : ""}
            <span>by ${esc(OLW.messages.nameOf(m.creator_id))}</span>
          </span>
        </div>
      </div>`;
    card.addEventListener("click", () => openDetail(m.id));
    return card;
  }

  async function hydrateCovers(root) {
    for (const card of root.querySelectorAll(".memory-card[data-memory-id]")) {
      if (card.dataset.coverHydrated) continue;
      card.dataset.coverHydrated = "1";
      const m = memories.find((x) => x.id === card.dataset.memoryId);
      const first = m?.memory_photos?.[0];
      if (!first) continue;
      const url = await OLW.uploads.urlFor(OLW_IDS.BUCKETS.memoryPhotos, first.file_path);
      const holder = card.querySelector("[data-cover-loading]");
      if (url && holder) {
        const img = document.createElement("img");
        img.src = url; img.alt = first.alt_text || m.title; img.loading = "lazy";
        holder.replaceWith(img);
      } else if (holder) {
        holder.outerHTML = `<div class="no-photo" aria-hidden="true">♡</div>`;
      }
    }
  }

  /* ── Context panel (featured memory + recent photos) ── */
  async function renderContextPanel() {
    const box = document.getElementById("context-memory");
    if (!box) return;
    if (!memories.length) {
      box.innerHTML = `<p class="context-empty">Your first memory will shine here.</p>`;
    } else {
      const m = memories[0];
      box.innerHTML = "";
      const el = document.createElement("div");
      el.className = "context-memory-card";
      el.innerHTML = `
        <time>${esc(fmtMemoryDate(m.memory_date))}</time>
        <h4>${esc(m.title)}</h4>
        ${m.caption ? `<p>${esc(m.caption)}</p>` : ""}`;
      el.addEventListener("click", () => openDetail(m.id));
      box.appendChild(el);
    }

    const photosBox = document.getElementById("context-photos");
    photosBox.innerHTML = "";
    try {
      const items = await OLW.backend.listGallery({ sort: "newest", limit: 6 });
      if (!items.length) {
        photosBox.innerHTML = `<p class="context-empty" style="grid-column:1/-1">Photos you share will appear here.</p>`;
        return;
      }
      for (const it of items.slice(0, 6)) {
        const b = document.createElement("button");
        b.setAttribute("aria-label", "Open photo");
        const url = await OLW.uploads.urlFor(it.bucket === "demo" ? "demo" : it.bucket, it.path);
        if (!url) continue;
        b.innerHTML = `<img src="${url}" alt="" loading="lazy" />`;
        b.addEventListener("click", () => OLW.uploads.openViewer([{ url, caption: it.source }]));
        photosBox.appendChild(b);
      }
    } catch (e) { console.warn("Context photos failed:", e.message); }
  }

  /* ── Detail modal ── */
  async function openDetail(id) {
    const m = memories.find((x) => x.id === id);
    if (!m) return;
    detailId = id;
    const modal = document.getElementById("memory-detail");
    document.getElementById("memory-detail-title").textContent = m.title;

    const mine = isMine(m);
    document.getElementById("memory-detail-edit").style.display = mine && !m.sample ? "" : "none";
    document.getElementById("memory-detail-delete").style.display = mine && !m.sample ? "" : "none";

    const isFav = (m.memory_favorites || []).some((f) => f.user_id === me());
    const body = document.getElementById("memory-detail-body");
    body.innerHTML = `
      <div class="memory-detail-photos" id="detail-photos">
        ${m.memory_photos?.length ? "" : `<p class="muted">No photos on this memory yet.</p>`}
      </div>
      ${m.sample ? `<p class="memory-sample-tag">Sample content</p>` : ""}
      ${m.caption ? `<p class="memory-detail-caption">${esc(m.caption)}</p>` : ""}
      <div class="memory-detail-meta">
        <span>📅 <strong>${esc(fmtMemoryDate(m.memory_date))}</strong></span>
        ${m.location ? `<span>📍 ${esc(m.location)}</span>` : ""}
        <span>by <strong>${esc(OLW.messages.nameOf(m.creator_id))}</strong></span>
      </div>
      <div class="memory-detail-actions">
        <button class="btn btn-ghost btn-sm" id="detail-react-btn" data-react-open>❤️ React</button>
        <button class="btn btn-ghost btn-sm" id="detail-fav-btn">${isFav ? "★ Saved" : "☆ Save"}</button>
      </div>
      <div class="msg-reactions" id="detail-reactions" style="margin-top:.7rem">
        ${OLW.reactions.chipsHtml(m.memory_reactions, me())}
      </div>`;

    // photos
    const photosWrap = document.getElementById("detail-photos");
    const urls = [];
    for (const p of m.memory_photos || []) {
      const url = await OLW.uploads.urlFor(OLW_IDS.BUCKETS.memoryPhotos, p.file_path);
      if (url) urls.push({ url, caption: m.title });
    }
    urls.forEach((u, i) => {
      const b = document.createElement("button");
      b.innerHTML = `<img src="${u.url}" alt="${esc(m.title)} photo ${i + 1}" loading="lazy" />`;
      b.addEventListener("click", () => OLW.uploads.openViewer(urls, i));
      photosWrap.appendChild(b);
    });

    document.getElementById("detail-react-btn").addEventListener("click", (e) =>
      OLW.reactions.openReactionPicker(e.currentTarget, "memory", id));
    document.getElementById("detail-fav-btn").addEventListener("click", async (e) => {
      const nowFav = await OLW.backend.toggleMemoryFavorite(me(), id, isFavNow(m));
      m.memory_favorites = nowFav
        ? [...m.memory_favorites.filter((f) => f.user_id !== me()), { user_id: me() }]
        : m.memory_favorites.filter((f) => f.user_id !== me());
      e.currentTarget.textContent = nowFav ? "★ Saved" : "☆ Save";
      toast(nowFav ? "Memory saved to your favorites ♡" : "Removed from favorites");
      render();
    });
    document.getElementById("detail-reactions").addEventListener("click", async (e) => {
      const chip = e.target.closest(".reaction-chip");
      if (chip) await reactTo(id, chip.dataset.emoji);
    });

    OLW.anim.openModal(modal);
  }

  const isFavNow = (m) => (m.memory_favorites || []).some((f) => f.user_id === me());

  async function reactTo(id, emoji) {
    const m = memories.find((x) => x.id === id);
    if (!m) return;
    const mine = (m.memory_reactions || []).find((r) => r.user_id === me());
    const same = mine && mine.reaction === emoji;
    m.memory_reactions = await OLW.backend.toggleMemoryReaction(id, me(), emoji, same);
    const wrap = document.getElementById("detail-reactions");
    if (wrap && detailId === id)
      wrap.innerHTML = OLW.reactions.chipsHtml(m.memory_reactions, me());
    render();
  }

  /* ── Create / edit modal ── */
  function openForm(edit = null) {
    editingId = edit?.id || null;
    pendingFiles = [];
    document.getElementById("memory-modal-title").textContent = edit ? "Edit Memory" : "Add a Memory";
    document.getElementById("memory-title").value = edit?.title || "";
    document.getElementById("memory-caption").value = edit?.caption || "";
    document.getElementById("memory-date").value = edit?.memory_date || new Date().toISOString().slice(0, 10);
    document.getElementById("memory-location").value = edit?.location || "";
    document.getElementById("memory-photos-preview").innerHTML = "";
    document.getElementById("memory-form-error").hidden = true;
    document.getElementById("memory-upload-progress").hidden = true;
    OLW.anim.openModal(document.getElementById("memory-modal"));
  }

  function closeForm() {
    OLW.anim.closeModal(document.getElementById("memory-modal"));
  }

  function renderPreviews() {
    const wrap = document.getElementById("memory-photos-preview");
    wrap.innerHTML = "";
    pendingFiles.forEach((file, i) => {
      const item = document.createElement("div");
      item.className = "preview-item";
      const img = document.createElement("img");
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "preview-remove"; rm.textContent = "✕";
      rm.setAttribute("aria-label", `Remove ${file.name}`);
      rm.addEventListener("click", () => { pendingFiles.splice(i, 1); renderPreviews(); });
      item.append(img, rm);
      wrap.appendChild(item);
    });
  }

  async function saveForm(e) {
    e.preventDefault();
    const errEl = document.getElementById("memory-form-error");
    const title = document.getElementById("memory-title").value.trim();
    const caption = document.getElementById("memory-caption").value.trim();
    const date = document.getElementById("memory-date").value;
    const location = document.getElementById("memory-location").value.trim();

    if (!title) {
      errEl.textContent = "Give your memory a little title. ♡";
      errEl.hidden = false;
      return;
    }
    for (const f of pendingFiles) {
      const bad = OLW.uploads.validateImage(f);
      if (bad) { errEl.textContent = bad; errEl.hidden = false; return; }
    }
    errEl.hidden = true;

    const saveBtn = document.getElementById("memory-save");
    const progress = document.getElementById("memory-upload-progress");
    const bar = document.getElementById("memory-upload-bar");
    const label = document.getElementById("memory-upload-label");
    saveBtn.disabled = true;

    try {
      if (editingId) {
        await OLW.backend.updateMemory(editingId, { title, caption, date, location });
        toast("Memory updated ♡");
      } else {
        const uploaded = [];
        if (pendingFiles.length) {
          progress.hidden = false;
          let done = 0;
          for (const f of pendingFiles) {
            label.textContent = `Uploading photo ${done + 1} of ${pendingFiles.length}…`;
            const res = await OLW.uploads.upload(f, OLW_IDS.BUCKETS.memoryPhotos, (p) => {
              bar.style.width = Math.round(((done + p / 100) / pendingFiles.length) * 100) + "%";
            });
            uploaded.push(res);
            done++;
            bar.style.width = Math.round((done / pendingFiles.length) * 100) + "%";
          }
        }
        const created = await OLW.backend.createMemory({
          creatorId: me(), title, caption, date, location, photos: uploaded,
        });
        toast("Memory saved forever ♡");
        if (!OLW.anim.reduced()) {
          const r = saveBtn.getBoundingClientRect();
          heartBurst(r.left + r.width / 2, r.top, "✨");
        }
        void created;
      }
      closeForm();
      await load();
    } catch (err) {
      console.error("Memory save failed:", err);
      errEl.textContent = "Couldn't save that memory — " + (err.message || "please try again.");
      errEl.hidden = false;
    } finally {
      saveBtn.disabled = false;
      progress.hidden = true;
      bar.style.width = "0%";
    }
  }

  async function deleteDetail() {
    const m = memories.find((x) => x.id === detailId);
    if (!m) return;
    if (!confirm(`Delete "${m.title}" forever? This cannot be undone.`)) return;
    try {
      await OLW.backend.deleteMemory(m.id, (m.memory_photos || []).map((p) => p.file_path));
      OLW.anim.closeModal(document.getElementById("memory-detail"));
      toast("Memory deleted.");
      await load();
    } catch (e) {
      console.error("Delete failed:", e);
      toast("Couldn't delete that memory — please try again.", true);
    }
  }

  /* ── Wiring ── */
  function init() {
    document.getElementById("add-memory-btn").addEventListener("click", () => openForm());
    document.getElementById("empty-add-memory-btn").addEventListener("click", () => openForm());
    document.getElementById("memory-modal-close").addEventListener("click", closeForm);
    document.getElementById("memory-cancel").addEventListener("click", closeForm);
    document.getElementById("memory-form").addEventListener("submit", saveForm);
    document.getElementById("memory-photos-btn").addEventListener("click", () =>
      document.getElementById("memory-photos-input").click());
    document.getElementById("memory-photos-input").addEventListener("change", (e) => {
      for (const f of e.target.files) {
        const bad = OLW.uploads.validateImage(f);
        if (bad) { toast(bad, true); continue; }
        pendingFiles.push(f);
      }
      e.target.value = "";
      renderPreviews();
    });
    document.getElementById("memory-detail-close").addEventListener("click", () =>
      OLW.anim.closeModal(document.getElementById("memory-detail")));
    document.getElementById("memory-detail-edit").addEventListener("click", () => {
      const m = memories.find((x) => x.id === detailId);
      OLW.anim.closeModal(document.getElementById("memory-detail"));
      openForm(m);
    });
    document.getElementById("memory-detail-delete").addEventListener("click", deleteDetail);
  }

  OLW.memories = { init, load, reactTo, openDetail, renderContextPanel };
})();
