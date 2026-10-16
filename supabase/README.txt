ClipForge Pro - Supabase setup (5 minutes)
1. supabase.com -> New project.
2. Open supabase/setup.sql, change YOUR_OWNER_PASSWORD (last lines) to your real password.
3. Supabase -> SQL Editor -> New query -> paste the whole file -> Run.
4. Supabase -> Project Settings -> API: copy "Project URL" and the "anon public" key.
5. Paste them into electron/engine/license-config.json  ({"supabaseUrl": "...", "anonKey": "..."}).
   (The anon key is meant to be public. The tables cannot be read or changed with it; only the functions in setup.sql work.)
6. Fill your payment details and contacts in src/config/proConfig.ts.
7. Build/push as usual. In the app: tap the version number 5 times -> enter the password -> CMS button appears.
