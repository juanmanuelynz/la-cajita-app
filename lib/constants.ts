export const POINTS_DISTRIBUTION = [10, 7, 5, 3, 2, 1, 0, 0] as const

export const POINTS_CONFIG_PRESETS: Record<string, number[]> = {
  Clásico: [10, 7, 5, 3, 2, 1, 0, 0],
  "Top-pesado": [15, 10, 5, 2, 1, 0, 0, 0],
  Plano: [8, 6, 5, 4, 3, 2, 1, 0],
}

export const PLAYER_COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#feca57",
  "#ff9ff3",
  "#54a0ff",
  "#5f27cd",
] as const

export const EVOLUTION_COLORS = [
  "rgba(59, 130, 246, 1)",
  "rgba(239, 68, 68, 1)",
  "rgba(34, 197, 94, 1)",
  "rgba(234, 179, 8, 1)",
  "rgba(168, 85, 247, 1)",
  "rgba(236, 72, 153, 1)",
  "rgba(251, 146, 60, 1)",
  "rgba(20, 184, 166, 1)",
] as const
