# Seal webcam feasibility probe

This is a throwaway browser probe for checking whether real webcam hand landmarks can drive the Jutsu Hero seal classifier. It is deliberately a diagnostic page, not the game.

## Setup

1. Run `npm test` to execute the dependency-free Node tests.
2. Run `node scripts/build-standalone.mjs` to regenerate `probe.html` from `index.html`, `styles.css`, and `src/`.
3. Open `probe.html` in Chrome, click **Load model**, then **Start camera**, and grant camera permission. The page also has a module version at `index.html` for a static local server.
4. Choose the reference seal, then use **Start single-sign trial** for one hold or choose three sequence dropdowns and use **Start sequence trial**. Start only after the live readout is producing real predictions.

The page needs network access for the pinned MediaPipe, ONNX Runtime, hand-landmarker, classifier, and reference image URLs. No package install is required. If the browser rejects camera access from a `file://` page, serve this directory from a local HTTPS or localhost static server.

## What it measures

- MediaPipe Tasks Vision `0.10.34`, up to four hands, raw video detection, CSS-mirrored preview.
- Two-hand input is normalized as 21 XY pairs per hand: subtract wrist point 0, divide by wrist-to-middle-MCP point 9, then concatenate primary and secondary hands into float32 `[1, 84]` input. A missing secondary hand is zero-filled.
- ONNX Runtime Web `1.17.3` uses one WASM thread. The first output is direct argmax with a `0.6` confidence threshold; there is no softmax.
- A recognized sequence sign must remain valid for about 350 ms. Missing hands, low confidence, or a wrong current frame reset the hold. Trials time out after 15 seconds.
- The log records sequence, success, elapsed sequence time, and measured inference durations. It never stores camera frames, video, landmarks, or model tensors. **Export JSON** contains only those records.

Reliability still requires a manual test with a real camera and varied lighting, distance, background, hand size, left/right ordering, and one- versus two-hand poses. A passing unit test or a high score is not a claim that seal recognition is reliable enough for a game.

## Attribution and license

The seal classifier and seal reference images are upstream assets from [bunkerapps/Jutsu-Hero](https://github.com/bunkerapps/Jutsu-Hero), pinned to commit [`10c5a914f9f14b4427d988d253048bf0fae8eb52`](https://github.com/bunkerapps/Jutsu-Hero/tree/10c5a914f9f14b4427d988d253048bf0fae8eb52). The classifier is loaded from the upstream raw asset at runtime; the probe does not redistribute or modify it. Review the upstream repository's license and asset terms before shipping or redistributing this prototype.

The hand-landmarker task is served by Google's MediaPipe model-hosting URL, and the browser libraries are served by jsDelivr. They are separate runtime dependencies from the Jutsu Hero assets; review their respective terms before reuse.

The probe code in this repository has no production or game license grant. It is an internal feasibility artifact and should not be treated as a release-ready product.
