// Camera + hand tracking, running entirely in the browser. Every frame becomes a HandFrame that the demos listen to.
// Keyboard shortcuts stand in for gestures, so everything also works without a camera.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { classify, palmCentre, Steady, SwipeDetector, type Gesture, type Hand, type Point } from "./gestures";

export const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type HandFrame = {
  t: number;
  hand: Hand | null; // raw landmarks (camera space)
  raw: Gesture; // this frame's guess
  gesture: Gesture; // steady gesture
  changed: boolean; // the steady gesture just changed
  swipe: "left" | "right" | null;
  pointer: Point | null; // keyboard mode: the mouse, in 0-1 screen space
};

type Status = "off" | "loading" | "on" | "denied" | "error" | "keyboard";

type Hands = {
  status: Status;
  error: string;
  gesture: Gesture;
  start(): void;
  startKeyboard(): void;
  stop(): void;
  subscribe(fn: (f: HandFrame) => void): () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  lastHand: React.RefObject<Hand | null>;
};

const Ctx = createContext<Hands | null>(null);
export const useHands = () => {
  const h = useContext(Ctx);
  if (!h) throw new Error("useHands must be used inside HandsProvider");
  return h;
};

/** Run a callback on every hand frame. */
export function useHandFrames(fn: (f: HandFrame) => void) {
  const { subscribe } = useHands();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((f) => ref.current(f)), [subscribe]);
}

const KEY_GESTURES: Record<string, Gesture> = { p: "palm", f: "fist", i: "point", v: "peace", n: "pinch", t: "thumbsUp" };

export function HandsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("off");
  const [error, setError] = useState("");
  const [gesture, setGesture] = useState<Gesture>("none");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const listeners = useRef(new Set<(f: HandFrame) => void>());
  const stopRef = useRef<() => void>(() => {});
  const lastHand = useRef<Hand | null>(null);

  const emit = useCallback((f: HandFrame) => {
    if (f.changed) setGesture(f.gesture);
    for (const fn of listeners.current) fn(f);
  }, []);

  const subscribe = useCallback((fn: (f: HandFrame) => void) => {
    listeners.current.add(fn);
    return () => void listeners.current.delete(fn);
  }, []);

  const stop = useCallback(() => {
    stopRef.current();
    stopRef.current = () => {};
    setStatus("off");
    setGesture("none");
  }, []);

  const start = useCallback(async () => {
    stopRef.current();
    setStatus("loading");
    setError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setStatus(denied ? "denied" : "error");
      setError(denied ? "Camera access was blocked. Allow it in your browser's site settings, or use the keyboard instead." : "No camera was found on this device.");
      return;
    }
    // The camera panel renders while we wait for permission; fall back to an off-screen video just in case
    const video = videoRef.current ?? Object.assign(document.createElement("video"), { muted: true, playsInline: true });
    video.srcObject = stream;
    await video.play().catch(() => {});

    let landmarker: import("@mediapipe/tasks-vision").HandLandmarker;
    try {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(new URL("mediapipe", document.baseURI).href);
      const make = (delegate: "GPU" | "CPU") =>
        HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: "VIDEO", numHands: 1 });
      landmarker = await make("GPU").catch(() => make("CPU"));
    } catch (e) {
      console.error(e);
      stream.getTracks().forEach((t) => t.stop());
      setStatus("error");
      setError("The hand tracker couldn't load. Check your connection and try again. The model downloads once (about 8 MB).");
      return;
    }

    const steady = new Steady(3);
    const swipes = new SwipeDetector();
    let running = true;
    let lastT = -1;
    const loop = () => {
      if (!running) return;
      if (video.readyState >= 2 && video.currentTime !== lastT) {
        lastT = video.currentTime;
        const t = performance.now();
        const res = landmarker.detectForVideo(video, t);
        const hand = (res.landmarks?.[0] as Hand | undefined) ?? null;
        lastHand.current = hand;
        const raw = classify(hand);
        const change = steady.push(raw);
        const swipe = swipes.push(hand && raw !== "fist" && raw !== "pinch" ? palmCentre(hand) : null, t);
        emit({ t, hand, raw, gesture: steady.current, changed: change !== null, swipe, pointer: null });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    setStatus("on");
    stopRef.current = () => {
      running = false;
      landmarker.close();
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      lastHand.current = null;
    };
  }, [emit]);

  // Keyboard mode: hold P F I V N T for gestures, arrows to swipe, mouse as the pointer
  const startKeyboard = useCallback(() => {
    stopRef.current();
    setStatus("keyboard");
    let current: Gesture = "none";
    let pointer: Point | null = null;
    let pendingSwipe: "left" | "right" | null = null;
    let changed = false;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const g = KEY_GESTURES[e.key.toLowerCase()];
      if (g && g !== current) {
        current = g;
        changed = true;
      }
      if (e.key === "ArrowLeft") pendingSwipe = "left";
      if (e.key === "ArrowRight") pendingSwipe = "right";
    };
    const up = (e: KeyboardEvent) => {
      if (KEY_GESTURES[e.key.toLowerCase()] === current) {
        current = "none";
        changed = true;
      }
    };
    const move = (e: PointerEvent) => (pointer = { x: e.clientX / innerWidth, y: e.clientY / innerHeight });
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("pointermove", move);
    const timer = setInterval(() => {
      emit({ t: performance.now(), hand: null, raw: current, gesture: current, changed, swipe: pendingSwipe, pointer });
      changed = false;
      pendingSwipe = null;
    }, 33);
    stopRef.current = () => {
      clearInterval(timer);
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("pointermove", move);
    };
  }, [emit]);

  useEffect(() => () => stopRef.current(), []);

  return <Ctx.Provider value={{ status, error, gesture, start, startKeyboard, stop, subscribe, videoRef, lastHand }}>{children}</Ctx.Provider>;
}
