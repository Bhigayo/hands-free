# Hands Free

Control things with your hand using just a webcam. Hand tracking runs in the browser (MediaPipe Hand Landmarker), so the camera feed never leaves your device.

- **Slides:** swipe an open hand left or right to change slides, and give a thumbs up to send a reaction across the screen. You can load your own slides as images.
- **DJ:** an Amapiano groove made live with Web Audio (kick, shaker, log drum, chords). An open palm plays and a fist held for half a second stops. Pinch and move to control the sound: up and down for volume, left and right to sweep the filter. Swipe for the next groove. You can also play your own song through the same controls.
- **Air Draw:** point to draw neon lines in the air, use an open palm to move without drawing, a peace sign for the next colour, a fist held to clear, and a thumbs up to save a PNG.
- **No camera?** Keyboard mode: hold P (palm), F (fist), I (point), V (peace), N (pinch) or T (thumbs up), use ← → to swipe, and the mouse is your hand.

## How it works

- `src/gestures.ts` turns 21 hand landmarks into gestures. Finger extension is measured against the hand's own size, so it works near or far from the camera. Gestures must hold for 3 frames before they count, which stops flicker. Swipes need speed and a mostly horizontal path, with a cooldown between them. It's all covered by tests in `src/gestures.test.ts`.
- `src/hands.tsx` runs the camera and the tracker, using the GPU when it can and falling back to the CPU.
- `src/beat.ts` is the synth and step sequencer.

The tracking engine files are in `public/mediapipe`. The hand model (about 8 MB) loads from Google's model storage on first start.

## Run it

```
npm install
npm run dev
npm test
```

The camera needs `localhost` or HTTPS, and GitHub Pages is HTTPS.

## Put it online (GitHub Pages)

In PowerShell, run one line at a time:

```
git init
git add -A
git commit -m "Hands Free"
git branch -M main
git remote add origin https://github.com/Bhigayo/hands-free.git
git push -u origin main
```

Then go to **Settings → Pages → Source: GitHub Actions**.
