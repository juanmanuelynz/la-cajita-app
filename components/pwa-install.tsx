"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Share, X } from "lucide-react"

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

function isWithinDismissCooldown() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const dismissedAt = Number(raw)
    if (!Number.isFinite(dismissedAt)) return false
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

function detectIos() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS-only Safari property
    window.navigator.standalone === true
  return isIos && !isStandalone
}

export function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    if (isWithinDismissCooldown()) {
      return
    }

    if (detectIos()) {
      setIsIos(true)
      setShowInstallPrompt(true)
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallPrompt(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
      try {
        localStorage.removeItem(DISMISS_KEY)
      } catch {
        // ignore
      }
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
      setShowInstallPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore
    }
  }

  if (isInstalled || !showInstallPrompt) {
    return null
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 bg-gray-800/95 border-green-600/50 backdrop-blur-sm md:left-auto md:right-4 md:w-96">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">♠️</span>
              <h3 className="font-semibold text-green-400">Instalar La Cajita</h3>
            </div>

            {isIos ? (
              <>
                <p className="text-sm text-gray-300 mb-3">
                  En iPhone tocá{" "}
                  <Share className="inline w-4 h-4 mb-0.5" /> Compartir y luego{" "}
                  <span className="font-semibold">&ldquo;Añadir a pantalla de inicio&rdquo;</span>.
                </p>
                <Button
                  onClick={handleDismiss}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300"
                >
                  Entendido
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-300 mb-3">
                  Instala la app para acceso rápido y uso sin conexión
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleInstallClick}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Instalar
                  </Button>
                  <Button
                    onClick={handleDismiss}
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300"
                  >
                    Ahora no
                  </Button>
                </div>
              </>
            )}
          </div>
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="ghost"
            className="text-gray-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
