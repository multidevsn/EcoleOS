# EcoleOS Android Shell Notes

## Purpose

The Android folder contains the native wrapper used to package the web app into an APK. It is not the main application logic. EcoleOS’s core product remains the React web application and Supabase-backed platform.

## Architecture

The native Android app loads a bundled web application into a WebView. The shell is responsible for:
- displaying the app inside a native container
- enforcing secure origin handling
- loading local web assets
- surfacing native errors if the server or network fails

## Build process

The app is built with a web bundle appropriate for the WebView. The repository README already describes the needed flow:

```bash
npm ci
npm run build:android
cd android
./gradlew assembleDebug
# or
./gradlew assembleRelease
```

The Android build should not be based on a standard `npm run build` output for PWA or web app packaging if the shell expects a clean WebView bundle.

## Security notes

The Android layer should continue to enforce:
- HTTPS-only origins
- blocked mixed content
- limited external resources
- no JavaScript-native bridge unless explicitly required
- no secret material in the client bundle

## Mobile-specific concerns

The mobile shell handles issues like:
- invalid server origin
- TLS failures
- network errors
- loading state visibility
- WebView lifecycle cleanup

These are platform concerns, not the core product’s business logic.

## Recommendation

Treat the Android folder as an isolated deployment module, not as a core architectural pillar of the application. This keeps the product logic clear and reduces risk of confusing the mobile wrapper with the main SaaS platform.
