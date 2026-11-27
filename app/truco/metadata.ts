import type { Metadata } from "next"

// SEO de La Cajita Truco. Lo usan /truco y el login cuando viene de /truco
// (sin sesión, quien lee el link, como WhatsApp o Google, termina en /login).
const title = "La Cajita Truco"
const description =
  "Aprendé, practicá y anotá tus partidas de truco: lecciones, ejercicios, anotador con fósforos y partidas contra la máquina."

export const TRUCO_METADATA: Metadata = {
  title,
  description,
  applicationName: title,
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
}
