/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — supabase-client.js
   Shared utilities + backend layer.

   Two backends expose the SAME interface to the UI:
     • SupabaseBackend — real persistence, realtime, storage
     • DemoBackend     — in-memory only, clearly labelled, used when
                         config.js still has placeholder credentials
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ───────────── Shared utilities ───────────── */
  const util = {
    esc(str) {
      return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[c]));
    },
    fmtTime(iso) {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    },
    fmtDate(iso) {
      const d = new Date(iso);
      const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const same = (a, b) => a.toDateString() === b.toDateString();
      if (same(d, today)) return "Today";
      if (same(d, yest)) return "Yesterday";
      return d.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
    },
    fmtMemoryDate(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr + "T12:00:00");
      return d.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
    },
    monthKey(dateStr) {
      const d = new Date((dateStr || "") + "T12:00:00");
      return isNaN(d) ? "Undated" : d.toLocaleDateString([], { year: "numeric", month: "long" });
    },
    bytes(n) {
      if (n > 1048576) return (n / 1048576).toFixed(1) + " MB";
      return Math.max(1, Math.round(n / 1024)) + " KB";
    },
    uuid() {
      return (crypto.randomUUID ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        }));
    },
    toast(msg, isError = false) {
      const root = document.getElementById("toast-root");
      if (!root) return;
      const el = document.createElement("div");
      el.className = "toast" + (isError ? " error" : "");
      el.textContent = msg;
      root.appendChild(el);
      setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; }, 2600);
      setTimeout(() => el.remove(), 3100);
    },
    heartBurst(x, y, emoji = "❤️") {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const layer = document.getElementById("heart-layer");
      if (!layer) return;
      for (let i = 0; i < 6; i++) {
        const s = document.createElement("span");
        s.className = "burst-heart";
        s.textContent = emoji;
        const ang = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
        const dist = 30 + Math.random() * 46;
        s.style.left = x + "px"; s.style.top = y + "px";
        s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
        s.style.setProperty("--dy", (Math.sin(ang) * dist - 30) + "px");
        layer.appendChild(s);
        setTimeout(() => s.remove(), 1200);
      }
    },
  };

  /* ───────────── Persona state ───────────── */
  const state = {
    persona: null,          // "Yousef" | "Agatha"
    mode: "demo",           // "live" | "demo"
    authUser: null,
  };

  /* ───────────── Supabase backend ───────────── */
  class SupabaseBackend {
    constructor() {
      this.client = window.supabase.createClient(
        OLW_CONFIG.SUPABASE_URL, OLW_CONFIG.SUPABASE_ANON_KEY
      );
      this.urlCache = new Map();   // "bucket/path" → {url, expires}
      this.channels = [];
    }

    async init() {
      if (OLW_CONFIG.AUTH_MODE === "email") {
        const { data } = await this.client.auth.getSession();
        state.authUser = data.session?.user ?? null;
        this.client.auth.onAuthStateChange((_e, session) => {
          state.authUser = session?.user ?? null;
          if (!state.authUser) location.reload();
        });
      }
      return "live";
    }

    /* ── auth (email mode only) ── */
    async signIn(email, password) {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      state.authUser = data.user;
      const { data: profile, error: pErr } = await this.client
        .from("profiles").select("display_name").eq("auth_user_id", data.user.id).single();
      if (pErr || !profile) throw new Error("This account is not linked to Yousef or Agatha.");
      return profile.display_name;
    }
    async signOut() { await this.client.auth.signOut(); }

    /* ── messages ── */
    async listMessages({ limit = 40, before = null } = {}) {
      let q = this.client.from("messages")
        .select("*, message_reactions(id,user_id,reaction), favorites(id,user_id)")
        .eq("conversation_id", OLW_IDS.CONVERSATION)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (before) q = q.lt("created_at", before);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).reverse();
    }

    async sendMessage({ senderId, text, attachmentPath = null, attachmentType = null }) {
      const { data, error } = await this.client.from("messages")
        .insert({
          conversation_id: OLW_IDS.CONVERSATION,
          sender_id: senderId,
          message_text: text || null,
          attachment_path: attachmentPath,
          attachment_type: attachmentType,
        })
        .select("*, message_reactions(id,user_id,reaction), favorites(id,user_id)")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    async toggleReaction(messageId, userId, emoji, hasReacted) {
      if (hasReacted) {
        const { error } = await this.client.from("message_reactions").delete()
          .eq("message_id", messageId).eq("user_id", userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await this.client.from("message_reactions")
          .upsert({ message_id: messageId, user_id: userId, reaction: emoji },
                  { onConflict: "message_id,user_id" });
        if (error) throw new Error(error.message);
      }
      const { data } = await this.client.from("message_reactions")
        .select("id,user_id,reaction").eq("message_id", messageId);
      return data || [];
    }

    async toggleFavorite(userId, messageId, isFav) {
      if (isFav) {
        const { error } = await this.client.from("favorites").delete()
          .eq("user_id", userId).eq("message_id", messageId);
        if (error) throw new Error(error.message);
        return false;
      }
      const { error } = await this.client.from("favorites")
        .upsert({ user_id: userId, message_id: messageId }, { onConflict: "user_id,message_id" });
      if (error) throw new Error(error.message);
      return true;
    }

    async listFavorites(userId) {
      const { data, error } = await this.client.from("favorites")
        .select("id, created_at, message:messages(id, sender_id, message_text, attachment_path, attachment_type, created_at)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).filter((f) => f.message);
    }

    /* ── storage ── */
    async uploadImage(file, bucket) {
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type] || "bin";
      const path = `${state.persona?.toLowerCase() || "shared"}/${Date.now()}-${util.uuid()}.${ext}`;
      const { error } = await this.client.storage.from(bucket)
        .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(error.message);
      return { path };
    }

    async getImageUrl(bucket, path) {
      const key = `${bucket}/${path}`;
      const hit = this.urlCache.get(key);
      if (hit && hit.expires > Date.now() + 60000) return hit.url;
      const { data, error } = await this.client.storage.from(bucket).createSignedUrl(path, 3600);
      if (error) throw new Error(error.message);
      this.urlCache.set(key, { url: data.signedUrl, expires: Date.now() + 3600e3 });
      return data.signedUrl;
    }

    async removeFiles(bucket, paths) {
      if (!paths?.length) return;
      await this.client.storage.from(bucket).remove(paths);
    }

    /* ── memories ── */
    async listMemories() {
      const { data, error } = await this.client.from("memories")
        .select("*, memory_photos(id,file_path,alt_text,sort_order), memory_reactions(id,user_id,reaction), memory_favorites(id,user_id)")
        .order("memory_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      (data || []).forEach((m) => m.memory_photos?.sort((a, b) => a.sort_order - b.sort_order));
      return data || [];
    }

    async createMemory({ creatorId, title, caption, date, location, photos }) {
      const { data: mem, error } = await this.client.from("memories")
        .insert({ creator_id: creatorId, title, caption: caption || null,
                  memory_date: date || new Date().toISOString().slice(0, 10),
                  location: location || null })
        .select().single();
      if (error) throw new Error(error.message);
      if (photos?.length) {
        const rows = photos.map((p, i) => ({ memory_id: mem.id, file_path: p.path, sort_order: i, alt_text: title }));
        const { error: pErr } = await this.client.from("memory_photos").insert(rows);
        if (pErr) {
          // partial failure: keep the memory, report honestly
          util.toast("Memory saved, but some photos could not be attached.", true);
        }
      }
      return mem;
    }

    async updateMemory(id, { title, caption, date, location }) {
      const { error } = await this.client.from("memories")
        .update({ title, caption: caption || null, memory_date: date, location: location || null,
                  updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }

    async deleteMemory(id, photoPaths) {
      const { error } = await this.client.from("memories").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await this.removeFiles(OLW_IDS.BUCKETS.memoryPhotos, photoPaths);
    }

    async toggleMemoryReaction(memoryId, userId, emoji, hasReacted) {
      if (hasReacted) {
        const { error } = await this.client.from("memory_reactions").delete()
          .eq("memory_id", memoryId).eq("user_id", userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await this.client.from("memory_reactions")
          .upsert({ memory_id: memoryId, user_id: userId, reaction: emoji },
                  { onConflict: "memory_id,user_id" });
        if (error) throw new Error(error.message);
      }
      const { data } = await this.client.from("memory_reactions")
        .select("id,user_id,reaction").eq("memory_id", memoryId);
      return data || [];
    }

    async toggleMemoryFavorite(userId, memoryId, isFav) {
      if (isFav) {
        const { error } = await this.client.from("memory_favorites").delete()
          .eq("user_id", userId).eq("memory_id", memoryId);
        if (error) throw new Error(error.message);
        return false;
      }
      const { error } = await this.client.from("memory_favorites")
        .upsert({ user_id: userId, memory_id: memoryId }, { onConflict: "user_id,memory_id" });
      if (error) throw new Error(error.message);
      return true;
    }

    /* ── gallery ── */
    async listGallery({ sort = "newest", offset = 0, limit = 30 } = {}) {
      const asc = sort === "oldest";
      const [msgRes, memRes] = await Promise.all([
        this.client.from("messages")
          .select("id, attachment_path, created_at, sender_id")
          .eq("conversation_id", OLW_IDS.CONVERSATION)
          .not("attachment_path", "is", null).is("deleted_at", null)
          .order("created_at", { ascending: asc }).range(offset, offset + limit - 1),
        this.client.from("memory_photos")
          .select("id, file_path, created_at, memory:memories(title)")
          .order("created_at", { ascending: asc }).range(offset, offset + limit - 1),
      ]);
      if (msgRes.error) throw new Error(msgRes.error.message);
      if (memRes.error) throw new Error(memRes.error.message);
      const items = [
        ...(msgRes.data || []).map((m) => ({
          key: "m-" + m.id, bucket: OLW_IDS.BUCKETS.attachments, path: m.attachment_path,
          created_at: m.created_at, source: "Message", refId: m.id,
        })),
        ...(memRes.data || []).map((p) => ({
          key: "p-" + p.id, bucket: OLW_IDS.BUCKETS.memoryPhotos, path: p.file_path,
          created_at: p.created_at, source: p.memory?.title ? `Memory: ${p.memory.title}` : "Memory",
          refId: null,
        })),
      ];
      items.sort((a, b) => asc
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at));
      return items;
    }

    /* ── preferences ── */
    async saveTheme(userId, theme) {
      await this.client.from("user_preferences")
        .upsert({ user_id: userId, theme, updated_at: new Date().toISOString() },
                { onConflict: "user_id" });
    }
    async getTheme(userId) {
      const { data } = await this.client.from("user_preferences")
        .select("theme").eq("user_id", userId).maybeSingle();
      return data?.theme || null;
    }

    /* ── realtime ── */
    subscribe({ onMessage, onReaction, onMemory, onStatus }) {
      const ch = this.client.channel("olw-live")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "messages",
            filter: `conversation_id=eq.${OLW_IDS.CONVERSATION}` },
          (payload) => onMessage?.(payload.new))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "message_reactions" },
          (payload) => onReaction?.(payload.new?.message_id || payload.old?.message_id))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "memories" },
          () => onMemory?.())
        .subscribe((status) => onStatus?.(status));
      this.channels.push(ch);
      return ch;
    }

    presenceChannel(persona, onSync) {
      const ch = this.client.channel("olw-presence", { config: { presence: { key: persona } } });
      ch.on("presence", { event: "sync" }, () => {
        const keys = Object.keys(ch.presenceState());
        onSync?.(keys);
      }).subscribe(async (s) => { if (s === "SUBSCRIBED") await ch.track({ at: Date.now() }); });
      this.channels.push(ch);
      return ch;
    }

    unsubscribeAll() {
      this.channels.forEach((ch) => this.client.removeChannel(ch));
      this.channels = [];
    }
  }

  /* ───────────── Demo backend (in-memory, clearly labelled) ───────────── */
  class DemoBackend {
    constructor() {
      const now = Date.now();
      this.messages = [];
      this.memories = [
        { id: util.uuid(), creator_id: OLW_IDS.PROFILES.Yousef, title: "A Little Moment ♡",
          caption: "Sample memory — add your own once Supabase is connected.", location: null,
          memory_date: new Date(now - 86400e3 * 2).toISOString().slice(0, 10),
          created_at: new Date(now - 86400e3 * 2).toISOString(), updated_at: null,
          memory_photos: [], memory_reactions: [], memory_favorites: [], sample: true },
        { id: util.uuid(), creator_id: OLW_IDS.PROFILES.Agatha, title: "One to Remember",
          caption: "Sample memory — your real photos and stories will live here.", location: null,
          memory_date: new Date(now - 86400e3 * 9).toISOString().slice(0, 10),
          created_at: new Date(now - 86400e3 * 9).toISOString(), updated_at: null,
          memory_photos: [], memory_reactions: [], memory_favorites: [], sample: true },
        { id: util.uuid(), creator_id: OLW_IDS.PROFILES.Agatha, title: "A Day Worth Keeping",
          caption: "Sample memory — connect Supabase to save forever.", location: null,
          memory_date: new Date(now - 86400e3 * 40).toISOString().slice(0, 10),
          created_at: new Date(now - 86400e3 * 40).toISOString(), updated_at: null,
          memory_photos: [], memory_reactions: [], memory_favorites: [], sample: true },
      ];
      this.favorites = []; // {id, user_id, message}
      this.blobUrls = new Map();
    }

    async init() { return "demo"; }

    async listMessages() {
      return this.messages.map((m) => ({ ...m }));
    }

    async sendMessage({ senderId, text, attachmentPath, attachmentType }) {
      const msg = {
        id: util.uuid(), conversation_id: OLW_IDS.CONVERSATION,
        sender_id: senderId, message_text: text || null,
        attachment_path: attachmentPath, attachment_type: attachmentType,
        created_at: new Date().toISOString(), edited_at: null, deleted_at: null,
        message_reactions: [], favorites: [],
      };
      this.messages.push(msg);
      return { ...msg };
    }

    async toggleReaction(messageId, userId, emoji, hasReacted) {
      const msg = this.messages.find((m) => m.id === messageId);
      if (!msg) return [];
      msg.message_reactions = msg.message_reactions.filter((r) => r.user_id !== userId);
      if (!hasReacted) msg.message_reactions.push({ id: util.uuid(), user_id: userId, reaction: emoji });
      return [...msg.message_reactions];
    }

    async toggleFavorite(userId, messageId) {
      const i = this.favorites.findIndex((f) => f.user_id === userId && f.message.id === messageId);
      if (i >= 0) { this.favorites.splice(i, 1); return false; }
      const msg = this.messages.find((m) => m.id === messageId);
      if (msg) this.favorites.push({ id: util.uuid(), user_id: userId, created_at: new Date().toISOString(), message: { ...msg } });
      return true;
    }

    async listFavorites(userId) {
      return this.favorites.filter((f) => f.user_id === userId);
    }

    async uploadImage(file) {
      const url = URL.createObjectURL(file);
      const path = "demo/" + util.uuid();
      this.blobUrls.set(path, url);
      return { path };
    }

    async getImageUrl(_bucket, path) {
      const url = this.blobUrls.get(path);
      if (!url) throw new Error("Image unavailable in demo mode");
      return url;
    }

    async removeFiles() {}

    async listMemories() { return this.memories.map((m) => ({ ...m })); }

    async createMemory({ creatorId, title, caption, date, location, photos }) {
      const mem = {
        id: util.uuid(), creator_id: creatorId, title, caption: caption || null,
        memory_date: date || new Date().toISOString().slice(0, 10), location: location || null,
        created_at: new Date().toISOString(), updated_at: null,
        memory_photos: (photos || []).map((p, i) => ({
          id: util.uuid(), file_path: p.path, sort_order: i, alt_text: title,
        })),
        memory_reactions: [], memory_favorites: [],
      };
      this.memories.unshift(mem);
      return mem;
    }

    async updateMemory(id, { title, caption, date, location }) {
      const mem = this.memories.find((m) => m.id === id);
      if (mem) Object.assign(mem, { title, caption: caption || null, memory_date: date, location: location || null, updated_at: new Date().toISOString() });
    }

    async deleteMemory(id) {
      this.memories = this.memories.filter((m) => m.id !== id);
    }

    async toggleMemoryReaction(memoryId, userId, emoji, hasReacted) {
      const mem = this.memories.find((m) => m.id === memoryId);
      if (!mem) return [];
      mem.memory_reactions = mem.memory_reactions.filter((r) => r.user_id !== userId);
      if (!hasReacted) mem.memory_reactions.push({ id: util.uuid(), user_id: userId, reaction: emoji });
      return [...mem.memory_reactions];
    }

    async toggleMemoryFavorite(userId, memoryId, isFav) {
      const mem = this.memories.find((m) => m.id === memoryId);
      if (!mem) return false;
      mem.memory_favorites = mem.memory_favorites.filter((f) => f.user_id !== userId);
      if (!isFav) mem.memory_favorites.push({ id: util.uuid(), user_id: userId });
      return !isFav;
    }

    async listGallery() {
      const items = [];
      for (const m of this.messages) {
        if (m.attachment_path) items.push({
          key: "m-" + m.id, bucket: "demo", path: m.attachment_path,
          created_at: m.created_at, source: "Message", refId: m.id,
        });
      }
      for (const mem of this.memories) {
        for (const p of mem.memory_photos || []) items.push({
          key: "p-" + p.id, bucket: "demo", path: p.file_path,
          created_at: mem.created_at, source: "Memory: " + mem.title, refId: null,
        });
      }
      return items;
    }

    async saveTheme() {}
    async getTheme() { return null; }
    subscribe() { return null; }
    presenceChannel() { return null; }
    unsubscribeAll() {}
  }

  /* ───────────── Pick the backend ───────────── */
  function isConfigured() {
    const u = OLW_CONFIG.SUPABASE_URL, k = OLW_CONFIG.SUPABASE_ANON_KEY;
    return /^https:\/\/[a-z0-9-]+\.supabase\.co/.test(u)
      && typeof k === "string" && k.length > 40 && !k.includes("YOUR-")
      && typeof window.supabase !== "undefined";
  }

  OLW.util = util;
  OLW.state = state;
  OLW.isConfigured = isConfigured;
  OLW.backend = null;
  OLW.initBackend = async function () {
    if (isConfigured()) {
      OLW.backend = new SupabaseBackend();
      state.mode = await OLW.backend.init();
    } else {
      OLW.backend = new DemoBackend();
      state.mode = await OLW.backend.init();
    }
    return state.mode;
  };
})();
