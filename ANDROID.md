# ClipForge for Android

The Android app runs the **same engine and the same screens** as the desktop app.

- Screens: the React app in `src/` (phone layout = bottom bar, stacked panels) inside a Capacitor WebView.
- Engine: `electron/main.cjs` + `electron/engine/*` running inside Node.js (nodejs-mobile, via the `capacitor-nodejs` plugin).
  `mobile/node/index.js` replaces the `electron` module with a small shim, so nothing in the engine was rewritten.
- Programs: `libffmpeg.so`, `libffprobe.so`, `libwhisper-cli.so` (arm64) are packed in `jniLibs` — Android only runs programs from there.
- YouTube downloads: yt-dlp through the `youtubedl-android` library (Python is bundled). If that library cannot be resolved the CI retries without it (`-PwithYt=false`).
- Phone features (file picker, save to gallery, install update, keep running with the screen off): `android/app/src/main/java/com/clipforge/studio/ClipForgePlugin.java`.

## Build (GitHub Actions does this on every `v*` tag, job "android")
```
npm install
# put libffmpeg.so / libffprobe.so / libwhisper-cli.so into android/app/src/main/jniLibs/arm64-v8a/
npm run mobile:build            # vite build + assemble engine + cap sync
cd android && ./gradlew assembleRelease
```
Output: `ClipForge-android-arm64.apk` (signed with `android/app/clipforge-release.jks`, so updates install over the old version — keep this file).

## Differences from desktop
- Face-detect frames and caption alignment: face detection runs in the WebView; the wav2vec2 aligner (onnxruntime-node) is not available, so whisper's own word timings are used.
- Folders cannot be chosen; clips are saved in the app folder. "Open folder" / "Show in folder" copies clips to **Movies/ClipForge** in the gallery.
- Choose the *small* speech model or lower on phones; it is much slower than a PC.
