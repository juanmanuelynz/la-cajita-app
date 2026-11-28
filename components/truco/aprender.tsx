"use client"

// Aprender (Truco): las lecciones de lessons.tsx en el menú compartido.

import { LessonsMenu } from "@/components/lessons-menu"
import { LESSONS } from "./lessons"

export function Aprender({ onPractice }: { onPractice: () => void }) {
  return (
    <LessonsMenu
      lessons={LESSONS}
      storageKey="la-cajita:truco:lecciones-leidas"
      backKey="truco-leccion"
      title="Aprender a jugar"
      subtitle="Las reglas del truco argentino, de cero."
      finish={{ label: "A practicar", onClick: onPractice }}
    />
  )
}
