# NexoraJobs Android + iOS App

This package converts the supplied NexoraJobs frontend into a Capacitor mobile app shell while keeping the existing UI, JavaScript functionality and Node/SQLite backend.

## Included
- `www/` — mobile-optimized frontend
- `app.js` — original frontend logic with a configurable API base URL
- `style.css` — original styles plus Android/iOS responsive overrides
- `server.js` — supplied backend
- Capacitor configuration for Android and iOS
- `config.js` — backend URL configuration

## Important: backend
The supplied backend uses Express + SQLite + JWT and normally runs as a Node server. A phone cannot use `localhost:5000` to reach a server running on your PC.

For a real phone build:
1. Deploy `server.js` and its database/dependencies to a server with an HTTPS URL.
2. Open `www/config.js`.
3. Set:
   `window.NEXORA_API_BASE_URL = "https://YOUR-BACKEND-DOMAIN";`
4. Configure your Google OAuth redirect URI to point to the deployed backend callback:
   `/auth/google/callback`.
5. Install Node.js and run:
   `npm install`
6. Add native platforms:
   `npx cap add android`
   `npx cap add ios` (macOS/Xcode required for iOS)
7. Sync:
   `npx cap sync`
8. Open Android Studio:
   `npx cap open android`
9. On macOS, open Xcode:
   `npx cap open ios`

## Local testing
- Android emulator can generally reach a PC server through `10.0.2.2:5000`.
- iOS Simulator can generally use `http://localhost:5000`.
- A physical phone needs the PC's LAN address or, preferably, a deployed HTTPS backend.

## Notes
The mobile layout uses a bottom navigation bar, safe-area support for iPhone, touch-friendly controls, stacked cards/forms, horizontal scrolling for wide tables, and portrait-first responsive behavior.

The backend remains server-side; SQLite is not moved into the phone app.
