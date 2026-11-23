import { Cat } from "./evaluator"

/** Una mano de ejemplo por categoría, para la tabla de jugadas. */
export const HAND_EXAMPLES: Record<"long" | "short", Record<Cat, string>> = {
  long: {
    [Cat.StraightFlush]: "9h 8h 7h 6h 5h",
    [Cat.Quads]: "Qs Qh Qd Qc 4s",
    [Cat.FullHouse]: "Ks Kh Kd 7c 7s",
    [Cat.Flush]: "As Js 8s 6s 2s",
    [Cat.Straight]: "Td 9c 8h 7s 6d",
    [Cat.Trips]: "8s 8h 8d Kc 3s",
    [Cat.TwoPair]: "Jh Jd 4s 4c Ad",
    [Cat.Pair]: "Ah Ad 9s 6c 3d",
    [Cat.HighCard]: "Ah Qd 9s 6c 3d",
  },
  short: {
    [Cat.StraightFlush]: "9h 8h 7h 6h Ah",
    [Cat.Quads]: "Qs Qh Qd Qc 7s",
    [Cat.FullHouse]: "Ks Kh Kd 7c 7s",
    [Cat.Flush]: "As Js 8s 7s 6s",
    [Cat.Straight]: "Ad 9c 8h 7s 6d",
    [Cat.Trips]: "8s 8h 8d Kc 6s",
    [Cat.TwoPair]: "Jh Jd 7s 7c Ad",
    [Cat.Pair]: "Ah Ad 9s 7c 6d",
    [Cat.HighCard]: "Ah Qd 9s 7c 6d",
  },
}
