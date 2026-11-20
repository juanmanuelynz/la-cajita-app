"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Anima un número hasta `to` (easing out cúbico) y devuelve el valor actual
 * redondeado. La primera vez arranca en `from`; después, cada cambio de `to`
 * anima desde el valor que se está mostrando. Ignora "reducir movimiento" a
 * propósito: la app es para un grupo chico y todos quieren las animaciones,
 * aunque el teléfono pida reducirlas.
 */
export function useCountUp(
  to: number,
  { durationMs = 1200, delayMs = 0, from = 0 }: { durationMs?: number; delayMs?: number; from?: number } = {},
): number {
  const [value, setValue] = useState(from)
  const valueRef = useRef(from)

  useEffect(() => {
    const set = (v: number) => {
      valueRef.current = v
      setValue(v)
    }
    const start = valueRef.current
    if (start === to) return
    let raf = 0
    let t0: number | null = null
    const timer = setTimeout(() => {
      const tick = (now: number) => {
        if (t0 === null) t0 = now
        const t = Math.min(1, (now - t0) / durationMs)
        const eased = 1 - Math.pow(1 - t, 3)
        set(Math.round(start + (to - start) * eased))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delayMs)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [to, durationMs, delayMs])

  return value
}
