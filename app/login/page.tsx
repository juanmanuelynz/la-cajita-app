import type { Metadata } from "next"
import { cookies } from "next/headers"
import { TRUCO_METADATA } from "@/app/truco/metadata"
import { LAST_APP_COOKIE } from "@/lib/last-app"
import { LoginScreen } from "./login-screen"

type Props = { searchParams: Promise<{ app?: string }> }

// Truco si se llegó desde /truco (el middleware agrega ?app=truco) o si la
// última app usada en este celular fue Truco (cookie).
async function appFor(searchParams: Props["searchParams"]) {
  if ((await searchParams).app === "truco") return "truco"
  return (await cookies()).get(LAST_APP_COOKIE)?.value === "truco" ? "truco" : "poker"
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return (await appFor(searchParams)) === "truco" ? TRUCO_METADATA : {}
}

// El login arma la misma escena que el splash de la app que sigue (Poker o
// Truco), así el paso al splash es continuo.
export default async function LoginPage({ searchParams }: Props) {
  return <LoginScreen initialApp={await appFor(searchParams)} />
}
