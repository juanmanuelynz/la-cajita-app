// En cuál de las dos apps estabas (Poker o Truco), en este celular. La app
// instalada abre en "/" y, si la última vez estabas en Truco, Poker te manda a
// /truco antes de cargar nada. Los botones "Quiero jugar Truco / Poker" lo
// actualizan antes de navegar.

export type CajitaApp = "poker" | "truco"
const KEY = "la-cajita:app"

export function getLastApp(): CajitaApp {
  try {
    return localStorage.getItem(KEY) === "truco" ? "truco" : "poker"
  } catch {
    return "poker"
  }
}

export function setLastApp(app: CajitaApp) {
  try {
    localStorage.setItem(KEY, app)
  } catch {
    // sin storage: siempre abre en Poker
  }
}
