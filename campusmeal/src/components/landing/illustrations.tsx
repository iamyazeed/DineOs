/* Flat line illustrations for the public landing page.
   Colours come from CSS classes in globals.css (.il-*) so they follow light/dark. */
import type { ReactNode } from "react";

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 240 160" role="img" aria-label={label} className="il">
      <rect className="il-bg" x="0" y="0" width="240" height="160" />
      <circle className="il-blob" cx="190" cy="34" r="46" />
      <path className="il-ground" d="M20 138 H220" />
      {children}
    </svg>
  );
}

const Check = ({ x, y }: { x: number; y: number }) => (
  <g>
    <circle className="il-lime il-s" cx={x} cy={y} r="14" />
    <path className="il-s" d={`M${x - 6} ${y} l4 4 l8 -8`} />
  </g>
);

/** Phone with today's menu and a "cancel meal" toggle. */
export function PhoneMenu() {
  return (
    <Frame label="Phone showing today's menu with a cancel-meal switch">
      <rect className="il-paper il-s" x="86" y="22" width="68" height="116" rx="10" />
      <path className="il-s" d="M110 30 H130" />
      <rect className="il-soft" x="94" y="40" width="52" height="30" rx="5" />
      <path className="il-s" d="M104 60 a16 10 0 0 1 32 0 Z M102 60 H138" />
      <path className="il-faint" d="M96 80 H142 M96 88 H130" />
      <rect className="il-ink-fill" x="96" y="102" width="48" height="18" rx="9" />
      <circle className="il-lime" cx="135" cy="111" r="6" />
      <Check x={158} y={62} />
    </Frame>
  );
}

/** Clipboard: class attendance sheet with ticks. */
export function Clipboard() {
  return (
    <Frame label="Clipboard with an attendance list being ticked off">
      <rect className="il-paper il-s" x="80" y="26" width="80" height="108" rx="8" />
      <rect className="il-lime il-s" x="102" y="20" width="36" height="12" rx="4" />
      {[50, 72, 94].map((y, i) => (
        <g key={y}>
          {i < 2 ? <path className="il-s" d={`M90 ${y} l4 4 l7 -8`} /> : <rect className="il-s" x="90" y={y - 6} width="10" height="10" rx="2" />}
          <path className="il-faint" d={`M108 ${y} H148`} />
        </g>
      ))}
      <path className="il-faint" d="M90 116 H148" />
      <circle className="il-ink-fill" cx="156" cy="118" r="15" />
      <path className="il-s-light" d="M149 118 l5 5 l9 -10" />
    </Frame>
  );
}

/** Kitchen pot with steam and a count tag. */
export function KitchenPot() {
  return (
    <Frame label="Cooking pot with a tag showing the exact portion count">
      <path className="il-s" d="M104 36 q-6 -8 0 -16 M120 36 q-6 -8 0 -16 M136 36 q-6 -8 0 -16" />
      <rect className="il-ink-fill" x="88" y="46" width="64" height="8" rx="4" />
      <path className="il-paper il-s" d="M84 58 H156 V112 a12 12 0 0 1 -12 12 H96 a12 12 0 0 1 -12 -12 Z" />
      <path className="il-s" d="M84 70 H72 M156 70 H168" />
      <rect className="il-soft" x="96" y="80" width="48" height="24" rx="6" />
      <rect className="il-lime il-s" x="160" y="86" width="42" height="24" rx="6" />
      <text className="il-num" x="181" y="102" textAnchor="middle">212</text>
    </Frame>
  );
}

/** Dining table seen from above, seats and a lime "supplier" seat. */
export function DiningTable() {
  const seats = [70, 98, 126, 154];
  return (
    <Frame label="Dining table A1 with seats, one marked as the table supplier">
      <rect className="il-paper il-s" x="62" y="62" width="116" height="40" rx="8" />
      <text className="il-num" x="120" y="88" textAnchor="middle">A1</text>
      {seats.map((x, i) => (
        <g key={x}>
          <circle className={i === 0 ? "il-lime il-s" : "il-soft il-s"} cx={x + 8} cy="46" r="9" />
          <circle className="il-soft il-s" cx={x + 8} cy="118" r="9" />
        </g>
      ))}
      <Check x={186} y={46} />
    </Frame>
  );
}

/** Delivery cart moving to a pin. */
export function DeliveryCart() {
  return (
    <Frame label="Food trolley being delivered to a table">
      <path className="il-faint" d="M40 92 H58 M34 104 H56" />
      <rect className="il-paper il-s" x="66" y="70" width="80" height="46" rx="6" />
      <path className="il-s" d="M76 82 H136 M76 94 H120" />
      <path className="il-s" d="M146 82 H168 l10 14 V116 H146 Z" />
      <rect className="il-lime" x="150" y="86" width="16" height="10" rx="2" />
      <circle className="il-ink-fill" cx="88" cy="122" r="9" />
      <circle className="il-ink-fill" cx="160" cy="122" r="9" />
      <path className="il-ink-fill" d="M190 22 a12 12 0 0 1 12 12 c0 10 -12 22 -12 22 s-12 -12 -12 -22 a12 12 0 0 1 12 -12 Z" />
      <circle className="il-paper" cx="190" cy="34" r="4" />
    </Frame>
  );
}

/** Bar chart on a dashboard card. */
export function Dashboard() {
  const bars = [44, 62, 38, 70, 54];
  return (
    <Frame label="Dashboard card with a bar chart of meals served">
      <rect className="il-paper il-s" x="60" y="28" width="120" height="100" rx="10" />
      <path className="il-faint" d="M74 44 H120" />
      {bars.map((h, i) => (
        <rect key={i} className={i === 3 ? "il-lime il-s" : "il-soft il-s"} x={76 + i * 20} y={116 - h} width="12" height={h} rx="3" />
      ))}
      <path className="il-faint" d="M70 116 H172" />
    </Frame>
  );
}

/** Large hero scene: phone, pot and table together. */
export function HeroScene() {
  return (
    <svg viewBox="0 0 480 360" role="img" aria-label="A student's phone cancels a meal, the kitchen cooks the exact count, and the table is served" className="il il-hero">
      <circle className="il-blob" cx="320" cy="120" r="120" />
      <circle className="il-blob" cx="110" cy="270" r="70" />
      <path className="il-ground" d="M30 318 H450" />
      {/* phone */}
      <rect className="il-paper il-s" x="56" y="60" width="120" height="210" rx="18" />
      <path className="il-s" d="M98 76 H134" />
      <rect className="il-soft" x="72" y="96" width="88" height="54" rx="8" />
      <path className="il-s" d="M90 134 a26 16 0 0 1 52 0 Z M86 134 H146" />
      <path className="il-faint" d="M74 168 H158 M74 182 H138" />
      <rect className="il-ink-fill" x="74" y="210" width="84" height="32" rx="16" />
      <circle className="il-lime" cx="142" cy="226" r="11" />
      {/* arrow */}
      <path className="il-s il-dash" d="M190 160 C 220 130, 240 130, 262 150" />
      <path className="il-s" d="M254 140 l10 10 l-12 6" />
      {/* pot */}
      <path className="il-s" d="M300 90 q-8 -12 0 -24 M324 90 q-8 -12 0 -24 M348 90 q-8 -12 0 -24" />
      <rect className="il-ink-fill" x="276" y="100" width="96" height="12" rx="6" />
      <path className="il-paper il-s" d="M270 118 H378 V196 a16 16 0 0 1 -16 16 H286 a16 16 0 0 1 -16 -16 Z" />
      <path className="il-s" d="M270 136 H254 M378 136 H394" />
      <rect className="il-lime il-s" x="300" y="146" width="48" height="30" rx="7" />
      <text className="il-num" x="324" y="167" textAnchor="middle">212</text>
      {/* table */}
      <rect className="il-paper il-s" x="232" y="256" width="180" height="40" rx="9" />
      <text className="il-num" x="322" y="282" textAnchor="middle">A1 · 10 seats</text>
      {[250, 290, 330, 370].map((x, i) => (
        <circle key={x} className={i === 1 ? "il-lime il-s" : "il-soft il-s"} cx={x + 12} cy="240" r="10" />
      ))}
      <g>
        <circle className="il-lime il-s" cx="186" cy="88" r="20" />
        <path className="il-s" d="M177 88 l6 6 l12 -12" />
      </g>
    </svg>
  );
}
