import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "La Cajita Truco",
}

export default function TrucoLayout({ children }: { children: React.ReactNode }) {
  return children
}
