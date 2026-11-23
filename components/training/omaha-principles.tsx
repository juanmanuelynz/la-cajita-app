import type { Variant } from "@/lib/poker/variants"

const SOURCE = "https://www.pokerstrategy.com/strategy/omaha-poker/plo-for-beginners-preflop-play/"

// Resumen de la lección "PLO for Beginners (2) – Preflop Play" de
// PokerStrategy.com (actualizada el 11/03/2026). Son principios para elegir
// manos, no una tabla: la propia fuente explica por qué en Omaha no existe una.
const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: "Por qué no hay tabla",
    points: [
      "Hay 16.432 manos iniciales distintas, y lo que pasa después del flop pesa mucho más que en Hold'em.",
      "Las manos están mucho más parejas antes del flop: AAKK, de las mejores, gana el 65,5% contra una mano al azar (en Hold'em, AA gana cerca del 85%).",
      "Importa tanto la equity como la jugabilidad: buscá manos que puedan ligar a la vez jugadas fuertes y proyectos fuertes (por ejemplo, trío con proyecto de color máximo).",
    ],
  },
  {
    title: "Palos",
    points: [
      "Dos palos (2 cartas de un palo y 2 de otro) son las mejores: aumentan muchísimo la fuerza y la jugabilidad. Salen en el 13,5% de las manos.",
      "Un palo es mejor que nada; sin palo repetido, las manos suelen ser malas, aunque tengas AA.",
      "Las 4 del mismo palo son flojas: te quitás tus propios outs al color.",
    ],
  },
  {
    title: "Pares",
    points: [
      "Con un par casi nunca ganás solo con el par: la idea es ligar trío en el flop (y aun así no es el monstruo que es en Hold'em).",
      "Dos pares en la mano es muy fuerte: ligás trío en el flop el 21% de las veces.",
      "Los pares bajos son peligrosos: es fácil chocar con un trío más alto.",
    ],
  },
  {
    title: "Cartas seguidas",
    points: [
      "Cuatro seguidas (por ejemplo 9-8-7-6) son de las manos más fuertes por sus escaleras; cuanto más altas, mejor. Las bajas son especulativas y muchas veces no van a la escalera máxima.",
      "Seguidas y con dos palos: extremadamente fuertes.",
      "Ojo con la carta suelta que no conecta con las otras (en A-K-Q-4, el 4): no suma outs.",
      "Si hay un hueco, mejor que esté abajo que arriba: con el hueco arriba muchas veces no vas a la máxima.",
    ],
  },
]

export function OmahaPrinciples({ variant }: { variant: Variant }) {
  if (variant.game !== "omaha") return null
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Cómo elegir manos en Omaha</h3>
      {SECTIONS.map((s) => (
        <div key={s.title}>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{s.title}</div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {s.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Fuente:{" "}
        <a href={SOURCE} target="_blank" rel="noreferrer" className="underline">
          PokerStrategy.com — PLO for Beginners (2): Preflop Play
        </a>
        . Es para Omaha con 4 cartas; en Manhattan no hay nada publicado.
      </p>
    </div>
  )
}
