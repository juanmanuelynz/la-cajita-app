// Efectos de sonido de la app. Los archivos están en /public/sounds: fichas
// recortadas de "Clay Chips" (ArtOrDie, Freesound, CC BY 4.0: la atribución
// se muestra en Reglas → Configuración) y el resto del pack de Kenney (CC0).
// Origen y licencia de cada uno en CREDITS.txt.
//
// Se usa Web Audio en vez de <audio>: menos latencia, sonidos superpuestos y
// control de volumen en iOS. Los navegadores no dejan reproducir audio hasta
// que el usuario toca algo, así que el AudioContext se crea y "despierta" en el
// primer toque/tecla. Si todavía no despertó, play() no hace nada (no encola:
// un sonido que llega tarde queda peor que ninguno).

export const SOUNDS = {
  /** Puñadito de fichas que caen: +1 cajita. */
  chipLay: { files: ["chip-lay-1", "chip-lay-2", "chip-lay-3", "chip-lay-4"], volume: 0.6 },
  /** Golpecito corto de fichas: −1 cajita. */
  chipsTap: { files: ["chips-tap-1", "chips-tap-2", "chips-tap-3"], volume: 0.5 },
  /** Montón de fichas cayendo: lluvia de fichas. */
  chipsRain: { files: ["chips-rain-1", "chips-rain-2", "chips-rain-3", "chips-rain-4"], volume: 0.6 },
  /** Muchas fichas cayendo: 3° y 2° puesto del podio. */
  chipsStack: { files: ["chips-stack-1", "chips-stack-2", "chips-stack-3", "chips-stack-4"], volume: 0.8 },
  /** Fichas que saltan del maletín. */
  chipsBurst: { files: ["chips-burst"], volume: 0.8 },
  /** La cascada más larga: registrar la partida y 1° puesto. */
  chipsPush: { files: ["chip-push"], volume: 0.9 },
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
  if (on && ctx) {
    preloaded = true
    preloadAll()
  }
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

function loadAll(names: SoundName[]): Promise<unknown> {
  return Promise.all([...new Set(names)].flatMap((n) => SOUNDS[n].files.map((f) => load(f))))
}

/**
 * Descarga y decodifica estos sonidos ya, sin esperar al primer toque (eso
 * solo hace falta para reproducir). Para pantallas que suenan enseguida de la
 * primera interacción, como el login.
 */
export function preloadSounds(names: SoundName[]) {
  if (!isSoundEnabled()) return
  void loadAll(names)
}

let sessionSet = false
let preloaded = false

function unlock() {
  const c = getContext()
  if (!c) return
  // iOS 16.4+: "ambient" respeta el botón de silencio y no corta la música
  // que esté sonando en el teléfono.
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (!sessionSet && nav.audioSession) {
    sessionSet = true
    try {
      nav.audioSession.type = "ambient"
    } catch {
      // no soportado
    }
  }
  // iOS suspende o "interrumpe" el contexto al cambiar de app o bloquear el
  // teléfono: hay que reanudarlo dentro de un toque, cada vez que pase.
  if (c.state !== "running") {
    void c.resume().catch(() => {})
    // Algunas versiones de iOS solo habilitan el audio si algo suena durante
    // el toque: un buffer de silencio de una muestra alcanza.
    try {
      const src = c.createBufferSource()
      src.buffer = c.createBuffer(1, 1, 22050)
      src.connect(c.destination)
      src.start(0)
    } catch {
      // ignore
    }
  }
  if (!preloaded && isSoundEnabled()) {
    preloaded = true
    preloadAll()
  }
}

// Se escucha siempre (no solo el primer toque): es barato y es la única forma
// de recuperar el audio después de que iOS lo suspende.
const UNLOCK_EVENTS = ["touchend", "click", "keydown", "pointerdown"] as const
if (typeof window !== "undefined") {
  UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }))
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
 *
 * Si el audio está en pausa (iOS lo arranca así y lo vuelve a pausar al
 * cambiar de app), primero lo reanuda y recién después suena: el toque que
 * pidió el sonido es el mismo que lo habilita, y la reanudación tarda.
 */
export function playSound(name: SoundName, { delay = 0, volume = 1 }: PlayOptions = {}): () => void {
  const noop = () => {}
  if (!isSoundEnabled()) return noop
  const c = getContext()
  if (!c) return noop

  const def = SOUNDS[name]
  const file = def.files[Math.floor(Math.random() * def.files.length)]
  // Momento pedido, en reloj de pared: el reloj del AudioContext no avanza
  // mientras está en pausa.
  const wantedAt = performance.now() + delay * 1000
  let cancelled = false
  let stopFn: (() => void) | null = null

  const ready =
    c.state === "running"
      ? Promise.resolve(true)
      : Promise.race([
          c.resume().then(
            () => true,
            () => false,
          ),
          new Promise<boolean>((r) => setTimeout(() => r(false), 600)),
        ])

  void Promise.all([ready, load(file)]).then(([ok, buffer]) => {
    if (cancelled) return
    if (!buffer) return
    if (!ok || c.state !== "running") return
    const wait = (wantedAt - performance.now()) / 1000
    // Un sonido inmediato que llega muy tarde (primera carga lenta) queda
    // peor que ninguno.
    if (wait < -0.4) return
    const source = c.createBufferSource()
    const gain = c.createGain()
    source.buffer = buffer
    gain.gain.value = def.volume * volume
    source.connect(gain).connect(c.destination)
    source.start(c.currentTime + Math.max(0, wait))
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
/**
 * Programa varios sonidos y devuelve una función que los corta todos. Espera
 * a tener todos los archivos cargados antes de arrancar, así la secuencia no
 * sale desfasada ni pierde partes en una primera carga lenta. Si la carga
 * tarda demasiado (más de 1,5 s), no suena: ya pasó el momento.
 */
export function playSequence(steps: { name: SoundName; at: number; volume?: number }[]): () => void {
  if (!isSoundEnabled() || !getContext()) return () => {}
  const requestedAt = performance.now()
  let cancelled = false
  let stops: (() => void)[] = []
  void loadAll(steps.map((s) => s.name)).then(() => {
    if (cancelled || performance.now() - requestedAt > 1500) return
    stops = steps.map((s) => playSound(s.name, { delay: s.at, volume: s.volume }))
  })
  return () => {
    cancelled = true
    stops.forEach((stop) => stop())
  }
}
