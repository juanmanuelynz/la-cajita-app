"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { WifiOff } from "lucide-react"

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showOfflineMessage, setShowOfflineMessage] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOfflineMessage(false)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowOfflineMessage(true)
    }

    // Set initial state
    setIsOnline(navigator.onLine)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!showOfflineMessage) {
    return null
  }

  return (
    <Card className="fixed top-20 left-4 right-4 z-50 bg-orange-900/95 border-orange-600/50 backdrop-blur-sm md:left-auto md:right-4 md:w-80">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <WifiOff className="w-5 h-5 text-orange-400" />
          <div>
            <p className="font-semibold text-orange-400">Sin conexión</p>
            <p className="text-sm text-orange-200">
              Trabajando en modo offline. Los datos se sincronizarán cuando vuelvas a conectarte.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
