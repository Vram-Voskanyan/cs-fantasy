// Original decorative artwork for the home hero: a tactical radar with a sweeping beam.
// Not based on any game asset. Colors come from the design tokens.

const BLIPS = [
  { x: 262, y: 148, d: 0 },
  { x: 318, y: 236, d: 1.2 },
  { x: 176, y: 262, d: 2.1 },
  { x: 228, y: 318, d: 3.0 },
  { x: 140, y: 170, d: 4.4 },
];

export function HeroArt() {
  return (
    <svg viewBox="0 0 440 440" className="hero-art h-auto w-full" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--surface-2)" />
          <stop offset="100%" stopColor="var(--bg)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--fg)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--fg)" stopOpacity="0.22" />
        </linearGradient>
        <clipPath id="hero-scope">
          <circle cx="220" cy="220" r="170" />
        </clipPath>
      </defs>

      <circle cx="220" cy="220" r="210" fill="url(#hero-glow)" />

      {/* HUD frame with cut corners */}
      <path d="M40 20 H400 L420 40 V400 L400 420 H40 L20 400 V40 Z" fill="none" stroke="var(--border-strong)" />
      <path d="M20 70 V40 L40 20 H70 M370 20 H400 L420 40 V70 M420 370 V400 L400 420 H370 M70 420 H40 L20 400 V370" fill="none" stroke="var(--primary)" strokeWidth="2" />

      <g clipPath="url(#hero-scope)">
        {/* grid */}
        {Array.from({ length: 11 }, (_, i) => 50 + i * 34).map((v) => (
          <g key={v} stroke="var(--border)" strokeWidth="1">
            <line x1={v} y1="40" x2={v} y2="400" />
            <line x1="40" y1={v} x2="400" y2={v} />
          </g>
        ))}
        {/* abstract site outlines */}
        <path d="M110 120 h70 v40 h40 v-30 h60 v80 h-50 v50 h-80 v-60 h-40 Z" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" />
        <path d="M250 270 h80 v30 h-30 v40 h-70 v-30 h20 Z" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" />
        {/* sweep */}
        <g className="hero-sweep">
          <path d="M220 220 L390 220 A170 170 0 0 0 340 100 Z" fill="url(#hero-sweep)" />
          <line x1="220" y1="220" x2="390" y2="220" stroke="var(--fg)" strokeOpacity="0.6" strokeWidth="1.5" />
        </g>
        {BLIPS.map((b) => (
          <g key={`${b.x}-${b.y}`}>
            <circle cx={b.x} cy={b.y} r="10" fill="var(--primary)" className="hero-blip-ring" style={{ animationDelay: `${b.d}s` }} />
            <circle cx={b.x} cy={b.y} r="4" fill="var(--primary)" />
          </g>
        ))}
      </g>

      {/* scope rings and crosshair */}
      {[170, 120, 70].map((r) => (
        <circle key={r} cx="220" cy="220" r={r} fill="none" stroke="var(--border-strong)" strokeDasharray={r === 170 ? undefined : "2 6"} />
      ))}
      <g stroke="var(--fg-muted)" strokeWidth="1.5">
        <line x1="220" y1="36" x2="220" y2="76" />
        <line x1="220" y1="364" x2="220" y2="404" />
        <line x1="36" y1="220" x2="76" y2="220" />
        <line x1="364" y1="220" x2="404" y2="220" />
      </g>
      {Array.from({ length: 36 }, (_, i) => i * 10).map((deg) => (
        <line
          key={deg}
          x1="220"
          y1={deg % 30 === 0 ? 44 : 48}
          x2="220"
          y2="54"
          stroke="var(--fg-subtle)"
          strokeWidth={deg % 30 === 0 ? 1.5 : 1}
          transform={`rotate(${deg} 220 220)`}
        />
      ))}
      <circle cx="220" cy="220" r="3" fill="var(--fg)" />
    </svg>
  );
}
