"use client"

// Menú de lecciones y cada lección en su pantalla, con "Volver" y el "atrás"
// del celular (useBackToClose), como los ejercicios de Entrenar. Las lecciones
// leídas se guardan en este celular. Lo usan Aprender de Truco y de Poker.

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useBackToClose } from "@/hooks/use-back-to-close"
import { cn } from "@/lib/utils"

export interface Lesson {
  title: string
  /** Una línea para el menú. */
  summary: string
  body: () => ReactNode
}

export function LessonsMenu({
  lessons,
  storageKey,
  backKey,
  title,
  subtitle,
  finish,
  practice,
  onOpenChange,
}: {
  lessons: Lesson[]
  /** Dónde se guardan las leídas (índices). */
  storageKey: string
  /** Clave para useBackToClose. */
  backKey: string
  title: string
  /** Va antes de "N de M leídas". */
  subtitle: string
  /** Botón de la última lección. */
  finish: { label: string; onClick: () => void }
  /** Botón para practicar lo de esa lección (debajo de la lección), si hay. */
  practice?: (index: number) => { label: string; onClick: () => void } | null
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [read, setRead] = useState<number[]>([])
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
      if (Array.isArray(saved)) setRead(saved.filter((x) => Number.isInteger(x)))
    } catch {}
  }, [storageKey])

  // Abrir una lección la marca como leída y sube al principio.
  useEffect(() => {
    onOpenChange?.(open !== null)
    if (open === null) return
    topRef.current?.scrollIntoView({ block: "start" })
    setRead((prev) => {
      if (prev.includes(open)) return prev
      const next = [...prev, open]
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {}
      return next
    })
    // onOpenChange puede cambiar en cada render; solo importa cuando cambia `open`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storageKey])

  const close = () => setOpen(null)
  useBackToClose(open !== null, close, backKey)
  /**
   * Cierra la lección y después hace `then`. Cerrar saca la entrada del
   * historial con un history.back() que llega después: si `then` abre otra
   * pantalla con su propia entrada (un ejercicio), hay que esperar a ese
   * "atrás", si no se llevaría la entrada nueva y la cerraría.
   */
  const closeThen = (then: () => void) => {
    if (history.state?.backToClose === backKey) window.addEventListener("popstate", () => then(), { once: true })
    else setTimeout(then)
    close()
  }

  const nextUnread = lessons.findIndex((_, i) => !read.includes(i))

  if (open !== null) {
    const lesson = lessons[open]
    const last = open === lessons.length - 1
    const prac = practice?.(open) ?? null
    return (
      <div className="animate-fade-in space-y-3 pt-3 pb-8">
        <div ref={topRef} className="scroll-mt-24" />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1 px-2" onClick={close}>
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
            Lección {open + 1} de {lessons.length}
          </div>
        </div>
        <Card>
          <CardContent className="space-y-3 pt-6 leading-relaxed">
            <h2 className="text-xl font-bold">
              {open + 1}. {lesson.title}
            </h2>
            {lesson.body()}
          </CardContent>
        </Card>
        {prac && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => closeThen(prac.onClick)}
          >
            {prac.label}
          </Button>
        )}
        <div className="flex justify-between gap-2">
          <Button variant="outline" disabled={open === 0} onClick={() => setOpen(open - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          {last ? (
            <Button
              onClick={() => closeThen(finish.onClick)}
            >
              {finish.label}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setOpen(open + 1)}>
              Siguiente
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-4 pb-8">
      <div className="px-1">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {subtitle} {read.length} de {lessons.length} leídas.
        </p>
      </div>
      {lessons.map((l, i) => {
        const done = read.includes(i)
        const next = i === nextUnread
        return (
          <button
            key={l.title}
            onClick={() => setOpen(i)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors active:bg-muted",
              next && "border-primary",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full font-bold",
                done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-5" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{l.title}</span>
              <span className="block truncate text-sm text-muted-foreground">{l.summary}</span>
            </span>
            {next && <span className="shrink-0 text-xs font-semibold text-primary">Seguí acá</span>}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )
      })}
    </div>
  )
}
