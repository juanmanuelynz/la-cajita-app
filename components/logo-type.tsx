import { cn } from "@/lib/utils"

/**
 * "LA CAJITA" con la letra del logo: mayúsculas bien separadas, en dorado. La
 * usan los encabezados de Poker y Truco y los splash. El margen negativo a la
 * derecha compensa el espacio que deja la última letra, así queda centrado.
 */
export function LogoType({ className, as: Tag = "h1" }: { className?: string; as?: "h1" | "span" }) {
  return <Tag className={cn("logo-type", className)}>La Cajita</Tag>
}
