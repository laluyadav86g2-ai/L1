# Daymark — 21-day reset

Daymark is a private, mobile-first tracker for a 21-day reset. It keeps check-ins and calendar history locally on the device; there are no accounts or remote data services.

## What’s included

- **Home:** current day count, daily **Clean** / **Relapsed** check-in, streak progress, and share-card creation.
- **Backfill:** set **I started on** or **I am on day** to mark a streak within the last 21 days. Backfilled days before today are marked clean; today stays open until its check-in.
- **Calendar:** month view with a green line for clean days and a red circle for relapses.
- **Themes:** 20 original, locally generated wallpapers. Each completed clean day unlocks one; a relapse locks the collection again. Unlocked wallpapers can be downloaded as PNGs.
- **No reset control:** relapse is a check-in, not a “start over” button. Previous calendar entries remain visible.

## Run the preview

```sh
npm ci
npm run dev
```

Vite serves the mobile-responsive preview on port `5173` and binds to `0.0.0.0` for hosted previews.

## Build an Android APK

Requires JDK 21 and Android SDK Platform 35 / Build Tools 35.

```sh
npm ci
npm run android:init   # only needed once if the android/ project is absent
npm run android:apk
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. The `Android APK` GitHub Actions workflow also builds this APK on pushes to the Arena branch or when manually dispatched, then uploads it as a downloadable workflow artifact. A store-ready release APK needs a signing key and release signing configuration.

## Tests

```sh
npm test
npm run build
```
