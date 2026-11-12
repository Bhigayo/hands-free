import { describe, expect, it } from "vitest";
import { classify, Hold, palmCentre, pinchPoint, Smooth, Steady, SwipeDetector, type Hand, type Point } from "./gestures";

type Pose = { index?: boolean; middle?: boolean; ring?: boolean; pinky?: boolean; thumb?: "out" | "tucked" | "up"; pinch?: boolean };

/** Builds a believable upright hand. Extended fingers point up; curled ones fold back towards the palm. */
function hand(pose: Pose, shift: Point = { x: 0, y: 0 }, scale = 1): Hand {
  const h: Point[] = [];
  const P = (x: number, y: number) => ({ x: 0.5 + (x - 0.5) * scale + shift.x, y: 0.8 + (y - 0.8) * scale + shift.y });
  h[0] = P(0.5, 0.8);
  // Thumb
  h[1] = P(0.4, 0.75);
  h[2] = P(0.35, 0.7);
  h[3] = pose.thumb === "up" ? P(0.37, 0.55) : P(0.31, 0.66);
  h[4] = pose.thumb === "out" ? P(0.28, 0.62) : pose.thumb === "up" ? P(0.38, 0.42) : P(0.46, 0.66);
  const fingers: [keyof Pose, number, number][] = [
    ["index", 5, 0.44],
    ["middle", 9, 0.5],
    ["ring", 13, 0.56],
    ["pinky", 17, 0.62],
  ];
  for (const [name, base, x] of fingers) {
    const out = pose[name];
    h[base] = P(x, 0.6);
    h[base + 1] = out ? P(x, 0.5) : P(x, 0.53);
    h[base + 2] = out ? P(x, 0.45) : P(x, 0.58);
    h[base + 3] = out ? P(x, 0.4) : P(x, 0.63);
  }
  if (pose.pinch) {
    h[4] = P(0.31, 0.6);
    h[8] = P(0.315, 0.605);
  }
  return h;
}

describe("classify", () => {
  it("recognises each gesture", () => {
    expect(classify(hand({ index: true, middle: true, ring: true, pinky: true, thumb: "out" }))).toBe("palm");
    expect(classify(hand({ thumb: "tucked" }))).toBe("fist");
    expect(classify(hand({ index: true, thumb: "tucked" }))).toBe("point");
    expect(classify(hand({ index: true, middle: true, thumb: "tucked" }))).toBe("peace");
    expect(classify(hand({ index: true, middle: true, ring: true, pinky: true, pinch: true }))).toBe("pinch");
    expect(classify(hand({ thumb: "up" }))).toBe("thumbsUp");
    expect(classify(null)).toBe("none");
  });

  it("doesn't care how big the hand is or where it is in the frame", () => {
    const far = hand({ index: true, middle: true, thumb: "tucked" }, { x: -0.25, y: -0.3 }, 0.5);
    const near = hand({ index: true, thumb: "tucked" }, { x: 0.1, y: 0 }, 1.4);
    expect(classify(far)).toBe("peace");
    expect(classify(near)).toBe("point");
  });

  it("mirrors positions so they match the screen", () => {
    const h = hand({ pinch: true, middle: true, ring: true, pinky: true });
    expect(pinchPoint(h).x).toBeCloseTo(1 - 0.3125, 2);
    expect(palmCentre(h).x).toBeGreaterThan(0.4);
  });
});

describe("steadiness and timing", () => {
  it("ignores one-frame flickers", () => {
    const s = new Steady(3);
    expect(s.push("palm")).toBeNull();
    expect(s.push("fist")).toBeNull(); // flicker
    expect(s.push("palm")).toBeNull();
    expect(s.push("palm")).toBeNull();
    expect(s.push("palm")).toBe("palm");
    expect(s.push("palm")).toBeNull(); // already reported
  });

  it("detects swipes in the right direction, once per sweep", () => {
    const d = new SwipeDetector();
    const hits: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const r = d.push({ x: 0.3 + i * 0.04, y: 0.5 }, i * 30);
      if (r) hits.push(r);
    }
    expect(hits).toEqual(["right"]);
    const d2 = new SwipeDetector();
    let r2 = null;
    for (let i = 0; i <= 10; i++) r2 = d2.push({ x: 0.8 - i * 0.04, y: 0.5 }, i * 30) ?? r2;
    expect(r2).toBe("left");
  });

  it("doesn't count slow drifts or vertical moves as swipes", () => {
    const d = new SwipeDetector();
    for (let i = 0; i <= 40; i++) expect(d.push({ x: 0.3 + i * 0.01, y: 0.5 }, i * 50)).toBeNull();
    const v = new SwipeDetector();
    for (let i = 0; i <= 10; i++) expect(v.push({ x: 0.5 + i * 0.025, y: 0.2 + i * 0.06 }, i * 30)).toBeNull();
  });

  it("smooths jitter and fires holds once", () => {
    const s = new Smooth(0.5);
    s.push({ x: 0, y: 0 });
    expect(s.push({ x: 1, y: 1 })).toEqual({ x: 0.5, y: 0.5 });
    const h = new Hold(500);
    expect(h.push(true, 0)).toBe(false);
    expect(h.progress(250)).toBeCloseTo(0.5);
    expect(h.push(true, 520)).toBe(true);
    expect(h.push(true, 900)).toBe(false);
    h.push(false, 950);
    expect(h.push(true, 1000)).toBe(false);
  });
});
