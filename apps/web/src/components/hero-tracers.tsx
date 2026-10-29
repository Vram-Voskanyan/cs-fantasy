import type { CSSProperties } from "react";

// Fixed positions so server and client render the same markup. Decorative only.
const TRACERS = [
  { x: "-20%", len: 120, dur: 4.2, delay: 0, o: 0.5 },
  { x: "5%", len: 80, dur: 5.5, delay: 1.3, o: 0.35 },
  { x: "18%", len: 160, dur: 3.6, delay: 2.4, o: 0.6 },
  { x: "-8%", len: 60, dur: 6.4, delay: 3.1, o: 0.3 },
  { x: "32%", len: 100, dur: 4.8, delay: 0.7, o: 0.45 },
  { x: "45%", len: 140, dur: 3.9, delay: 4.2, o: 0.55 },
  { x: "12%", len: 70, dur: 5.9, delay: 5.0, o: 0.3 },
  { x: "58%", len: 110, dur: 4.4, delay: 2.0, o: 0.4 },
  { x: "-30%", len: 180, dur: 3.4, delay: 6.1, o: 0.6 },
  { x: "25%", len: 90, dur: 5.2, delay: 7.0, o: 0.35 },
];

export function HeroTracers() {
  return (
    <div className="tracers" aria-hidden="true">
      {TRACERS.map((t, i) => (
        <span
          key={i}
          className="tracer"
          style={{ "--x": t.x, "--len": `${t.len}px`, "--dur": `${t.dur}s`, "--delay": `${t.delay}s`, "--o": t.o } as CSSProperties}
        />
      ))}
    </div>
  );
}
