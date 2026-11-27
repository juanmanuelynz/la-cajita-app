// Si esta pestaña ya mostró un splash (la app ya arrancó). Vive en memoria: al
// navegar entre Poker y Truco sigue en true y no se repite el splash; al abrir
// la app de cero vuelve a false.
let booted = false
export const appBooted = () => booted
export const markAppBooted = () => {
  booted = true
}
