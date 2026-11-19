// Efectos de sonido de la app. Los archivos están en /public/sounds (pack
// "Casino/RPG/Jingle sounds" de Kenney, licencia CC0; ver CREDITS.txt).
//
// Se usa Web Audio en vez de <audio>: menos latencia, sonidos superpuestos y
// control de volumen en iOS. Los navegadores no dejan reproducir audio hasta
// que el usuario toca algo, así que el AudioContext se crea y "despierta" en el
// primer toque/tecla. Si todavía no despertó, play() no hace nada (no encola:
// un sonido que llega tarde queda peor que ninguno).

export const SOUNDS = {
  /** Ficha que se apoya: +1 cajita. */
  chipLay: { files: ["chip-lay-1", "chip-lay-2", "chip-lay-3"], volume: 0.6 },
  /** Fichas que chocan: −1 cajita y lluvia de fichas. */
  chipsCollide: { files: ["chips-collide-1", "chips-collide-2", "chips-collide-3", "chips-collide-4"], volume: 0.5 },
  /** Pila de fichas: 3° y 2° puesto del podio. */
  chipsStack: { files: ["chips-stack-1", "chips-stack-2", "chips-stack-3", "chips-stack-4"], volume: 0.8 },
  /** Puñado de fichas: las que saltan del maletín. */
  chipsBurst: { files: ["chips-handle-1"], volume: 0.8 },
  /** Empujar las fichas al centro: registrar la partida y 1° puesto. */
  chipsPush: { files: ["chips-handle-5"], volume: 0.9 },
  /** Mazo mezclándose: crear partida nueva. */
  cardShuffle: { files: ["card-shuffle"], volume: 0.7 },
  /** Trabas del maletín. */
  latch: { files: ["metal-latch"], volume: 0.8 },
  latchClick: { files: ["metal-click"], volume: 0.6 },
  /** Golpe apagado: PIN incorrecto. */
  error: { files: ["drop-leather"], volume: 0.7 },
  jingleMatch: { files: ["jingle-match"], volume: 0.6 },
  jingleTournament: { files: ["jingle-tournament"], volume: 0.6 },
} as const satisfies Record<string, { files: readonly string[]; volume: number }>

export type SoundName = keyof typeof SOUNDS

export function soundUrl(file: string) {
  return `/sounds/${file}.mp3`
}

// ---------------------------------------------------------------------------
// Preferencia de silencio (por dispositivo)

const STORAGE_KEY = "la_cajita_sound"
const listeners = new Set<() => void>()
let enabledCache: boolean | null = null

export function isSoundEnabled(): boolean {
  if (enabledCache !== null) return enabledCache
  try {
    enabledCache = localStorage.getItem(STORAGE_KEY) !== "off"
  } catch {
    enabledCache = true
  }
  return enabledCache
}

export function setSoundEnabled(on: boolean) {
  enabledCache = on
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off")
  } catch {
    // modo privado o storage bloqueado: queda en memoria
  }
  listeners.forEach((l) => l())
  if (on && ctx) preloadAll()
}

export function subscribeSoundEnabled(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ---------------------------------------------------------------------------
// Motor

let ctx: AudioContext | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()

function getContext(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === "undefined") return null
  const AC =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  return ctx
}

function load(file: string): Promise<AudioBuffer | null> {
  let p = buffers.get(file)
  if (!p) {
    const c = getContext()
    if (!c) return Promise.resolve(null)
    p = fetch(soundUrl(file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => c.decodeAudioData(data))
      .catch(() => {
        buffers.delete(file) // reintenta la próxima vez (p. ej. volvió la conexión)
        return null
      })
    buffers.set(file, p)
  }
  return p
}

function preloadAll() {
  for (const s of Object.values(SOUNDS)) for (const f of s.files) void load(f)
}

function unlock() {
  const c = getContext()
  if (!c) return
  // iOS 16.4+: "ambient" respeta el botón de silencio y no corta la música
  // que esté sonando en el teléfono.
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (nav.audioSession) {
    try {
      nav.audioSession.type = "ambient"
    } catch {
      // no soportado
    }
  }
  if (c.state !== "running") void c.resume()
  if (isSoundEnabled()) preloadAll()
}

const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const
if (typeof window !== "undefined") {
  const onGesture = () => {
    unlock()
    if (ctx?.state === "running") UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, onGesture, true))
  }
  UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, onGesture, true))
}

export interface PlayOptions {
  /** Segundos de espera antes de sonar. */
  delay?: number
  /** Multiplica el volumen base del sonido. */
  volume?: number
}

/**
 * Reproduce un sonido (una variante al azar si tiene varias). Devuelve una
 * función que lo corta con un fade corto; sirve para limpiar en un useEffect
 * los sonidos programados con `delay` si el componente se desmonta.
 */
export function playSound(name: SoundName, { delay = 0, volume = 1 }: PlayOptions = {}): () => void {
  const noop = () => {}
  if (!isSoundEnabled()) return noop
  const c = ctx
  if (!c || c.state !== "running") return noop

  const def = SOUNDS[name]
  const file = def.files[Math.floor(Math.random() * def.files.length)]
  const startAt = c.currentTime + delay
  let cancelled = false
  let stopFn: (() => void) | null = null

  void load(file).then((buffer) => {
    if (!buffer || cancelled) return
    const source = c.createBufferSource()
    const gain = c.createGain()
    source.buffer = buffer
    gain.gain.value = def.volume * volume
    source.connect(gain).connect(c.destination)
    // Si el archivo tardó en cargar y ya pasó su momento, no lo toca atrasado
    // más de un instante.
    if (c.currentTime - startAt > 0.15) return
    source.start(Math.max(startAt, c.currentTime))
    stopFn = () => {
      const now = c.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.08)
      try {
        source.stop(now + 0.1)
      } catch {
        // ya terminó
      }
    }
  })

  return () => {
    cancelled = true
    stopFn?.()
  }
}

/** Atajo para programar varios sonidos y cortarlos todos juntos. */
export function playSequence(steps: { name: SoundName; at: number; volume?: number }[]): () => void {
  const stops = steps.map((s) => playSound(s.name, { delay: s.at, volume: s.volume }))
  return () => stops.forEach((stop) => stop())
}
