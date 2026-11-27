"use client"

// Aprender (Truco): menú de lecciones y cada lección en su pantalla, con
// "Volver" y el "atrás" del celular (useBackToClose), como los ejercicios de
// Entrenar. Las lecciones leídas se guardan en este celular.

import { useEffect, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useBackToClose } from "@/hooks/use-back-to-close"
import { cn } from "@/lib/utils"
import { LESSONS } from "./lessons"

const READ_KEY = "la-cajita:truco:lecciones-leidas"

export function Aprender({ onPractice }: { onPractice: () => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const [read, setRead] = useState<number[]>([])
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")
      if (Array.isArray(saved)) setRead(saved.filter((x) => Number.isInteger(x)))
    } catch {}
  }, [])

  // Abrir una lección la marca como leída y sube al principio.
  useEffect(() => {
    if (open === null) return
    topRef.current?.scrollIntoView({ block: "start" })
    setRead((prev) => {
      if (prev.includes(open)) return prev
      const next = [...prev, open]
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [open])

  const close = () => setOpen(null)
  useBackToClose(open !== null, close, "truco-leccion")

  const nextUnread = LESSONS.findIndex((_, i) => !read.includes(i))

  if (open !== null) {
    const lesson = LESSONS[open]
    const last = open === LESSONS.length - 1
    return (
      <div className="animate-fade-in space-y-3 pt-3 pb-8">
        <div ref={topRef} className="scroll-mt-24" />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1 px-2" onClick={close}>
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
            Lección {open + 1} de {LESSONS.length}
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
        <div className="flex justify-between gap-2">
          <Button variant="outline" disabled={open === 0} onClick={() => setOpen(open - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          {last ? (
            <Button
              onClick={() => {
                close()
                onPractice()
              }}
            >
              A practicar
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
        <h2 className="text-xl font-bold">Aprender a jugar</h2>
        <p className="text-sm text-muted-foreground">
          Las reglas del truco argentino, de cero. {read.length} de {LESSONS.length} leídas.
        </p>
      </div>
      {LESSONS.map((l, i) => {
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
