// Turns 21 hand landmarks into gestures. Pure functions and small state machines, so it's all testable.
//
// Landmarks (MediaPipe): 0 wrist · thumb 1-4 · index 5-8 · middle 9-12 · ring 13-16 · pinky 17-20.
// Coordinates are 0-1 across the camera image. The image is mirrored for display, so "user space"
// flips x: moving your hand to your right increases userX.

export type Point = { x: number; y: number; z?: number };
export type Hand = Point[]; // 21 points

export const GESTURES = ["none", "palm", "fist", "point", "peace", "pinch", "thumbsUp"] as const;
export type Gesture = (typeof GESTURES)[number];

export const GESTURE_INFO: Record<Gesture, { label: string; icon: string }> = {
  none: { label: "No gesture", icon: "·" },
  palm: { label: "Open palm", icon: "✋" },
  fist: { label: "Fist", icon: "✊" },
  point: { label: "Point", icon: "☝️" },
  peace: { label: "Peace", icon: "✌️" },
  pinch: { label: "Pinch", icon: "🤏" },
  thumbsUp: { label: "Thumbs up", icon: "👍" },
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** A size for the hand that doesn't depend on how far it is from the camera: wrist to middle knuckle. */
export const handSize = (h: Hand) => dist(h[0], h[9]) || 1e-6;

/** A finger is out when its tip is clearly further from the wrist than its middle joint. */
export function fingerOut(h: Hand, finger: "index" | "middle" | "ring" | "pinky") {
  const [pip, tip] = { index: [6, 8], middle: [10, 12], ring: [14, 16], pinky: [18, 20] }[finger];
  return dist(h[tip], h[0]) > dist(h[pip], h[0]) * 1.12;
}

/** The thumb is out when its tip sits well away from the side of the palm. */
export function thumbOut(h: Hand) {
  return dist(h[4], h[9]) > handSize(h) * 0.85 && dist(h[4], h[5]) > handSize(h) * 0.45;
}

export const pinchAmount = (h: Hand) => dist(h[4], h[8]) / handSize(h);

export function classify(h: Hand | null): Gesture {
  if (!h || h.length < 21) return "none";
  const index = fingerOut(h, "index");
  const middle = fingerOut(h, "middle");
  const ring = fingerOut(h, "ring");
  const pinky = fingerOut(h, "pinky");
  const thumb = thumbOut(h);
  const out = [index, middle, ring, pinky].filter(Boolean).length;

  if (pinchAmount(h) < 0.32 && !(out === 0 && !thumb)) return "pinch";
  if (out === 0) {
    // Thumb up and clearly above the wrist (y grows downwards)
    if (thumb && h[4].y < h[0].y - handSize(h) * 0.6 && h[4].y < h[5].y) return "thumbsUp";
    return "fist";
  }
  if (out === 4) return "palm";
  if (index && !middle && !ring && !pinky) return "point";
  if (index && middle && !ring && !pinky) return "peace";
  return "none";
}

/** Where things are, in user space (mirrored so it matches the screen). */
export const toUser = (p: Point): Point => ({ x: 1 - p.x, y: p.y });
export const palmCentre = (h: Hand): Point => {
  const ids = [0, 5, 9, 13, 17];
  return toUser({ x: ids.reduce((n, i) => n + h[i].x, 0) / 5, y: ids.reduce((n, i) => n + h[i].y, 0) / 5 });
};
export const fingertip = (h: Hand) => toUser(h[8]);
export const pinchPoint = (h: Hand) => toUser({ x: (h[4].x + h[8].x) / 2, y: (h[4].y + h[8].y) / 2 });

/** Only reports a gesture once it has held for a few frames, so flickers don't trigger anything. */
export class Steady {
  private candidate: Gesture = "none";
  private count = 0;
  current: Gesture = "none";
  constructor(private frames = 3) {}
  /** Returns the new gesture when it changes, otherwise null. */
  push(g: Gesture): Gesture | null {
    if (g === this.candidate) this.count++;
    else {
      this.candidate = g;
      this.count = 1;
    }
    if (this.count >= this.frames && g !== this.current) {
      this.current = g;
      return g;
    }
    return null;
  }
}

/** Spots a quick sideways sweep of an open hand. */
export class SwipeDetector {
  private trail: { x: number; y: number; t: number }[] = [];
  private lastSwipe = -Infinity;
  constructor(
    private distance = 0.22, // share of the frame width
    private window = 350, // ms
    private cooldown = 700, // ms
  ) {}
  push(p: Point | null, t: number): "left" | "right" | null {
    if (!p) {
      this.trail = [];
      return null;
    }
    this.trail.push({ x: p.x, y: p.y, t });
    this.trail = this.trail.filter((s) => t - s.t <= this.window);
    if (t - this.lastSwipe < this.cooldown || this.trail.length < 3) return null;
    const first = this.trail[0];
    const dx = p.x - first.x;
    const dy = p.y - first.y;
    if (Math.abs(dx) >= this.distance && Math.abs(dx) > Math.abs(dy) * 1.8) {
      this.lastSwipe = t;
      this.trail = [];
      return dx > 0 ? "right" : "left";
    }
    return null;
  }
}

/** Smooths a moving point so cursors don't jitter. Higher `ease` follows faster. */
export class Smooth {
  private p: Point | null = null;
  constructor(private ease = 0.45) {}
  push(next: Point | null): Point | null {
    if (!next) return (this.p = null);
    this.p = this.p ? { x: this.p.x + (next.x - this.p.x) * this.ease, y: this.p.y + (next.y - this.p.y) * this.ease } : next;
    return this.p;
  }
}

/** Fires once when a gesture has been held for a set time (e.g. a fist held to clear). */
export class Hold {
  private since: number | null = null;
  private fired = false;
  constructor(private ms: number) {}
  push(active: boolean, t: number): boolean {
    if (!active) {
      this.since = null;
      this.fired = false;
      return false;
    }
    this.since ??= t;
    if (!this.fired && t - this.since >= this.ms) {
      this.fired = true;
      return true;
    }
    return false;
  }
  progress(t: number) {
    return this.since === null || this.fired ? 0 : Math.min(1, (t - this.since) / this.ms);
  }
}
