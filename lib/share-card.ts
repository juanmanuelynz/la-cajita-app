// Genera la imagen del resumen de partida para compartir (WhatsApp, etc.).
// Se dibuja directo en un <canvas> del navegador: sin dependencias, sin
// servidor y funciona offline. Solo se usa del lado del cliente.

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
const MEDAL = ["#eab308", "#94a3b8", "#f97316"]

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawChip(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, body: string, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "rgba(255,255,255,0.9)"
  for (let i = 0; i < 8; i++) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((i * Math.PI) / 4)
    ctx.fillRect(-r * 0.12, -r, r * 0.24, r * 0.3)
    ctx.restore()
  }
  ctx.strokeStyle = "rgba(255,255,255,0.85)"
  ctx.lineWidth = r * 0.05
  ctx.setLineDash([r * 0.12, r * 0.1])
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas no disponible")

  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`

  // Fondo: paño verde oscuro con viñeta.
  const bg = ctx.createRadialGradient(W / 2, H * 0.3, 100, W / 2, H * 0.5, H * 0.85)
  bg.addColorStop(0, "#064e3b")
  bg.addColorStop(0.55, "#022c22")
  bg.addColorStop(1, "#0b0f0e")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Fichas decorativas en las esquinas.
  drawChip(ctx, 70, 90, 120, "#e11d48", 0.25)
  drawChip(ctx, W - 40, 250, 90, "#2563eb", 0.2)
  drawChip(ctx, 60, H - 120, 80, "#eab308", 0.18)
  drawChip(ctx, W - 90, H - 60, 130, "#10b981", 0.22)

  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#ecfdf5"
  ctx.font = font(800, 76)
  ctx.fillText("♠ ♥  La Cajita  ♦ ♣", W / 2, 150)
  ctx.font = font(500, 36)
  ctx.fillStyle = "rgba(236,253,245,0.7)"
  ctx.fillText(fitText(ctx, data.subtitle, W - 160), W / 2, 210)
  ctx.font = font(700, 44)
  ctx.fillStyle = "#6ee7b7"
  ctx.fillText(data.title, W / 2, 290)

  // Tabla de resultados.
  const many = data.players.length > 6
  const rowH = many ? 80 : 92
  const gap = many ? 12 : 14
  const top = 340
  const left = 80
  const width = W - 160
  data.players.forEach((p, i) => {
    const y = top + i * (rowH + gap)
    roundRect(ctx, left, y, width, rowH, 24)
    ctx.fillStyle = i === 0 ? "rgba(234,179,8,0.16)" : "rgba(255,255,255,0.06)"
    ctx.fill()
    if (i === 0) {
      ctx.strokeStyle = "rgba(234,179,8,0.7)"
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // Medalla / posición
    const cx = left + 56
    const cy = y + rowH / 2
    ctx.fillStyle = MEDAL[i] ?? "rgba(255,255,255,0.18)"
    ctx.beginPath()
    ctx.arc(cx, cy, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = i < 3 ? "#0b0f0e" : "#ecfdf5"
    ctx.font = font(800, 32)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(p.position), cx, cy + 2)

    // Nombre
    ctx.textAlign = "left"
    ctx.fillStyle = "#f8fafc"
    ctx.font = font(i === 0 ? 800 : 600, 40)
    ctx.fillText(fitText(ctx, `${i === 0 ? "🏆 " : ""}${p.name}`, 430), left + 110, cy + 2)

    // Plata y puntos
    ctx.textAlign = "right"
    ctx.fillStyle = p.moneyWon >= 0 ? "#34d399" : "#fb7185"
    ctx.font = font(800, 40)
    const sign = p.moneyWon > 0 ? "+" : p.moneyWon < 0 ? "-" : ""
    ctx.fillText(`${sign}$${data.formatMoney(Math.abs(p.moneyWon))}`, left + width - 150, cy + 2)
    ctx.fillStyle = "rgba(236,253,245,0.65)"
    ctx.font = font(600, 30)
    ctx.fillText(`${p.points} pts`, left + width - 30, cy + 2)
  })
  ctx.textBaseline = "alphabetic"

  // Destacados
  let y = top + data.players.length * (rowH + gap) + 50
  ctx.textAlign = "left"
  for (const h of data.highlights.slice(0, 3)) {
    if (y > H - 80) break
    ctx.font = font(600, 34)
    ctx.fillStyle = "#ecfdf5"
    ctx.fillText(fitText(ctx, `${h.emoji}  ${h.text}`, width), left, y)
    y += 56
  }

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
