"use client"

import type { LucideIcon } from "lucide-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

/** Pestañas con ícono y texto, el mismo estilo en todas las pantallas. Va adentro de <Tabs>. */
export function IconTabsList({
  tabs,
  className,
}: {
  tabs: readonly { value: string; label: string; icon: LucideIcon }[]
  className?: string
}) {
  return (
    <TabsList
      className={cn("grid h-auto w-full rounded-2xl p-1", className)}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(({ value, label, icon: Icon }) => (
        <TabsTrigger key={value} value={value} className="gap-1 rounded-xl px-1 py-2 text-[13px] data-[state=active]:shadow min-[400px]:gap-1.5 min-[400px]:text-sm">
          <Icon className="size-4 shrink-0" />
          <span className="whitespace-nowrap">{label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
