"use client"

import { useSyncExternalStore } from "react"
import { isSoundEnabled, setSoundEnabled, subscribeSoundEnabled } from "@/lib/sounds"

/** Preferencia de sonido del dispositivo, sincronizada entre componentes. */
export function useSoundEnabled(): [boolean, (on: boolean) => void] {
  const enabled = useSyncExternalStore(subscribeSoundEnabled, isSoundEnabled, () => true)
  return [enabled, setSoundEnabled]
}
