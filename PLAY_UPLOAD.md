# Play Upload Runbook (DuoOrb by AS Digital)

Package: `com.asdigital.duoorb`. First upload goes to the **internal** track as a
**draft** - promote to closed testing only after the Pre-launch Report is clean.

## 0. One-time setup

1. Play Console > Setup > API access > create/link a service account, grant
   **Admin (all permissions)** on this app, enable the Google Play Android
   Developer API, download the JSON key.
2. Save it as `apps/mobile/play-service-account.json` (gitignored - never commit).
3. `eas.json > submit.production.android` already points there:
   `track: internal`, `releaseStatus: draft`.

## 1. Build (cloud, never local)

```bash
npx eas-cli@latest build --platform android --profile production
```

This produces an **AAB** (Play App Signing enrolls on first upload).
Rules:

- Never upload the old local `app-release.apk` pattern - local builds are
  debug-signed and were built under the previous package name. Both stale
  artifacts were deleted (`/android`, `app-release.apk`).
- `apps/mobile/android` on disk is dev-only (CNG output, gitignored). EAS
  regenerates it from `app.json` in the cloud - `app.json` is the source of
  truth, never hand-edit `android/`.
- Permissions locked in `app.json`: `permissions: []` + `blockedPermissions`
  strips `SYSTEM_ALERT_WINDOW` (dev-menu leftover), legacy external-storage
  (AsyncStorage needs none) and `VIBRATE` (no haptics code - `hapticsEnabled`
  in `gameStorage.ts` is a dead flag). Only `INTERNET` ships (API + Socket.IO).
- After the build, check the EAS artifact page: package
  `com.asdigital.duoorb`, `targetSdk 36`, `versionCode` auto-incremented.

## 2. Submit

```bash
npx eas-cli@latest submit --platform android --profile production
```

Lands in Play Console > Test and release > Internal testing as a draft.
Then: Pre-launch Report > fix crashes > promote to Closed testing
(12 testers / 14 days on new Personal accounts).
