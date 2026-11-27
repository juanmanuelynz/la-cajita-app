"use client"

// Aviso para instalar la app (Poker y Truco, ya con la sesión abierta: en el
// iPhone, agregarla desde el login la dejaba con la barra del navegador).
//
// Qué se puede saber y qué no:
// - Abierta como app instalada (display-mode standalone): no se ofrece instalar.
//   Si además es una instalación de antes del ícono nuevo, en el iPhone se
//   sugiere volver a agregarla (Android actualiza el ícono solo).
// - En Safari no hay forma de saber si ya la tenés en la pantalla de inicio
//   (la app instalada guarda sus cosas aparte). Por eso hay "Ya la tengo".
// - En Android, Chrome solo ofrece instalar si todavía no está instalada.

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Share, X } from "lucide-react"
import { ICON_VERSION, INSTALL_KEY, OLD_INSTALL } from "@/lib/install-mark"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

const DISMISS_KEY = "pwa-install-dismissed-at"
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000
/** "Ya la tengo": no vuelve a aparecer en este navegador. */
const NEVER = "never"

type Mode = "ios" | "android" | "reinstall"

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // sin storage: el aviso puede volver a aparecer
  }
}

function dismissed() {
  const raw = read(DISMISS_KEY)
  if (!raw) return false
  if (raw === NEVER) return true
  const at = Number(raw)
  return Number.isFinite(at) && Date.now() - at < DISMISS_COOLDOWN_MS
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // @ts-expect-error propiedad solo de Safari en iOS
  window.navigator.standalone === true

export function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)

  useEffect(() => {
    if (isStandalone()) {
      // La marca la graba el script de app/layout.tsx (lib/install-mark.ts).
      const mark = read(INSTALL_KEY)
      if (mark === ICON_VERSION) return
      // Android actualiza el ícono solo; en el iPhone hay que volver a agregarla.
      if (mark === OLD_INSTALL && isIos()) {
        if (!dismissed()) setMode("reinstall")
      } else write(INSTALL_KEY, ICON_VERSION)
      return
    }

    if (dismissed()) return

    if (isIos()) {
      setMode("ios")
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setMode("android")
    }
    const handleAppInstalled = () => {
      setMode(null)
      setDeferredPrompt(null)
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
      setMode(null)
    }
  }

  /** Más tarde: vuelve en 14 días. */
  const later = () => {
    setMode(null)
    write(DISMISS_KEY, String(Date.now()))
  }

  /** Ya la tengo / dejarla así: no vuelve a aparecer. */
  const never = () => {
    setMode(null)
    if (mode === "reinstall") write(INSTALL_KEY, ICON_VERSION)
    else write(DISMISS_KEY, NEVER)
  }

  if (!mode) return null

  const iosSteps = (
    <ol className="mb-3 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
      <li>
        Tocá <Share className="mb-0.5 inline h-4 w-4" /> <span className="font-semibold">Compartir</span> y{" "}
        <span className="font-semibold">&ldquo;Agregar a inicio&rdquo;</span>.
      </li>
      <li>
        Dejá prendido <span className="font-semibold">&ldquo;Abrir como app web&rdquo;</span>.
      </li>
    </ol>
  )

  return (
    <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 rounded-2xl border border-primary/40 bg-card/95 p-4 text-card-foreground shadow-xl backdrop-blur-sm md:left-auto md:right-4 md:w-96">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="mb-2 font-semibold text-primary">
            {mode === "reinstall" ? "La Cajita tiene ícono nuevo" : "Instalá La Cajita"}
          </h3>

          {mode === "reinstall" && (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                Para verlo, borrá la app de la pantalla de inicio y volvé a agregarla desde Safari (después
                de poner el PIN):
              </p>
              {iosSteps}
            </>
          )}

          {mode === "ios" && (
            <>
              <p className="mb-2 text-sm text-muted-foreground">Así se abre a pantalla completa, como una app:</p>
              {iosSteps}
            </>
          )}

          {mode === "android" && (
            <p className="mb-3 text-sm text-muted-foreground">
              Instalala para abrirla rápido, a pantalla completa y sin conexión.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {mode === "android" && (
              <Button onClick={handleInstallClick} size="sm">
                <Download className="mr-1 h-4 w-4" />
                Instalar
              </Button>
            )}
            <Button onClick={later} size="sm" variant="outline">
              Más tarde
            </Button>
            {mode !== "android" && (
              <Button onClick={never} size="sm" variant="ghost">
                {mode === "reinstall" ? "Dejarla así" : "Ya la tengo"}
              </Button>
            )}
          </div>
        </div>
        <Button onClick={later} size="sm" variant="ghost" className="p-1 text-muted-foreground" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
