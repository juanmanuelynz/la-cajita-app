// En cuál de las dos apps estabas (Poker o Truco), en este celular. La app
// instalada abre en "/": el middleware la manda a /truco si la cookie dice
// "truco", y si no llegó la cookie (por ejemplo sin conexión, desde la caché),
// Poker hace lo mismo del lado del celular antes de cargar nada. Los botones
// "Quiero jugar Truco / Poker" lo actualizan antes de navegar.

export type CajitaApp = "poker" | "truco"
const KEY = "la-cajita:app"

export function getLastApp(): CajitaApp {
  try {
    return localStorage.getItem(KEY) === "truco" ? "truco" : "poker"
  } catch {
    return "poker"
  }
}

/** Cookie con la última app, para que el middleware abra "/" directo en /truco (sin pasar por el splash de Poker). */
export const LAST_APP_COOKIE = "la_cajita_app"

export function setLastApp(app: CajitaApp) {
  try {
    localStorage.setItem(KEY, app)
  } catch {
    // sin storage: siempre abre en Poker
  }
  try {
    document.cookie = `${LAST_APP_COOKIE}=${app}; path=/; max-age=31536000; samesite=lax`
  } catch {
    // sin cookies: queda la redirección del lado del celular
  }
}
