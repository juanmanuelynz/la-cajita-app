// Lista única de los ejercicios de Practicar (Truco). La usan el validador del
// servidor (lib/validators.ts) y la pantalla. Los nuevos van al final.
export const TRUCO_QUIZ_IDS = ["gana", "envido", "puntos"] as const
export type TrucoQuizId = (typeof TRUCO_QUIZ_IDS)[number]
