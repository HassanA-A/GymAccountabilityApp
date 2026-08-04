# Setup

About 10 minutes. You need a free Supabase project and the **Expo Go** app on
your phone (App Store / Play Store).

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Once it's ready, open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 2. Run the database migrations

In the Supabase dashboard, open **SQL Editor** and run the two files in order:

1. `supabase/migrations/0001_init.sql` — tables, RLS, and the streak function.
2. `supabase/migrations/0002_storage_and_rpcs.sql` — the photo storage bucket
   and the `create_group` / `join_group_by_code` functions the app calls.

Paste each file's contents, run it, then do the next. (Order matters — `0002`
builds on `0001`.)

## 3. Turn off email confirmation (for now)

So you can sign up and start using the app immediately during development:

**Authentication → Sign In / Providers → Email** → turn **Confirm email** off.

You can turn this back on before launch and add a proper confirmation flow.

## 4. Point the app at your project

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

These are the `anon` public values — safe to ship in a client app. Row-Level
Security (from `0001`) is what actually protects the data.

## 5. Run it

```bash
npm install
npm start
```

Scan the QR code with **Expo Go** (iOS: the Camera app; Android: the Expo Go
app). The app hot-reloads as the code changes.

## Try the loop

1. **Create an account** (name, email, password).
2. **Create a crew** and pick a weekly goal.
3. On **Today**, pick an activity, optionally snap a photo, and tap **I showed up**.
4. Check the **Crew** tab — your check-in shows up, and the invite code at the
   bottom is what you send friends so they can **Join** with it.

## Notes & what's stubbed

- **Nudge** currently shows a local confirmation only — real push notifications
  (the daily reminder + nudges) are the next milestone and need
  `expo-notifications` plus a device build or a dev client.
- Photos go to a **public** storage bucket (`check-ins`), namespaced per user.
  Fine for a friends app; revisit if the product opens up.
- The app is **light-themed** for v1; a dark theme can layer onto the tokens in
  `lib/theme.ts`.

## Troubleshooting

- **"Missing EXPO_PUBLIC_SUPABASE_…" warning** → your `.env` isn't loaded.
  Stop the dev server and run `npm start` again (env is read at startup).
- **Can't sign in right after sign-up** → email confirmation is still on
  (step 3), or the account needs confirming via the email link.
- **Photo upload fails** → make sure `0002` ran (it creates the `check-ins`
  bucket and its policies).
