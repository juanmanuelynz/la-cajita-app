import { Card as UICard, CardContent } from "@/components/ui/card"
import { parseCards } from "@/lib/poker/cards"
import { HAND_EXAMPLES } from "@/lib/poker/examples"
import { Cat, CATEGORY_NAMES, categoryOrder } from "@/lib/poker/evaluator"
import { GAMES, type Variant } from "@/lib/poker/variants"
import { CardRow } from "./playing-card"

const DESCRIPTIONS: Record<Cat, string> = {
  [Cat.StraightFlush]: "Cinco seguidas del mismo palo.",
  [Cat.Quads]: "Cuatro del mismo número.",
  [Cat.FullHouse]: "Un trío y un par.",
  [Cat.Flush]: "Cinco del mismo palo.",
  [Cat.Straight]: "Cinco seguidas, de cualquier palo.",
  [Cat.Trips]: "Tres del mismo número.",
  [Cat.TwoPair]: "Dos pares distintos.",
  [Cat.Pair]: "Dos del mismo número.",
  [Cat.HighCard]: "Nada: manda la carta más alta.",
}

export function HandRankings({ variant }: { variant: Variant }) {
  const order = categoryOrder(variant.deck)
  const game = GAMES[variant.game]
  return (
    <div className="space-y-3">
      <UICard>
        <CardContent className="p-4 space-y-2 text-sm">
          <h3 className="font-semibold">Cómo se arma la mano en {game.name}</h3>
          <p>{game.rule}</p>
          <p className="text-muted-foreground">
            Se reparte igual que el Hold&apos;em: flop (3 cartas), turn (1) y river (1). Siempre gana la mejor combinación de
            5 cartas.
          </p>
          {variant.deck === "short" && (
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Short deck: 36 cartas, sin 2, 3, 4 ni 5.</li>
              <li>
                El <b>color le gana al full</b>: con 9 cartas por palo, el color sale menos.
              </li>
              <li>A-6-7-8-9 es escalera (la más baja).</li>
              <li>En La Cajita la escalera le gana al trío.</li>
            </ul>
          )}
        </CardContent>
      </UICard>

      <UICard>
        <CardContent className="p-2">
          <ol className="divide-y">
            {order.map((cat, i) => (
              <li key={cat} className="flex items-center gap-3 p-2">
                <span className="w-5 text-right text-muted-foreground tabular-nums text-sm">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{CATEGORY_NAMES[cat]}</div>
                  <div className="text-xs text-muted-foreground">{DESCRIPTIONS[cat]}</div>
                </div>
                <CardRow cards={parseCards(HAND_EXAMPLES[variant.deck][cat])} size="xs" className="flex-nowrap gap-0.5" />
              </li>
            ))}
          </ol>
        </CardContent>
      </UICard>
    </div>
  )
}
