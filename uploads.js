/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — uploads.js
   Image validation, upload, signed URLs, fullscreen viewer
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

  function validateImage(file) {
    if (!file) return "No file selected.";
    if (!ALLOWED.includes(file.type))
      return "That format isn't supported — please choose a JPEG, PNG or WebP image.";
    const max = (OLW_CONFIG.MAX_IMAGE_MB || 8) * 1048576;
    if (file.size > max)
      return `That image is ${OLW.util.bytes(file.size)} — the limit is ${OLW_CONFIG.MAX_IMAGE_MB} MB.`;
    return null;
  }

  async function upload(file, bucket, onProgress) {
    const err = validateImage(file);
    if (err) throw new Error(err);
    onProgress?.(30);
    const res = await OLW.backend.uploadImage(file, bucket);
    onProgress?.(100);
    return res;
  }

  async function urlFor(bucket, path) {
    try { return await OLW.backend.getImageUrl(bucket, path); }
    catch (e) { console.warn("Image URL failed:", e.message); return null; }
  }

  /* ── Fullscreen viewer ── */
  let viewerList = [];   // [{url, caption}]
  let viewerIndex = 0;
  const viewer = () => document.getElementById("image-viewer");

  function renderViewer() {
    const item = viewerList[viewerIndex];
    if (!item) return closeViewer();
    document.getElementById("viewer-img").src = item.url;
    document.getElementById("viewer-img").alt = item.caption || "Shared photo";
    document.getElementById("viewer-caption").textContent = item.caption || "";
    const multi = viewerList.length > 1;
    document.getElementById("viewer-prev").hidden = !multi;
    document.getElementById("viewer-next").hidden = !multi;
  }

  function openViewer(list, index = 0) {
    viewerList = list.filter((i) => i.url);
    if (!viewerList.length) return;
    viewerIndex = Math.min(index, viewerList.length - 1);
    viewer().hidden = false;
    document.body.style.overflow = "hidden";
    renderViewer();
    document.getElementById("viewer-close").focus();
  }

  function closeViewer() {
    viewer().hidden = true;
    document.body.style.overflow = "";
    viewerList = [];
  }

  function initViewer() {
    document.getElementById("viewer-close").addEventListener("click", closeViewer);
    document.getElementById("viewer-prev").addEventListener("click", () => {
      viewerIndex = (viewerIndex - 1 + viewerList.length) % viewerList.length; renderViewer();
    });
    document.getElementById("viewer-next").addEventListener("click", () => {
      viewerIndex = (viewerIndex + 1) % viewerList.length; renderViewer();
    });
    viewer().addEventListener("click", (e) => { if (e.target === viewer()) closeViewer(); });
    document.addEventListener("keydown", (e) => {
      if (viewer().hidden) return;
      if (e.key === "ArrowLeft") document.getElementById("viewer-prev").click();
      if (e.key === "ArrowRight") document.getElementById("viewer-next").click();
    });
    // Touch swipe
    let touchX = null;
    viewer().addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    viewer().addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 48) {
        (dx > 0 ? document.getElementById("viewer-prev") : document.getElementById("viewer-next")).click();
      }
      touchX = null;
    }, { passive: true });
  }

  OLW.uploads = { validateImage, upload, urlFor, openViewer, closeViewer, initViewer };
})();
