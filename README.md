# Our Little World ♡

*A little place for us, away from everything else.*

A romantic private chat & shared-memories website for **Yousef & Agatha** —
realtime messaging, photo sharing, a Memory Box scrapbook, reactions,
favorites, three themes, and a mobile-first design.

- **Frontend:** HTML5, CSS3, vanilla JavaScript, Lucide icons (no build step)
- **Backend:** Supabase (PostgreSQL + Realtime + Storage + Row Level Security)
- **Hosting:** GitHub Pages

---

## Project structure

```
our-little-world/
├── index.html
├── README.md
├── .gitignore
├── database/
│   └── schema.sql          # tables, seed data, RLS + storage policies
└── assets/
    ├── css/                # main, welcome, chat, memories, responsive
    └── js/                 # config, supabase-client, app, login, chat,
                            # messages, uploads, memories, reactions,
                            # favorites, themes, animations
```

GitHub Pages can deploy this repository directly from a branch — no build
workflow is needed, so none is included. All asset paths are relative, so the
site works both at `https://USERNAME.github.io/` and at
`https://USERNAME.github.io/REPOSITORY/`.

---

## ⚠️ An honest word about privacy (please read)

Typing a name on the welcome screen picks **which side of the conversation you
see** — it is *not* a password, and it cannot stop a stranger from entering.
No frontend trick can change that.

| Mode | What it gives you | Is it private? |
|---|---|---|
| **Name-only** (`AUTH_MODE: "none"`, default) | One-tap entry as Yousef or Agatha | ❌ No — anyone with the URL can read/write everything. Treat it as a demo. |
| **Email sign-in** (`AUTH_MODE: "email"`) | Simple email+password sign-in, then the same cozy interface | ✅ Yes — Row Level Security limits all data to the two accounts. |

For real use, follow **“Making it truly private”** below. Never put a
service-role key, database password, or any secret in this repository — the
anon/publishable key in `config.js` is safe **only** because the database
policies decide who may do what.

---

## 1 · Supabase setup (about 10 minutes)

1. Go to [supabase.com](https://supabase.com) → **New project** → pick a name,
   a database password (save it somewhere safe; the app never needs it), and a
   region close to you.
2. When the project is ready, open **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **Publishable / anon public key** (`eyJ…` or `sb_publishable_…`)
3. Paste both into **`assets/js/config.js`** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
4. Open the **SQL Editor** → **New query** → paste the entire contents of
   **`database/schema.sql`** → **Run**. It creates:
   - tables: `profiles`, `conversations`, `messages`, `message_reactions`,
     `favorites`, `memories`, `memory_photos`, `memory_reactions`,
     `memory_favorites`, `user_preferences`
   - seed rows: the Yousef & Agatha profiles and their shared conversation
   - two private storage buckets: `attachments`, `memory-photos`
   - Realtime enabled for `messages`, `message_reactions`, `memories`
   - Row Level Security policies (demo set active by default — see below)
5. **Storage:** the buckets are created by the SQL file. If you ever create
   them by hand instead, keep them **private**, set the file size limit to
   8 MB, and allow only `image/jpeg`, `image/png`, `image/webp`.
6. **Realtime:** enabled by the SQL file. To verify: **Database →
   Publications → supabase_realtime** should list the three tables.

### Testing uploads
Open the deployed site, enter as either person, attach a photo to a message,
and send it. Then check **Storage → attachments** in Supabase — the file
should be there under a generated name. Delete it from the dashboard any time.

---

## 2 · GitHub Pages deployment

1. Create a **new repository** on GitHub (e.g. `our-little-world`). It can be
   public or private (GitHub Pages from private repos requires a paid plan).
2. Upload all files (or `git push`). Never commit any secret beyond the
   publishable anon key.
3. In the repository: **Settings → Pages → Source: Deploy from a branch** →
   pick `main` and `/ (root)` → **Save**.
4. Wait a minute, then open the URL shown there, e.g.
   `https://USERNAME.github.io/our-little-world/`.
5. Because every path in the HTML is relative (`assets/…`, not `/assets/…`),
   the site works under the repository subpath automatically.
6. Test over HTTPS from **two different devices**: open the site on your
   phone and a computer, enter as different people, and chat in real time.
7. **Updating later:** edit files, commit, push — Pages redeploys in a
   minute or two. Hard-refresh (`Ctrl/Cmd + Shift + R`) if your browser shows
   a cached version.

### If you enable email sign-in
In Supabase → **Authentication → URL Configuration**, set
**Site URL** to your GitHub Pages URL and add it to the redirect allow-list.

---

## 3 · Making it truly private (recommended)

1. Supabase → **Authentication → Users → Add user** — create two accounts,
   one for each of you (any email + password).
2. Copy each user's UUID from the users table, then run in the SQL Editor:
   ```sql
   update public.profiles set auth_user_id = 'YOusef-AUTH-UUID' where display_name = 'Yousef';
   update public.profiles set auth_user_id = 'Agatha-AUTH-UUID' where display_name = 'Agatha';
   ```
3. Open `database/schema.sql`, find **Section B — Secure policies**, remove
   the surrounding `/* … */`, and run that whole section. It deletes the open
   demo policies and replaces them with ones that allow only your two linked
   accounts.
4. In `assets/js/config.js` set `AUTH_MODE: "email"` and push.
5. The welcome screen now asks for email + password first; after signing in,
   everything looks and feels the same.

---

## 4 · Optional touches

- **Anniversary counter:** set `ANNIVERSARY_DATE: "2024-06-14"` in
  `config.js` to show “Day N ♡” in the conversation header.
- **Themes:** Rose Garden, Lavender Dreams and Midnight Letters are in the
  sidebar. The choice is saved to the database per person (and locally as a
  convenience fallback).

---

## 5 · Test checklist

**Interface**
- [ ] Welcome screen renders on phone and desktop; floating particles visible
- [ ] `Yousef`, `yousef`, `AGATHA` accepted; any other name rejected with a friendly message
- [ ] Personalized greeting toast appears (“Welcome back, … ♡”)
- [ ] All three themes switch smoothly and remain readable
- [ ] Mobile: drawer opens, bottom nav switches views, no horizontal scrolling

**Messaging**
- [ ] Message sent from device A appears on device B without refresh
- [ ] History survives a page refresh; “Load older messages” pages correctly
- [ ] No duplicate bubbles when sending (stable message IDs dedupe realtime echo)
- [ ] Failed send shows “Not sent / Retry”; retry delivers it
- [ ] Reactions add/change/remove and show who reacted
- [ ] Bookmark saves to *Little Things I Love ♡* and jumping back works

**Photos**
- [ ] JPEG/PNG/WebP attach with preview and cancel
- [ ] Oversized or wrong-type files are rejected with a clear message
- [ ] Photos appear in chat, in *Shared Photos*, and in the fullscreen viewer
- [ ] Buckets are private; photos load through short-lived signed URLs

**Memory Box**
- [ ] Create a memory with title, caption, date, location, multiple photos
- [ ] Memories persist after refresh and group by month (newest first)
- [ ] Edit/delete only offered on your own memories (in secure mode, enforced by the database)
- [ ] Empty state shows “Our story is still being written. ♡”

**Security**
- [ ] No service-role key or database password anywhere in the repo
- [ ] With Section B policies on, an incognito (signed-out) visit reads nothing
- [ ] The app never presents name-only entry as secure (banner + settings note)

---

Made with ♡ for Yousef & Agatha.
