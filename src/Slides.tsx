import { useRef, useState } from "react";
import { useHandFrames } from "./hands";

const DECK = [
  { title: "Hands Free", body: "No mouse. No keyboard. Just your hand.", tone: "lime" },
  { title: "Swipe left", body: "Sweep an open hand across the camera to go to the next slide.", tone: "dark" },
  { title: "Swipe right", body: "Sweep the other way to go back.", tone: "violet" },
  { title: "👍", body: "Thumbs up sends a reaction across the screen.", tone: "dark" },
  { title: "On device", body: "Your camera never leaves this browser. The hand tracking runs right here.", tone: "lime" },
  { title: "Fin.", body: "Built by Abdulmalik Olusesi.", tone: "violet" },
];

type Reaction = { id: number; x: number };

export default function Slides() {
  const [i, setI] = useState(0);
  const [own, setOwn] = useState<string[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const count = own.length || DECK.length;

  useHandFrames((f) => {
    // Hand moving left = next, like swiping on a phone
    if (f.swipe === "left") setI((n) => Math.min(count - 1, n + 1));
    if (f.swipe === "right") setI((n) => Math.max(0, n - 1));
    if (f.changed && f.gesture === "thumbsUp") {
      const r = { id: Date.now(), x: 15 + Math.random() * 70 };
      setReactions((all) => [...all, r]);
      setTimeout(() => setReactions((all) => all.filter((x) => x.id !== r.id)), 2200);
    }
  });

  const slide = DECK[i];
  return (
    <div className="demo slides">
      <div className="stage">
        {own.length ? (
          <img className="own-slide" src={own[i]} alt={`Slide ${i + 1}`} />
        ) : (
          <div className={`slide ${slide.tone}`} key={i}>
            <h2>{slide.title}</h2>
            <p>{slide.body}</p>
          </div>
        )}
        {reactions.map((r) => (
          <span key={r.id} className="reaction" style={{ left: `${r.x}%` }} aria-hidden="true">
            👍
          </span>
        ))}
        <div className="dots" aria-label={`Slide ${i + 1} of ${count}`}>
          {Array.from({ length: count }, (_, n) => (
            <span key={n} className={n === i ? "on" : ""} />
          ))}
        </div>
      </div>
      <div className="demo-bar">
        <button className="ghost" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
          ← Back
        </button>
        <button className="ghost" onClick={() => input.current?.click()}>
          Use my own slides
        </button>
        {own.length > 0 && (
          <button className="ghost" onClick={() => (setOwn([]), setI(0))}>
            Back to the demo deck
          </button>
        )}
        <button className="ghost" onClick={() => setI((n) => Math.min(count - 1, n + 1))} disabled={i === count - 1}>
          Next →
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            if (files.length) {
              setOwn(files.map((f) => URL.createObjectURL(f)));
              setI(0);
            }
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
