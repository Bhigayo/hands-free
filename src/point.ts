import { fingertip, pinchPoint, type Point } from "./gestures";
import type { HandFrame } from "./hands";

/** Stretches the middle of the camera view to fill the screen, so you can reach the edges without leaving the frame. */
export const reach = (v: number, margin = 0.15) => Math.max(0, Math.min(1, (v - margin) / (1 - margin * 2)));

/**
 * Where the hand is pointing, in pixels inside an element: the fingertip (or the pinch point when pinching)
 * from the camera, or the mouse in keyboard mode.
 */
export function pointIn(f: HandFrame, el: HTMLElement, which: "tip" | "pinch" = "tip"): Point | null {
  const r = el.getBoundingClientRect();
  if (f.hand) {
    const p = which === "pinch" ? pinchPoint(f.hand) : fingertip(f.hand);
    return { x: reach(p.x) * r.width, y: reach(p.y) * r.height };
  }
  if (f.pointer) return { x: f.pointer.x * innerWidth - r.left, y: f.pointer.y * innerHeight - r.top };
  return null;
}
