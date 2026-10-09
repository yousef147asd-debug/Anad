/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — app.js
   Bootstrap, view routing, drawer, gallery, settings,
   presence, realtime lifecycle
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const { toast } = OLW.util;
  let started = false;
  let galleryOffset = 0;
  const GALLERY_PAGE = 30;

  /* ── View routing ── */
  function showView(name) {
    document.querySelectorAll(".view").forEach((v) =>
      v.classList.toggle("active", v.id === "view-" + name));
    document.querySelectorAll(".nav-item[data-view], .bottom-nav-item[data-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === name));
    closeDrawer();

    if (name === "memories") OLW.memories.load();
    if (name === "favorites") OLW.favorites.render();
    if (name === "gallery") loadGallery(true);
  }

  /* ── Drawer (mobile) ── */
  function openDrawer() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("drawer-scrim").hidden = false;
  }
  function closeDrawer() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("drawer-scrim").hidden = true;
  }

  /* ── Gallery view ── */
  let galleryItems = [];
  async function loadGallery(reset = false) {
    if (reset) { galleryItems = []; galleryOffset = 0; }
    const grid = document.getElementById("gallery-grid");
    const empty = document.getElementById("gallery-empty");
    const moreBtn = document.getElementById("gallery-more-btn");
    const sort = document.getElementById("gallery-sort").value;
    if (reset) grid.innerHTML = "";

    try {
      const items = await OLW.backend.listGallery({ sort, offset: galleryOffset, limit: GALLERY_PAGE });
      galleryItems.push(...items);
      galleryOffset += GALLERY_PAGE;
      empty.hidden = galleryItems.length > 0;
      moreBtn.hidden = items.length < GALLERY_PAGE;

      for (const it of items) {
        const cell = document.createElement("button");
        cell.className = "gallery-item";
        cell.setAttribute("aria-label", `Open photo from ${it.source}`);
        cell.innerHTML = `<span class="gallery-source">${OLW.util.esc(it.source)}</span>`;
        grid.appendChild(cell);
        const url = await OLW.uploads.urlFor(it.bucket === "demo" ? "demo" : it.bucket, it.path);
        if (url) {
          const img = document.createElement("img");
          img.src = url; img.alt = it.source; img.loading = "lazy";
          cell.prepend(img);
          cell.addEventListener("click", () => {
            const allUrls = [];
            grid.querySelectorAll(".gallery-item img").forEach((im) =>
              allUrls.push({ url: im.src, caption: im.alt }));
            OLW.uploads.openViewer(allUrls, allUrls.findIndex((u) => u.url === url));
          });
        } else {
          cell.classList.add("broken");
          cell.textContent = "Photo unavailable";
        }
      }
    } catch (e) {
      console.error("Gallery load failed:", e);
      toast("Couldn't load shared photos.", true);
    }
  }

  /* ── Presence (live mode only, best-effort) ── */
  function initPresence() {
    if (OLW.state.mode !== "live" || !OLW.backend.presenceChannel) return;
    const other = OLW.state.persona === "Yousef" ? "Agatha" : "Yousef";
    const el = document.getElementById("presence-status");
    try {
      OLW.backend.presenceChannel(OLW.state.persona, (keys) => {
        const online = keys.includes(other);
        el.hidden = false;
        el.classList.toggle("online", online);
        el.textContent = online ? `${other} is here ♡` : `${other} is away`;
      });
    } catch (e) {
      console.warn("Presence unavailable:", e.message);
      el.hidden = true;
    }
  }

  /* ── Day counter (only if an anniversary is configured) ── */
  function initDayCounter() {
    const el = document.getElementById("day-counter");
    const conf = OLW_CONFIG.ANNIVERSARY_DATE;
    if (!conf) return;
    const start = new Date(conf + "T00:00:00");
    if (isNaN(start)) return;
    const days = Math.floor((Date.now() - start.getTime()) / 86400e3) + 1;
    if (days < 1) return;
    el.hidden = false;
    el.textContent = `· Day ${days} ♡`;
  }

  /* ── Mode banner ── */
  function syncBannerHeight() {
    const banner = document.getElementById("mode-banner");
    if (banner.hidden) return;
    document.getElementById("app").style
      .setProperty("--banner-h", banner.offsetHeight + "px");
  }
  window.addEventListener("resize", syncBannerHeight);

  function showBanner(text, isError = false) {
    const banner = document.getElementById("mode-banner");
    banner.hidden = false;
    banner.classList.toggle("error", isError);
    banner.textContent = text;
    document.getElementById("app").classList.add("has-banner");
    requestAnimationFrame(syncBannerHeight);
  }

  function hideBanner() {
    document.getElementById("mode-banner").hidden = true;
    document.getElementById("app").classList.remove("has-banner");
  }

  function showModeBanner() {
    if (OLW.state.mode === "demo") {
      showBanner("✨ Demo preview — connect Supabase in config.js to save messages & memories for real. Nothing here is stored or shared.");
    } else if (OLW_CONFIG.AUTH_MODE === "none") {
      showBanner("♡ Connected — remember: name-only entry isn't real security. See README → “Making it truly private”.");
    }
  }

  /* ── Realtime lifecycle ── */
  function initRealtime() {
    if (OLW.state.mode !== "live") return;
    OLW.backend.subscribe({
      onMessage: (row) => OLW.messages.onRealtimeInsert(row),
      onReaction: (messageId) => OLW.messages.onRealtimeReaction(messageId),
      onMemory: () => OLW.memories.load(),
      onStatus: (status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          showBanner("Live connection dropped — messages will still send; refresh to reconnect realtime.", true);
        } else if (status === "SUBSCRIBED") {
          if (OLW_CONFIG.AUTH_MODE !== "none") hideBanner();
          else showModeBanner();
        }
      },
    });
    window.addEventListener("beforeunload", () => OLW.backend.unsubscribeAll());
  }

  /* ── Settings ── */
  function initSettings() {
    const modal = document.getElementById("settings-modal");
    document.getElementById("settings-btn").addEventListener("click", () => {
      document.getElementById("settings-connection").textContent =
        OLW.state.mode === "live"
          ? `Connected to Supabase (${OLW_CONFIG.AUTH_MODE === "email" ? "private email sign-in" : "name-only demo access"}).`
          : "Demo mode — Supabase is not configured yet, so nothing is saved.";
      document.getElementById("settings-persona").textContent =
        `${OLW.state.persona} — using ${OLW.state.persona === "Yousef" ? "Agatha" : "Yousef"}'s side is a tap on “Switch person”.`;
      OLW.anim.openModal(modal);
    });
    document.getElementById("settings-close").addEventListener("click", () =>
      OLW.anim.closeModal(modal));
    document.getElementById("switch-persona-btn").addEventListener("click", async () => {
      closeDrawer();
      if (OLW.state.mode === "live" && OLW_CONFIG.AUTH_MODE === "email") {
        await OLW.backend.signOut(); // triggers reload via auth listener
        return;
      }
      OLW.backend.unsubscribeAll();
      location.reload();
    });
  }

  /* ── App start (after persona entry) ── */
  async function start() {
    if (started) return;
    started = true;

    await OLW.themes.restoreForPersona();
    OLW.chat.personalize();
    showModeBanner();
    initDayCounter();
    initPresence();
    initRealtime();

    await Promise.all([
      OLW.messages.loadInitial(),
      OLW.memories.load(),
    ]);
    OLW.memories.renderContextPanel();
  }

  /* ── Boot ── */
  async function boot() {
    OLW.anim.spawnParticles();
    OLW.anim.initModalBehavior();
    OLW.themes.init();

    await OLW.initBackend();

    OLW.login.init();
    OLW.reactions.initEmojiPicker();
    OLW.reactions.initReactionPicker();
    OLW.uploads.initViewer();
    OLW.messages.init();
    OLW.memories.init();
    OLW.chat.init();

    // nav wiring
    document.querySelectorAll(".nav-item[data-view], .bottom-nav-item[data-view]").forEach((b) =>
      b.addEventListener("click", () => showView(b.dataset.view)));
    document.getElementById("drawer-toggle").addEventListener("click", openDrawer);
    document.getElementById("drawer-scrim").addEventListener("click", closeDrawer);
    document.getElementById("gallery-sort").addEventListener("change", () => loadGallery(true));
    document.getElementById("gallery-more-btn").addEventListener("click", () => loadGallery(false));

    initSettings();
    OLW.anim.refreshIcons();

    // In email mode without a session, stay on the welcome screen (sign-in).
    // In name-only mode, same — the user picks a persona. Nothing else to do.
  }

  document.addEventListener("DOMContentLoaded", boot);

  OLW.app = { showView, start, closeDrawer };
})();
