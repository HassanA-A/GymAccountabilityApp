# Huddle 🦆

A tiny gym-accountability app for you and a few friends. One tap a day when you
show up. **Milo**, your crew's duck, is beaming when the streak's alive and
droops the day it slips.

> Working name — "Huddle" and "Milo" are placeholders, easy to swap.

## What's here

A native **Expo / React Native** app (iOS + Android) on a **Supabase** backend.

- **Today** — the daily check-in: pick an activity, snap a photo, one tap to log it.
- **Crew** — your friend group's week at a glance: who's in, streaks, a nudge for
  whoever's fallen behind, and your invite code to share.
- **You** — your profile and crews.

The whole app is three screens on purpose. No calorie logs, no workout builders,
no strangers.

## Stack

- Expo SDK 57 · React Native 0.86 · TypeScript · expo-router
- Supabase (Postgres + Auth + Storage)
- react-native-svg (Milo) · expo-image-picker (photos)

## Quick start

```bash
npm install
cp .env.example .env        # fill in your Supabase URL + anon key
npm start                   # then scan the QR code with Expo Go on your phone
```

**See [SETUP.md](./SETUP.md) for the full walk-through** — Supabase project,
running the migrations, the photo storage bucket, and the one auth setting you
need to flip for local testing.

## Project layout

```
app/                 expo-router screens
  (auth)/sign-in     email + password
  onboarding         create or join a crew
  (tabs)/today       the check-in (with photo)
  (tabs)/crew        the crew's week + streaks
  (tabs)/you         profile
components/           Milo mascot + UI kit
lib/                  supabase client, auth, data layer, date helpers, theme
supabase/migrations/ 0001 schema · 0002 storage + RPCs
```

## Status

Foundation: ✅ auth, crews, daily check-in with photo, streaks
Next up: push notifications (daily reminder + nudges), Milo mood on the crew
screen, a dark theme.
