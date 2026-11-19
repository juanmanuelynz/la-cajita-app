// Genera la imagen para compartir (WhatsApp, etc.) del resumen de partida y
// del cierre de torneo. Se dibuja directo en un <canvas> del navegador: sin
// dependencias, sin servidor y funciona offline. Solo se usa en el cliente.
//
// Diseño (1080x1350, 4:5 como las fotos de WhatsApp): encabezado, podio de
// verdad (2° · 1° · 3°) con fichas y el ganador destacado, el resto de los
// jugadores en filas compactas y los datos destacados como tarjetas.

import type { Highlight, SummaryPlayer } from "./match-summary"

export interface ShareCardData {
  title: string
  subtitle: string
  players: SummaryPlayer[]
  highlights: Highlight[]
  formatMoney: (n: number) => string
}

const W = 1080
const H = 1350
const PAD = 70

const PLACES = [
  { body: "#eab308", edge: "#fefce8", block: ["#facc15", "#a16207"], text: "#422006", height: 220 },
  { body: "#94a3b8", edge: "#f8fafc", block: ["#cbd5e1", "#64748b"], text: "#0f172a", height: 165 },
  { body: "#f97316", edge: "#fff7ed", block: ["#fb923c", "#9a3412"], text: "#431407", height: 125 },
]
const PODIUM_BASE = 800
const BLOCK_W = 280
const BLOCK_GAP = 20

type Ctx = CanvasRenderingContext2D

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function roundRectTop(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
}

function drawChip(ctx: Ctx, cx: number, cy: number, r: number, body: string, edge = "#ffffff", alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = edge
  for (let i = 0; i < 8; i++) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((i * Math.PI) / 4)
    ctx.fillRect(-r * 0.12, -r, r * 0.24, r * 0.3)
    ctx.restore()
  }
  ctx.fillStyle = "rgba(0,0,0,0.18)"
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.64, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = Math.max(2, r * 0.05)
  ctx.setLineDash([r * 0.12, r * 0.1])
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

function signed(n: number, fmt: (n: number) => string) {
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${fmt(Math.abs(n))}`
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas no disponible")

  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`
  const money = (n: number) => signed(n, data.formatMoney)

  // ── Fondo: paño verde con viñeta y fichas decorativas ───────────────────
  const bg = ctx.createRadialGradient(W / 2, H * 0.38, 80, W / 2, H * 0.5, H * 0.85)
  bg.addColorStop(0, "#065f46")
  bg.addColorStop(0.5, "#022c22")
  bg.addColorStop(1, "#070b0a")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  drawChip(ctx, 40, 60, 130, "#e11d48", "#fff1f2", 0.16)
  drawChip(ctx, W - 20, 330, 95, "#2563eb", "#eff6ff", 0.14)
  drawChip(ctx, 30, H - 210, 90, "#eab308", "#fefce8", 0.12)
  drawChip(ctx, W - 60, H - 90, 140, "#10b981", "#ecfdf5", 0.14)

  // ── Encabezado ─────────────────────────────────────────────────────────
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#ecfdf5"
  ctx.font = font(900, 78)
  ctx.fillText("La Cajita", W / 2, 120)
  ctx.font = font(700, 38)
  ctx.fillStyle = "#f8fafc"
  ctx.fillText("♠", W / 2 - 250, 116)
  ctx.fillText("♣", W / 2 + 250, 116)
  ctx.fillStyle = "#f43f5e"
  ctx.fillText("♥", W / 2 - 205, 116)
  ctx.fillText("♦", W / 2 + 205, 116)
  ctx.font = font(500, 32)
  ctx.fillStyle = "rgba(236,253,245,0.7)"
  ctx.fillText(fitText(ctx, data.subtitle, W - 2 * PAD), W / 2, 172)
  ctx.font = font(800, 30)
  const pillW = Math.min(W - 2 * PAD, ctx.measureText(data.title.toUpperCase()).width + 70)
  roundRect(ctx, W / 2 - pillW / 2, 200, pillW, 56, 28)
  ctx.fillStyle = "rgba(16,185,129,0.22)"
  ctx.fill()
  ctx.strokeStyle = "rgba(110,231,183,0.6)"
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = "#6ee7b7"
  ctx.fillText(data.title.toUpperCase(), W / 2, 239)

  // ── Podio 2° · 1° · 3° ────────────────────────────────────────────────
  const podiumLeft = (W - (BLOCK_W * 3 + BLOCK_GAP * 2)) / 2
  const order: [number, number][] = [
    [1, podiumLeft],
    [0, podiumLeft + BLOCK_W + BLOCK_GAP],
    [2, podiumLeft + 2 * (BLOCK_W + BLOCK_GAP)],
  ]
  roundRect(ctx, podiumLeft - 24, PODIUM_BASE - 4, BLOCK_W * 3 + BLOCK_GAP * 2 + 48, 18, 9)
  ctx.fillStyle = "rgba(255,255,255,0.16)"
  ctx.fill()
  for (const [place, x] of order) {
    const p = data.players[place]
    if (!p) continue
    const style = PLACES[place]
    const top = PODIUM_BASE - style.height
    const cx = x + BLOCK_W / 2
    const winner = place === 0

    // Bloque con degradado metálico y número grande.
    const grad = ctx.createLinearGradient(0, top, 0, PODIUM_BASE)
    grad.addColorStop(0, style.block[0])
    grad.addColorStop(1, style.block[1])
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.45)"
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
    roundRectTop(ctx, x, top, BLOCK_W, style.height, 22)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = style.text
    ctx.textAlign = "center"
    ctx.font = font(900, winner ? 96 : 76)
    ctx.fillText(`${place + 1}°`, cx, top + (winner ? 120 : 98))

    // Encima del bloque: puntos, plata, nombre, ficha (y corona al ganador).
    ctx.font = font(600, 28)
    ctx.fillStyle = "rgba(236,253,245,0.7)"
    ctx.fillText(`${p.points} pts`, cx, top - 22)
    ctx.font = font(800, winner ? 44 : 36)
    ctx.fillStyle = p.moneyWon >= 0 ? "#34d399" : "#fb7185"
    ctx.fillText(money(p.moneyWon), cx, top - 62)
    ctx.font = font(800, winner ? 48 : 38)
    ctx.fillStyle = "#f8fafc"
    ctx.fillText(fitText(ctx, p.name, BLOCK_W + 10), cx, top - (winner ? 118 : 108))
    const chipR = winner ? 54 : 40
    const chipY = top - (winner ? 210 : 180)
    if (winner) {
      ctx.save()
      ctx.shadowColor = "rgba(234,179,8,0.9)"
      ctx.shadowBlur = 50
      drawChip(ctx, cx, chipY, chipR, style.body, style.edge)
      ctx.restore()
      ctx.font = font(400, 64)
      ctx.fillStyle = "#ffffff"
      ctx.fillText("👑", cx, chipY - chipR - 14)
    } else {
      drawChip(ctx, cx, chipY, chipR, style.body, style.edge)
    }
  }
  // ── Resto de los jugadores ─────────────────────────────────────────────
  let y = PODIUM_BASE + 46
  const rowH = 62
  const rest = data.players.slice(3)
  for (const p of rest) {
    roundRect(ctx, PAD, y, W - 2 * PAD, rowH, 18)
    ctx.fillStyle = "rgba(255,255,255,0.07)"
    ctx.fill()
    const cy = y + rowH / 2
    ctx.textBaseline = "middle"
    ctx.fillStyle = "rgba(255,255,255,0.16)"
    ctx.beginPath()
    ctx.arc(PAD + 40, cy, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#ecfdf5"
    ctx.textAlign = "center"
    ctx.font = font(800, 26)
    ctx.fillText(String(p.position), PAD + 40, cy + 1)
    ctx.textAlign = "left"
    ctx.font = font(600, 32)
    ctx.fillStyle = "#f8fafc"
    ctx.fillText(fitText(ctx, p.name, 470), PAD + 82, cy + 1)
    ctx.textAlign = "right"
    ctx.font = font(800, 32)
    ctx.fillStyle = p.moneyWon >= 0 ? "#34d399" : "#fb7185"
    ctx.fillText(money(p.moneyWon), W - PAD - 130, cy + 1)
    ctx.font = font(600, 26)
    ctx.fillStyle = "rgba(236,253,245,0.6)"
    ctx.fillText(`${p.points} pts`, W - PAD - 24, cy + 1)
    ctx.textBaseline = "alphabetic"
    y += rowH + 10
  }

  // ── Destacados: tantas tarjetas como entren ────────────────────────────
  y += rest.length ? 14 : 0
  const cardH = 66
  const footerY = H - 36
  for (const h of data.highlights) {
    if (y + cardH > footerY - 24) break
    roundRect(ctx, PAD, y, W - 2 * PAD, cardH, 20)
    ctx.fillStyle = "rgba(16,185,129,0.14)"
    ctx.fill()
    ctx.strokeStyle = "rgba(110,231,183,0.35)"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.textBaseline = "middle"
    ctx.textAlign = "left"
    ctx.font = font(400, 36)
    ctx.fillStyle = "#ffffff"
    ctx.fillText(h.emoji, PAD + 24, y + cardH / 2 + 2)
    ctx.font = font(600, 30)
    ctx.fillStyle = "#ecfdf5"
    ctx.fillText(fitText(ctx, h.text, W - 2 * PAD - 110), PAD + 84, y + cardH / 2 + 1)
    ctx.textBaseline = "alphabetic"
    y += cardH + 12
  }

  // ── Pie ────────────────────────────────────────────────────────────────
  ctx.textAlign = "center"
  ctx.font = font(600, 24)
  ctx.fillStyle = "rgba(236,253,245,0.35)"
  ctx.fillText("La Cajita Poker", W / 2, footerY)

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/png")
  })
}

/**
 * Comparte la imagen con el menú nativo (WhatsApp incluido). Si el navegador
 * no soporta compartir archivos, la descarga.
 */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" })
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return "shared"
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled"
      // Otro error (p. ej. sin gesto de usuario): caemos a descarga.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return "downloaded"
}
