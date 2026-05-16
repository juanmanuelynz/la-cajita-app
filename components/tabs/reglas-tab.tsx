"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Loader2, LogOut, Trophy } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { POINTS_DISTRIBUTION } from "@/lib/constants"
import type { MatchWithPlayers, PlayerStats, Tournament } from "@/lib/types"
import { logout } from "@/app/login/actions"
import { TournamentClosingPodium } from "@/components/tournament-closing-podium"

interface ReglasTabProps {
  tournaments: Tournament[]
  selectedTournamentId: string | null
  selectedTournament: Tournament | undefined
  showCreateTournament: boolean
  showCloseTournamentDialog: boolean
  newTournamentName: string
  creatingTournament: boolean
  playerStats: PlayerStats[]
  matches: MatchWithPlayers[]
  showPodium: boolean
  onShowPodium: (show: boolean) => void
  onShowCreateTournament: (show: boolean) => void
  onShowCloseTournamentDialog: (show: boolean) => void
  onNewTournamentNameChange: (name: string) => void
  onCreateTournament: () => void
  onCloseTournament: () => void
}

export function ReglasTab({
  tournaments,
  selectedTournamentId,
  selectedTournament,
  showCreateTournament,
  showCloseTournamentDialog,
  newTournamentName,
  creatingTournament,
  playerStats,
  matches,
  showPodium,
  onShowPodium,
  onShowCreateTournament,
  onShowCloseTournamentDialog,
  onNewTournamentNameChange,
  onCreateTournament,
  onCloseTournament,
}: ReglasTabProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && theme === "dark"

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Torneos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  t.id === selectedTournamentId
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.closed_at
                      ? `Cerrado el ${new Date(t.closed_at).toLocaleDateString("es-ES")}`
                      : "Activo"}
                  </div>
                </div>
                <div className="text-lg">{t.closed_at ? "🔒" : "🟢"}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onShowCreateTournament(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Torneo
            </Button>
            {selectedTournament && !selectedTournament.closed_at && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onShowCloseTournamentDialog(true)}
              >
                🔒 Cerrar Torneo
              </Button>
            )}
            {selectedTournament?.closed_at && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onShowPodium(true)}
              >
                <Trophy className="w-4 h-4 mr-2" />
                Ver Podio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreateTournament} onOpenChange={onShowCreateTournament}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Torneo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tournament-name">Nombre del torneo</Label>
              <Input
                id="tournament-name"
                placeholder="Ej: Temporada Invierno 2026"
                value={newTournamentName}
                onChange={(e) => onNewTournamentNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCreateTournament()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onShowCreateTournament(false)
                onNewTournamentNameChange("")
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={onCreateTournament}
              disabled={creatingTournament || !newTournamentName.trim()}
            >
              {creatingTournament ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseTournamentDialog} onOpenChange={onShowCloseTournamentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar el torneo?</AlertDialogTitle>
            <AlertDialogDescription>
              Cerrarás <strong>{selectedTournament?.name}</strong>. No se podrán agregar nuevas
              partidas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onCloseTournament}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {creatingTournament ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cerrar Torneo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2" suppressHydrationWarning>
            <span className="text-sm">☀️</span>
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Cambiar tema"
            />
            <span className="text-sm">🌙</span>
            <span className="ml-2 text-sm" suppressHydrationWarning>
              Tema {mounted ? (isDark ? "oscuro" : "claro") : ""}
            </span>
          </div>

          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Reglas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>
              •{" "}
              <strong>
                El ranking anual se ordena por dinero ganado neto acumulado (de mayor a menor)
              </strong>
            </li>
            <li>
              • En caso de empate en dinero ganado total, gana quien tenga más puntos
              acumulados
            </li>
            <li>• Los puntos son una métrica secundaria que premia las buenas posiciones</li>
            <li>• Dentro de cada partida, las posiciones se determinan por dinero ganado neto</li>
            <li>
              • En caso de empate en dinero ganado dentro de una partida, gana quien pidió
              menos cajitas
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sistema de Puntos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="border-b">
                  <th className="py-3 px-4">Posición</th>
                  <th className="py-3 px-4">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((position) => (
                  <tr key={position} className="border-b">
                    <td className="py-3 px-4 font-semibold">{position}°</td>
                    <td className="py-3 px-4 font-bold text-lg">
                      {POINTS_DISTRIBUTION[position - 1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Glosario de Estadísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li>
              <strong>🔥 Racha actual</strong> — Cantidad de partidas consecutivas con el mismo
              resultado (ganadas o perdidas, según la última). Se corta cuando cambia el signo
              del dinero ganado.
            </li>
            <li>
              <strong>Mejor racha</strong> — La cadena más larga de partidas ganadas
              consecutivas en toda la historia del jugador.
            </li>
            <li>
              <strong>⚔️ Némesis</strong> — El oponente al que más le fue mejor que a vos en
              partidas compartidas. Por cada partida en común se calcula el diferencial{" "}
              <em>(dinero ganado del oponente − dinero ganado tuyo)</em> y se acumula. Gana el
              que tiene el diferencial positivo más alto contra vos (mínimo 3 partidas
              compartidas).
            </li>
            <li>
              <strong>Mejor / Peor partida</strong> — La partida con mayor ganancia y la de
              mayor pérdida del jugador, con la posición y el monto.
            </li>
            <li>
              <strong>📅 Día favorito</strong> — El día de la semana donde el jugador acumula
              más ganancia neta (mínimo 2 partidas en ese día, neto positivo).
            </li>
            <li>
              <strong>🚀 Killer move</strong> — La partida con mejor ROI relativo del jugador:
              donde menos invirtió en proporción a lo que ganó. Premia la eficiencia, no el
              monto absoluto.
            </li>
            <li>
              <strong>🎢 ROI por partida</strong> — Curva del retorno (ganancia ÷ inversión)
              de cada partida individual a lo largo del tiempo. Una línea por jugador.
            </li>
            <li>
              <strong>🏆 Top 3 Ganadores</strong> — Los tres jugadores con más victorias (1°
              puesto). Se muestra también el pozo más alto que ganaron alguna vez.
            </li>
            <li>
              <strong>📈 Evolución de Posiciones</strong> — La trayectoria del ranking de cada
              jugador fecha tras fecha, ordenable por dinero o por puntos.
            </li>
            <li>
              <strong>💰 Mejores Partidas / 💸 Peores Partidas</strong> — Las 3 partidas
              individuales (jugador-fecha) con mayor ganancia y mayor pérdida en toda la
              historia.
            </li>
            <li>
              <strong>Eficiencia vs Inversión</strong> — Cuadrantes que cruzan el ROI lifetime
              (dinero ganado ÷ dinero invertido en cajitas) con el promedio de cajitas por
              partida: <em>Genio</em> (ROI ≥ 0, pocas cajitas), <em>Apostador</em> (ROI ≥ 0,
              muchas cajitas), <em>Conservador</em> (ROI {"<"} 0, pocas cajitas),{" "}
              <em>Temerario</em> (ROI {"<"} 0, muchas cajitas).
            </li>
          </ul>
        </CardContent>
      </Card>

      <TournamentClosingPodium
        open={showPodium}
        onOpenChange={onShowPodium}
        tournament={selectedTournament}
        playerStats={playerStats}
        matches={matches}
      />
    </div>
  )
}
