"use client"

// Piezas compartidas por las pantallas de celebración ("Fin de la partida" y
// "Cierre de torneo"): overlay a pantalla completa, podio con revelación
// 3°→2°→1°, y pie con botón para compartir la imagen.

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { RotateCcw, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChipSpinner, PokerChip } from "@/components/poker-chip"
import { useCountUp } from "@/hooks/use-count-up"
import { formatAmount } from "@/lib/formatters"
import { shareImage } from "@/lib/share-card"
import { playSequence, type SoundName } from "@/lib/sounds"

/** Línea de tiempo de la revelación del podio (ms desde que se abre). */
export const REVEAL = {
  third: 300,
  second: 1000,
  first: 1700,
  rain: 2050,
}

const PODIUM = [
  { body: "#eab308", edge: "#fefce8", block: "h-28 bg-yellow-500/25 border-yellow-500", text: "text-yellow-500", delay: REVEAL.first },
  { body: "#94a3b8", edge: "#f8fafc", block: "h-20 bg-slate-400/20 border-slate-400", text: "text-slate-400", delay: REVEAL.second },
  { body: "#f97316", edge: "#fff7ed", block: "h-14 bg-orange-500/20 border-orange-500", text: "text-orange-500", delay: REVEAL.third },
]

export function signedMoney(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${formatAmount(Math.abs(n))}`
}

export interface PodiumPlayer {
  name: string
  position: number
  moneyWon: number
  points: number
}

function PodiumSpot({
  player,
  place,
  showPoints,
}: {
  player: PodiumPlayer
  place: 0 | 1 | 2
  showPoints: boolean
}) {
  const style = PODIUM[place]
  const money = useCountUp(player.moneyWon, { delayMs: style.delay + 250, durationMs: 1100 })
  return (
    <div className="flex w-1/3 flex-col items-center justify-end">
      <div className="reveal-up flex flex-col items-center gap-1 pb-2" style={{ animationDelay: `${style.delay}ms` }}>
        <PokerChip
          className={place === 0 ? "winner-glow h-14 w-14" : "h-10 w-10"}
          body={style.body}
          edge={style.edge}
          suit={place === 0 ? "♠" : place === 1 ? "♥" : "♦"}
        />
        <div className={`max-w-full truncate px-1 text-center font-bold ${place === 0 ? "text-lg" : "text-sm"}`}>
          {player.name}
        </div>
        <div
          className={`font-semibold tabular-nums ${place === 0 ? "text-base" : "text-xs"} ${
            player.moneyWon >= 0 ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {signedMoney(money)}
        </div>
        {showPoints && (
          <div className="text-[11px] text-muted-foreground">{player.points} pts</div>
        )}
      </div>
      <div
        className={`podium-rise flex w-full items-start justify-center rounded-t-xl border-2 border-b-0 pt-2 ${style.block}`}
        style={{ animationDelay: `${style.delay - 150}ms` }}
      >
        <span className={`text-2xl font-black ${style.text}`}>{player.position}°</span>
      </div>
    </div>
  )
}

/** Podio 2° · 1° · 3° que se revela de abajo hacia arriba. */
export function AnimatedPodium({
  top3,
  jingle,
  showPoints = true,
}: {
  top3: PodiumPlayer[]
  jingle: SoundName
  /** false en sueltas: no reparten puntos. */
  showPoints?: boolean
}) {
  const count = top3.length
  // Una pila de fichas por puesto y la música al revelar el 1°. Al repetir la
  // animación se re-monta y vuelve a sonar; al cerrar se corta.
  useEffect(() => {
    if (count === 0) return
    return playSequence([
      ...(count > 2 ? [{ name: "chipsStack" as const, at: REVEAL.third / 1000 }] : []),
      ...(count > 1 ? [{ name: "chipsStack" as const, at: REVEAL.second / 1000 }] : []),
      { name: "chipsPush", at: REVEAL.first / 1000 },
      { name: jingle, at: REVEAL.first / 1000 + 0.1 },
    ])
  }, [count, jingle])

  return (
    <>
      <div className="flex items-end gap-2">
        {top3[1] && <PodiumSpot player={top3[1]} place={1} showPoints={showPoints} />}
        {top3[0] && <PodiumSpot player={top3[0]} place={0} showPoints={showPoints} />}
        {top3[2] && <PodiumSpot player={top3[2]} place={2} showPoints={showPoints} />}
      </div>
      <div className="h-1 rounded-full bg-border" />
    </>
  )
}

export function CelebrationHeader({
  title,
  subtitle,
  onReplay,
  onClose,
}: {
  title: string
  subtitle: string
  onReplay: () => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <Button variant="ghost" size="icon" onClick={onReplay} aria-label="Repetir animación">
        <RotateCcw className="h-5 w-5" />
      </Button>
      <div className="min-w-0 text-center">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
        <X className="h-5 w-5" />
      </Button>
    </div>
  )
}

/**
 * Pie fijo con "Compartir" y "Listo". La imagen se genera de antemano: en
 * iOS, navigator.share tiene que llamarse inmediatamente después del toque,
 * sin esperas en el medio.
 */
export function ShareFooter({
  makeImage,
  filename,
  text,
  onClose,
}: {
  makeImage: () => Promise<Blob>
  filename: string
  text: string
  onClose: () => void
}) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    makeImage()
      .then((b) => !cancelled && setBlob(b))
      .catch(() => !cancelled && setBlob(null))
    return () => {
      cancelled = true
    }
  }, [makeImage])

  const handleShare = async () => {
    if (!blob) return
    const res = await shareImage(blob, filename, text)
    setMsg(res === "downloaded" ? "Imagen descargada" : null)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 border-t bg-background/90 backdrop-blur-sm pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
      <div className="container mx-auto flex max-w-lg gap-3 px-4">
        <Button variant="outline" className="h-12 flex-1" onClick={handleShare} disabled={!blob}>
          {blob ? <Share2 className="mr-2 h-4 w-4" /> : <ChipSpinner className="mr-2 h-4 w-4" />}
          {msg ?? "Compartir"}
        </Button>
        <Button className="h-12 flex-1" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  )
}

/**
 * Overlay a pantalla completa: bloquea el scroll de fondo, cierra con Escape
 * y permite repetir la animación (re-monta el contenido).
 *
 * Se renderiza en un portal sobre <body>: si queda dentro del carrusel de
 * pestañas, el transform de Embla hace que `position: fixed` se ubique
 * relativo a la tira del carrusel y el overlay queda fuera de pantalla (le
 * pasaba al podio de torneo, que vive dentro de la pestaña Reglas).
 */
export function CelebrationOverlay({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: (onReplay: () => void) => React.ReactNode
}) {
  const [replayKey, setReplayKey] = useState(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  if (!mounted) return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="animate-fade-in fixed inset-0 z-[100] overflow-y-auto bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/25 blur-3xl"
      />
      <div key={replayKey} className="relative">
        {children(() => setReplayKey((k) => k + 1))}
      </div>
    </div>,
    document.body,
  )
}
