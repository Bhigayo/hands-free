import { useRef } from "react";
import { GESTURE_INFO } from "./gestures";
import { useHandFrames, useHands } from "./hands";

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

/** The small mirrored camera view with the tracked hand drawn over it, plus the live gesture. */
export default function CameraPanel() {
  const h = useHands();
  const canvas = useRef<HTMLCanvasElement>(null);

  useHandFrames((f) => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const w = (c.width = c.clientWidth * devicePixelRatio);
    const hgt = (c.height = c.clientHeight * devicePixelRatio);
    ctx.clearRect(0, 0, w, hgt);
    if (!f.hand) return;
    const P = (i: number) => [(1 - f.hand![i].x) * w, f.hand![i].y * hgt] as const;
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.strokeStyle = "rgba(198,255,61,0.85)";
    ctx.lineCap = "round";
    for (const [a, b] of BONES) {
      ctx.beginPath();
      ctx.moveTo(...P(a));
      ctx.lineTo(...P(b));
      ctx.stroke();
    }
    ctx.fillStyle = "#0b0d10";
    for (let i = 0; i < 21; i++) {
      ctx.beginPath();
      ctx.arc(...P(i), (i % 4 === 0 ? 5 : 3.5) * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  });

  const info = GESTURE_INFO[h.gesture];
  return (
    <div className="camera">
      <div className={`camera-view ${h.status === "on" ? "live" : ""}`}>
        <video ref={h.videoRef} playsInline muted aria-hidden="true" />
        <canvas ref={canvas} aria-hidden="true" />
        {h.status === "loading" && <span className="camera-msg">Starting the camera and hand tracker…</span>}
        {h.status === "keyboard" && <span className="camera-msg">Keyboard mode</span>}
      </div>
      <div className="now" aria-live="polite">
        <span className="now-icon" aria-hidden="true">
          {info.icon}
        </span>
        <span>
          <small>Gesture</small>
          {info.label}
        </span>
      </div>
    </div>
  );
}
