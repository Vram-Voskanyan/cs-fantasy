import type { CSSProperties } from "react";

const COUNT = 10;

// Random speed, length, start and delay on every page load. This server component renders once per
// request and never on the client, so the random values cannot cause a hydration mismatch. Decorative.
function randomTracers() {
  return Array.from({ length: COUNT }, () => ({
    x: `${Math.round(-35 + Math.random() * 95)}%`,
    len: Math.round(180 + Math.random() * 360),
    dur: (2 + Math.random() * 4.5).toFixed(2),
    delay: (Math.random() * 7).toFixed(2),
    o: (0.3 + Math.random() * 0.4).toFixed(2),
  }));
}

export function HeroTracers({ tracers = randomTracers() }: { tracers?: ReturnType<typeof randomTracers> }) {
  return (
    <div className="tracers" aria-hidden="true">
      {tracers.map((t, i) => (
        <span
          key={i}
          className="tracer"
          style={{ "--x": t.x, "--len": `${t.len}px`, "--dur": `${t.dur}s`, "--delay": `${t.delay}s`, "--o": t.o } as CSSProperties}
        />
      ))}
    </div>
  );
}
