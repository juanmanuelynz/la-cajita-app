"use client"

import React from "react"
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useIsMobile } from "@/hooks/use-mobile"

interface AdaptiveTooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  title?: string
}

export function AdaptiveTooltip({ children, content, title }: AdaptiveTooltipProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Dialog>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="max-w-sm">
          {title && (
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
          )}
          <div className="text-sm">{content}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-sm">{content}</TooltipContent>
      </UITooltip>
    </TooltipProvider>
  )
}
