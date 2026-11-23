// GENERADO por scripts/gen-preflop-beta.ts — no editar a mano.
// Equity contra 2 manos al azar (Monte Carlo con semilla fija).

import type { Position } from "./preflop"

export const BETA_DATA: {
  validation: Record<Position, number>
  thresholds: Record<string, Record<Position, number>>
  shortGrid: Record<string, number>
} = {
  "validation": {
    "UTG": 0.9412,
    "MP": 0.8914,
    "CO": 0.8492,
    "BU": 0.8703,
    "SB": 0.8492
  },
  "thresholds": {
    "holdem:short": {
      "UTG": 0.4099,
      "MP": 0.3974,
      "CO": 0.3685,
      "BU": 0.3056,
      "SB": 0.3757
    },
    "omaha:long": {
      "UTG": 0.3953,
      "MP": 0.3833,
      "CO": 0.354,
      "BU": 0.311,
      "SB": 0.3561
    },
    "omaha:short": {
      "UTG": 0.3959,
      "MP": 0.3881,
      "CO": 0.3618,
      "BU": 0.3176,
      "SB": 0.3641
    },
    "manhattan:long": {
      "UTG": 0.4183,
      "MP": 0.406,
      "CO": 0.3588,
      "BU": 0.3028,
      "SB": 0.363
    },
    "manhattan:short": {
      "UTG": 0.419,
      "MP": 0.4057,
      "CO": 0.3713,
      "BU": 0.3143,
      "SB": 0.3732
    }
  },
  "shortGrid": {
    "66": 0.252,
    "77": 0.2887,
    "88": 0.3228,
    "99": 0.3685,
    "AA": 0.566,
    "AKs": 0.4437,
    "AQs": 0.4274,
    "AJs": 0.4198,
    "ATs": 0.4057,
    "A9s": 0.3807,
    "A8s": 0.3757,
    "A7s": 0.3494,
    "A6s": 0.3306,
    "AKo": 0.4202,
    "KK": 0.5138,
    "KQs": 0.4274,
    "KJs": 0.4196,
    "KTs": 0.4099,
    "K9s": 0.3613,
    "K8s": 0.3274,
    "K7s": 0.3148,
    "K6s": 0.3003,
    "AQo": 0.4102,
    "KQo": 0.4038,
    "QQ": 0.4766,
    "QJs": 0.4184,
    "QTs": 0.4078,
    "Q9s": 0.3548,
    "Q8s": 0.3201,
    "Q7s": 0.2918,
    "Q6s": 0.2728,
    "AJo": 0.3974,
    "KJo": 0.3849,
    "QJo": 0.3971,
    "JJ": 0.4446,
    "JTs": 0.4117,
    "J9s": 0.3569,
    "J8s": 0.3317,
    "J7s": 0.2929,
    "J6s": 0.2633,
    "ATo": 0.3798,
    "KTo": 0.3763,
    "QTo": 0.3892,
    "JTo": 0.3891,
    "TT": 0.4123,
    "T9s": 0.3719,
    "T8s": 0.3314,
    "T7s": 0.31,
    "T6s": 0.2694,
    "A9o": 0.3564,
    "K9o": 0.335,
    "Q9o": 0.3266,
    "J9o": 0.3383,
    "T9o": 0.3493,
    "98s": 0.3378,
    "97s": 0.3114,
    "96s": 0.2781,
    "A8o": 0.3398,
    "K8o": 0.2971,
    "Q8o": 0.2967,
    "J8o": 0.3056,
    "T8o": 0.317,
    "98o": 0.3097,
    "87s": 0.2907,
    "86s": 0.2658,
    "A7o": 0.3248,
    "K7o": 0.2877,
    "Q7o": 0.2681,
    "J7o": 0.2761,
    "T7o": 0.2768,
    "97o": 0.2783,
    "87o": 0.2608,
    "76s": 0.2454,
    "A6o": 0.307,
    "K6o": 0.2711,
    "Q6o": 0.2567,
    "J6o": 0.2364,
    "T6o": 0.2412,
    "96o": 0.2493,
    "86o": 0.2322,
    "76o": 0.2132
  }
}
