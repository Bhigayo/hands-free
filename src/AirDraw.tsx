import { useEffect, useRef, useState } from "react";
import { Hold, Smooth } from "./gestures";
import { useHandFrames } from "./hands";
import { pointIn } from "./point";

const COLOURS = ["#c6ff3d", "#ff5ea8", "#5ec8ff", "#ffd23d", "#ffffff"];

/** Point to draw, open palm to move without drawing, peace for the next colour, hold a fist to clear, thumbs up to save. */
export default function AirDraw() {
  const wrap = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLCanvasElement>(null);
  const [colour, setColour] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number; drawing: boolean } | null>(null);
  const [clearing, setClearing] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const smooth = useRef(new Smooth(0.5));
  const clearHold = useRef(new Hold(900));
  const colourRef = useRef(0);
  colourRef.current = colour;

  // Keep the canvas sized to the screen without losing the drawing
  useEffect(() => {
    const c = ink.current!;
    const fit = () => {
      const copy = document.createElement("canvas");
      copy.width = c.width;
      copy.height = c.height;
      copy.getContext("2d")!.drawImage(c, 0, 0);
      c.width = c.clientWidth * devicePixelRatio;
      c.height = c.clientHeight * devicePixelRatio;
      c.getContext("2d")!.drawImage(copy, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const clear = () => {
    const c = ink.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    show("Cleared");
  };
  const save = () => {
    const c = ink.current!;
    const out = document.createElement("canvas");
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#0b0d10";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(c, 0, 0);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `air-drawing-${Date.now()}.png`;
    a.click();
    show("Saved");
  };
  const show = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(null), 900);
  };

  const line = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = ink.current!.getContext("2d")!;
    const d = devicePixelRatio;
    ctx.strokeStyle = COLOURS[colourRef.current];
    ctx.lineWidth = 7 * d;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = COLOURS[colourRef.current];
    ctx.shadowBlur = 14 * d;
    ctx.beginPath();
    ctx.moveTo(from.x * d, from.y * d);
    ctx.lineTo(to.x * d, to.y * d);
    ctx.stroke();
  };

  useHandFrames((f) => {
    if (f.changed && f.gesture === "peace") setColour((c) => (c + 1) % COLOURS.length);
    if (f.changed && f.gesture === "thumbsUp") save();
    if (clearHold.current.push(f.gesture === "fist", f.t)) clear();
    setClearing(clearHold.current.progress(f.t));

    const drawing = f.gesture === "point";
    const p = wrap.current && (drawing || f.gesture === "palm") ? smooth.current.push(pointIn(f, wrap.current)) : smooth.current.push(null);
    if (p && drawing && last.current) line(last.current, p);
    last.current = drawing ? p : null;
    setCursor(p ? { ...p, drawing } : null);
  });

  return (
    <div className="demo draw">
      <div className="stage draw-stage" ref={wrap}>
        <canvas ref={ink} className="ink" />
        {cursor && <span className={`cursor ${cursor.drawing ? "drawing" : ""}`} style={{ left: cursor.x, top: cursor.y, borderColor: COLOURS[colour] }} />}
        {clearing > 0 && (
          <span className="clear-meter" style={{ ["--p" as string]: clearing }}>
            Clearing…
          </span>
        )}
        {flash && <span className="flash">{flash}</span>}
      </div>
      <div className="demo-bar">
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {COLOURS.map((c, i) => (
            <button key={c} role="radio" aria-checked={i === colour} aria-label={`Colour ${i + 1}`} className={i === colour ? "on" : ""} style={{ background: c }} onClick={() => setColour(i)} />
          ))}
        </div>
        <button className="ghost" onClick={clear}>
          Clear
        </button>
        <button className="ghost" onClick={save}>
          Save PNG
        </button>
      </div>
    </div>
  );
}
