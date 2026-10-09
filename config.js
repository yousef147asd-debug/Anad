/* ═══════════════════════════════════════════════════════
   Our Little World ♡ — config.js
   The ONLY file you need to edit before deploying.
   Never put a service-role key or database password here.
   ═══════════════════════════════════════════════════════ */

window.OLW_CONFIG = {
  // 1. Your Supabase project URL  (Dashboard → Project Settings → API)
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",

  // 2. Your publishable / anon public key (safe for the browser ONLY
  //    together with the Row Level Security policies in schema.sql)
  SUPABASE_ANON_KEY: "YOUR-PUBLISHABLE-ANON-KEY",

  // 3. Identity mode:
  //    "none"  → name-only entry (demo-grade; NOT private — see README)
  //    "email" → Supabase Auth email+password sign-in (private mode;
  //              requires the Section B policies in schema.sql)
  AUTH_MODE: "none",

  // 4. Optional: your anniversary ("YYYY-MM-DD") to show a day counter
  //    in the conversation header. Leave null to hide it.
  ANNIVERSARY_DATE: null,

  // 5. Upload limit per image (megabytes). Also enforced by the bucket.
  MAX_IMAGE_MB: 8,
};

/* Fixed profile + conversation IDs seeded by database/schema.sql */
window.OLW_IDS = {
  PROFILES: {
    Yousef: "00000000-0000-4000-8000-0000000000a1",
    Agatha: "00000000-0000-4000-8000-0000000000a2",
  },
  CONVERSATION: "00000000-0000-4000-8000-0000000000c1",
  BUCKETS: { attachments: "attachments", memoryPhotos: "memory-photos" },
};

window.OLW_EMOJIS = ["❤️", "💕", "🥹", "🫶🏻", "🌷", "✨", "🧸", "🦋", "💌", "🌙", "😊", "😂", "🥰"];

window.OLW = window.OLW || {};
