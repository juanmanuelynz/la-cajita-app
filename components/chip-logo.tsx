// La ficha de La Cajita con la hojita al centro: la del ícono de la app (ver
// public/favicon.svg) y la del splash. SVG sin ids, se puede repetir.

import { LeafPaths, leafTransform } from "@/components/leaf-mark"

const INSERTS = [0, 45, 90, 135, 180, 225, 270, 315]

export function ChipLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 320" className={className} aria-hidden>
      <circle cx="160" cy="169" r="150" fill="rgba(0,0,0,.35)" />
      <circle cx="160" cy="160" r="150" fill="#f4ecd8" />
      {INSERTS.map((a) => (
        <rect key={a} x="140.5" y="10" width="39" height="30" rx="4.5" fill="#0b7a55" transform={`rotate(${a} 160 160)`} />
      ))}
      <circle cx="160" cy="160" r="111" fill="#fbf6ea" />
      <circle cx="160" cy="160" r="102" fill="none" stroke="#c9a24a" strokeWidth="5" strokeDasharray="18 9" />
      <g transform={leafTransform(160, 162, 150)} fill="#0b7a55">
        <LeafPaths />
      </g>
    </svg>
  )
}
