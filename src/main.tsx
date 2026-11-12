import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import AirDraw from "./AirDraw";
import CameraPanel from "./CameraPanel";
import DJ from "./DJ";
import { GESTURE_INFO, type Gesture } from "./gestures";
import { HandsProvider, useHands } from "./hands";
import Slides from "./Slides";

type Mode = "slides" | "dj" | "draw";

const GUIDES: Record<Mode, { title: string; moves: [Gesture | "swipe", string, string][] }> = {
  slides: {
    title: "Slides",
    moves: [
      ["swipe", "Swipe left / right", "Next / back (← →)"],
      ["thumbsUp", "Thumbs up", "Send a reaction (T)"],
    ],
  },
  dj: {
    title: "DJ",
    moves: [
      ["palm", "Open palm", "Play (P)"],
      ["fist", "Hold a fist", "Stop (F)"],
      ["pinch", "Pinch + move", "Up/down volume, left/right filter (N + mouse)"],
      ["swipe", "Swipe", "Next groove (← →)"],
    ],
  },
  draw: {
    title: "Air Draw",
    moves: [
      ["point", "Point", "Draw (I + mouse)"],
      ["palm", "Open palm", "Move without drawing (P)"],
      ["peace", "Peace", "Next colour (V)"],
      ["fist", "Hold a fist", "Clear (F)"],
      ["thumbsUp", "Thumbs up", "Save PNG (T)"],
    ],
  },
};

function App() {
  const h = useHands();
  const [mode, setMode] = useState<Mode>("slides");
  const started = h.status === "on" || h.status === "loading" || h.status === "keyboard";

  if (!started) {
    return (
      <main className="intro">
        <p className="eyebrow">Gesture control in the browser</p>
        <h1>
          Hands
          <br />
          Free
        </h1>
        <p className="lede">Run slides, DJ a beat and draw in the air with nothing but your hand and a webcam.</p>
        <div className="intro-actions">
          <button className="primary" onClick={h.start}>
            Turn on camera
          </button>
          <button className="ghost" onClick={h.startKeyboard}>
            No camera? Use the keyboard
          </button>
        </div>
        {h.error && (
          <p className="error" role="alert">
            {h.error}
          </p>
        )}
        <p className="fine">Your camera feed never leaves this device. Hand tracking runs locally with MediaPipe. The first start downloads the hand model (about 8 MB).</p>
      </main>
    );
  }

  const guide = GUIDES[mode];
  return (
    <div className="app">
      <header className="top">
        <b className="logo">Hands Free</b>
        <nav className="modes" aria-label="Demo">
          {(Object.keys(GUIDES) as Mode[]).map((m) => (
            <button key={m} className={m === mode ? "on" : ""} aria-pressed={m === mode} onClick={() => setMode(m)}>
              {GUIDES[m].title}
            </button>
          ))}
        </nav>
        <button className="ghost small" onClick={h.stop}>
          {h.status === "keyboard" ? "Exit" : "Camera off"}
        </button>
      </header>
      <div className="layout">
        <section className="main-area">
          {mode === "slides" && <Slides />}
          {mode === "dj" && <DJ />}
          {mode === "draw" && <AirDraw />}
        </section>
        <aside className="side">
          <CameraPanel />
          <div className="guide">
            <h3>{guide.title} moves</h3>
            <ul>
              {guide.moves.map(([g, name, what]) => (
                <li key={name} className={g === h.gesture ? "live" : ""}>
                  <span className="g-icon" aria-hidden="true">
                    {g === "swipe" ? "👋" : GESTURE_INFO[g].icon}
                  </span>
                  <span>
                    <b>{name}</b>
                    <small>{h.status === "keyboard" ? what : what.replace(/\s*\([^)]*\)$/, "")}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HandsProvider>
      <App />
    </HandsProvider>
  </StrictMode>,
);
