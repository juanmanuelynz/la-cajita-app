"use client"

import { useEffect, useRef } from "react"

/**
 * Pantallas que tapan la sección (un ejercicio, el Desafío): mientras están
 * abiertas ocupan una entrada del historial, así el "atrás" del celular las
 * cierra en vez de salir de la app.
 *
 * - Al abrirse (`open` pasa a true) se agrega la entrada.
 * - Si se cierra con un botón (`open` pasa a false), se saca la entrada.
 * - Si se toca "atrás", se llama a `close`.
 */
export function useBackToClose(open: boolean, close: () => void, key: string) {
  const closeRef = useRef(close)
  closeRef.current = close
  /** Si la entrada del historial es nuestra y sigue puesta. */
  const pushed = useRef(false)

  useEffect(() => {
    if (open && !pushed.current) {
      try {
        history.pushState({ backToClose: key }, "")
        pushed.current = true
      } catch {
        // sin historial: se cierra igual con el botón
      }
    } else if (!open && pushed.current) {
      pushed.current = false
      if (history.state?.backToClose === key) history.back()
    }
  }, [open, key])

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return // el "atrás" que hicimos nosotros al cerrar, u otra pantalla
      pushed.current = false
      closeRef.current()
    }
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      // Si se va de la pestaña con la pantalla abierta, no dejar la entrada colgada.
      if (pushed.current && history.state?.backToClose === key) history.back()
      pushed.current = false
    }
  }, [key])
}
