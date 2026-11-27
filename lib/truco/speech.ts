// Decir algo en voz alta con la voz del celular (Web Speech API), en español.
// Sin conexión ni costo; si el navegador no tiene voz, no hace nada.

let pending: ReturnType<typeof setTimeout> | null = null

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

function spanishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang.toLowerCase() === "es-ar") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("es-4")) ?? // es-419, Latinoamérica
    voices.find((v) => v.lang.toLowerCase().startsWith("es"))
  )
}

/**
 * Dice `text` después de `delay` ms sin nuevos pedidos (si se tocan varios
 * puntos seguidos, habla una sola vez al final) y corta lo que estaba diciendo.
 */
export function speakSoon(text: string, delay = 700) {
  if (!canSpeak()) return
  if (pending) clearTimeout(pending)
  pending = setTimeout(() => {
    pending = null
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "es-AR"
    const v = spanishVoice()
    if (v) u.voice = v
    u.rate = 1.05
    synth.speak(u)
  }, delay)
}

export function stopSpeaking() {
  if (pending) clearTimeout(pending)
  pending = null
  if (canSpeak()) window.speechSynthesis.cancel()
}
