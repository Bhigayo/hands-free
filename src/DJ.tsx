import { useEffect, useRef, useState } from "react";
import { Beat, cutoffFor, PATTERNS } from "./beat";
import { Hold, Smooth } from "./gestures";
import { useHandFrames } from "./hands";
import { pointIn } from "./point";

/**
 * Open palm plays, a fist held for half a second stops. Pinch and move: up and down is volume,
 * left and right sweeps the filter. Swipe for the next groove.
 */
export default function DJ() {
  const beat = useRef<Beat | null>(null);
  const pad = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [filter, setFilter] = useState(1);
  const [pattern, setPattern] = useState(0);
  const [song, setSong] = useState<string | null>(null);
  const [grab, setGrab] = useState<{ x: number; y: number } | null>(null);
  const smooth = useRef(new Smooth(0.35));
  const stopHold = useRef(new Hold(500));
  const [holding, setHolding] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  const ensure = () => (beat.current ??= new Beat());

  useEffect(() => () => beat.current?.close(), []);

  // The level meter
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = bars.current;
      const b = beat.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      const w = (c.width = c.clientWidth * devicePixelRatio);
      const h = (c.height = c.clientHeight * devicePixelRatio);
      ctx.clearRect(0, 0, w, h);
      if (!b) return;
      const data = new Uint8Array(b.analyser.frequencyBinCount);
      b.analyser.getByteFrequencyData(data);
      const n = 48;
      for (let i = 0; i < n; i++) {
        const v = data[Math.floor((i / n) * data.length * 0.7)] / 255;
        ctx.fillStyle = `rgba(198,255,61,${0.25 + v * 0.75})`;
        const bw = w / n;
        ctx.fillRect(i * bw + 1, h - v * h, bw - 2, v * h);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const play = async () => {
    await ensure().play();
    setPlaying(true);
  };
  const pause = () => {
    beat.current?.pause();
    setPlaying(false);
  };

  useHandFrames((f) => {
    if (f.changed && f.gesture === "palm" && !playing) play();
    const stop = stopHold.current.push(f.gesture === "fist" && playing, f.t);
    setHolding(stopHold.current.progress(f.t));
    if (stop) pause();
    if (f.swipe && beat.current) {
      beat.current.next(f.swipe === "left" ? 1 : -1);
      setPattern(beat.current.pattern);
    }
    // Pinch-and-move controls volume (up/down) and the filter (left/right)
    const p = f.gesture === "pinch" && pad.current ? pointIn(f, pad.current, "pinch") : null;
    const s = smooth.current.push(p);
    if (s && pad.current) {
      const r = pad.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, s.x / r.width));
      const y = Math.max(0, Math.min(1, s.y / r.height));
      setGrab({ x, y });
      setVolume(1 - y);
      setFilter(x);
      beat.current?.setVolume(1 - y);
      beat.current?.setFilter(x);
    } else if (grab) setGrab(null);
  });

  const hz = cutoffFor(filter);
  return (
    <div className="demo dj">
      <div className="stage dj-stage">
        <div className="dj-top">
          <div>
            <small>{song ? "Your song" : `Groove ${pattern + 1} of ${PATTERNS.length}`}</small>
            <h2>{song ?? PATTERNS[pattern].name}</h2>
            {!song && <p className="muted">{PATTERNS[pattern].bpm} BPM · Amapiano, made live in your browser</p>}
          </div>
          <button className={`play ${playing ? "on" : ""}`} onClick={() => (playing ? pause() : play())} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "❚❚" : "▶"}
            {holding > 0 && <span className="hold-ring" style={{ ["--p" as string]: holding }} />}
          </button>
        </div>
        <div className="pad" ref={pad}>
          <span className="pad-label top">Louder</span>
          <span className="pad-label bottom">Quieter</span>
          <span className="pad-label left">Muffled</span>
          <span className="pad-label right">Bright</span>
          <span className={`puck ${grab ? "grabbed" : ""}`} style={{ left: `${filter * 100}%`, top: `${(1 - volume) * 100}%` }} />
          <canvas ref={bars} className="bars" aria-hidden="true" />
        </div>
        <div className="meters">
          <span>
            Volume <b>{Math.round(volume * 100)}%</b>
          </span>
          <span>
            Filter <b>{hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`}</b>
          </span>
        </div>
      </div>
      <div className="demo-bar">
        <label className="slider">
          Volume
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => (setVolume(+e.target.value), ensure().setVolume(+e.target.value))} />
        </label>
        <label className="slider">
          Filter
          <input type="range" min={0} max={1} step={0.01} value={filter} onChange={(e) => (setFilter(+e.target.value), ensure().setFilter(+e.target.value))} />
        </label>
        <button className="ghost" onClick={() => file.current?.click()}>
          Use my own song
        </button>
        <input
          ref={file}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            ensure().useSong(f);
            setSong(f.name.replace(/\.[^.]+$/, ""));
            setPlaying(false);
          }}
        />
      </div>
    </div>
  );
}
