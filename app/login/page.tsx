import { cookies } from "next/headers"
import { LAST_APP_COOKIE } from "@/lib/last-app"
import { LoginScreen } from "./login-screen"

// El login arma la misma escena que el splash de la app que sigue (Poker o
// Truco, según la cookie de la última app), así el paso al splash es continuo.
export default async function LoginPage() {
  const app = (await cookies()).get(LAST_APP_COOKIE)?.value === "truco" ? "truco" : "poker"
  return <LoginScreen initialApp={app} />
}
