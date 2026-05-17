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
import { POINTS_CONFIG_PRESETS, POINTS_DISTRIBUTION } from "@/lib/constants"
import type {
  MatchWithPlayers,
  Player,
  PlayerStats,
  Tournament,
} from "@/lib/types"
import { X } from "lucide-react"
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
  allPlayers: Player[]
  roster: Player[]
  onShowPodium: (show: boolean) => void
  onShowCreateTournament: (show: boolean) => void
  onShowCloseTournamentDialog: (show: boolean) => void
  onNewTournamentNameChange: (name: string) => void
  onCreateTournament: (pointsConfig: number[], rosterIds: string[]) => void
  onCloseTournament: () => void
  onAddPlayerToRoster: (playerId: string) => Promise<void>
  onRemovePlayerFromRoster: (playerId: string) => Promise<void>
  onCreateAndAddPlayer: (name: string) => Promise<void>
}

const DEFAULT_CONFIG: number[] = [...POINTS_CONFIG_PRESETS["Clásico"]]

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
  allPlayers,
  roster,
  onShowPodium,
  onShowCreateTournament,
  onShowCloseTournamentDialog,
  onNewTournamentNameChange,
  onCreateTournament,
  onCloseTournament,
  onAddPlayerToRoster,
  onRemovePlayerFromRoster,
  onCreateAndAddPlayer,
}: ReglasTabProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && theme === "dark"

  const [pointsConfig, setPointsConfig] = useState<number[]>(DEFAULT_CONFIG)
  const [createRoster, setCreateRoster] = useState<Set<string>>(new Set())
  const handleOpenChangeCreate = (open: boolean) => {
    if (!open) {
      setPointsConfig(DEFAULT_CONFIG)
      setCreateRoster(new Set())
      onNewTournamentNameChange("")
    }
    onShowCreateTournament(open)
  }
  const submitCreate = () => {
    if (creatingTournament || !newTournamentName.trim()) return
    onCreateTournament(pointsConfig, Array.from(createRoster))
  }
  const toggleCreateRoster = (playerId: string) => {
    setCreateRoster((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  // Gestión del roster del torneo seleccionado.
  const isTournamentClosed = !!selectedTournament?.closed_at
  const rosterIds = new Set(roster.map((p) => p.id))
  const availableToAdd = allPlayers.filter((p) => !rosterIds.has(p.id))
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState("")
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null)
  const [creatingNewPlayer, setCreatingNewPlayer] = useState(false)

  const addExisting = async (id: string) => {
    setBusyPlayerId(id)
    try {
      await onAddPlayerToRoster(id)
    } finally {
      setBusyPlayerId(null)
    }
  }
  const removeFromRoster = async (id: string) => {
    setBusyPlayerId(id)
    try {
      await onRemovePlayerFromRoster(id)
    } finally {
      setBusyPlayerId(null)
    }
  }
  const createAndAdd = async () => {
    const name = newPlayerName.trim()
    if (!name || creatingNewPlayer) return
    setCreatingNewPlayer(true)
    try {
      await onCreateAndAddPlayer(name)
      setNewPlayerName("")
      setShowAddPlayer(false)
    } finally {
      setCreatingNewPlayer(false)
    }
  }
  const presetMatch = (cfg: number[]): string | null => {
    for (const [name, preset] of Object.entries(POINTS_CONFIG_PRESETS)) {
      if (preset.length === cfg.length && preset.every((v, i) => v === cfg[i])) {
        return name
      }
    }
    return null
  }
  const activePreset = presetMatch(pointsConfig)
  const activePoints =
    selectedTournament?.points_config ?? [...POINTS_DISTRIBUTION]

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

      {selectedTournament && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Jugadores del torneo</CardTitle>
            <p className="text-xs text-muted-foreground">
              Roster de <span className="font-medium">{selectedTournament.name}</span>.
              Solo estos jugadores aparecen al cargar partidas.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                El torneo no tiene jugadores todavía.
              </p>
            ) : (
              <div className="space-y-2">
                {roster.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between pl-4 pr-2 py-2 rounded-lg border"
                  >
                    <span className="text-base font-medium">{p.name}</span>
                    {!isTournamentClosed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromRoster(p.id)}
                        disabled={busyPlayerId === p.id}
                        aria-label={`Quitar ${p.name}`}
                      >
                        {busyPlayerId === p.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isTournamentClosed && (
              <>
                {availableToAdd.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs text-muted-foreground">
                      Agregar jugador existente
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {availableToAdd.map((p) => (
                        <Button
                          key={p.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addExisting(p.id)}
                          disabled={busyPlayerId === p.id}
                        >
                          {busyPlayerId === p.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Plus className="w-3 h-3 mr-1" />
                          )}
                          {p.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  {showAddPlayer ? (
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        placeholder="Nombre del nuevo jugador"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") createAndAdd()
                          if (e.key === "Escape") {
                            setShowAddPlayer(false)
                            setNewPlayerName("")
                          }
                        }}
                      />
                      <Button
                        onClick={createAndAdd}
                        disabled={!newPlayerName.trim() || creatingNewPlayer}
                      >
                        {creatingNewPlayer ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Crear"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddPlayer(false)
                          setNewPlayerName("")
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowAddPlayer(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear nuevo jugador
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateTournament} onOpenChange={handleOpenChangeCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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
                  if (e.key === "Enter") submitCreate()
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Distribución de puntos</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(POINTS_CONFIG_PRESETS).map(([name, preset]) => (
                  <Button
                    key={name}
                    type="button"
                    variant={activePreset === name ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPointsConfig([...preset])}
                  >
                    {name}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {pointsConfig.map((value, i) => (
                  <div key={i} className="space-y-1">
                    <Label
                      htmlFor={`points-${i}`}
                      className="text-xs text-muted-foreground"
                    >
                      {i + 1}°
                    </Label>
                    <Input
                      id={`points-${i}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={value}
                      onChange={(e) => {
                        const next = [...pointsConfig]
                        next[i] = Math.max(0, Number(e.target.value) || 0)
                        setPointsConfig(next)
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Los puntos no pueden subir en una posición inferior. Una vez creado
                el torneo, la distribución queda fija.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Jugadores del torneo</Label>
              {allPlayers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todavía no hay jugadores creados. Podés agregarlos después desde la
                  gestión del roster.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allPlayers.map((p) => {
                    const selected = createRoster.has(p.id)
                    return (
                      <Button
                        key={p.id}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleCreateRoster(p.id)}
                      >
                        {p.name}
                      </Button>
                    )
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {createRoster.size === 0
                  ? "Sin selección: el torneo arranca con roster vacío y lo armás después."
                  : `${createRoster.size} jugador${createRoster.size === 1 ? "" : "es"} seleccionado${createRoster.size === 1 ? "" : "s"}.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChangeCreate(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitCreate}
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
          {selectedTournament && (
            <p className="text-xs text-muted-foreground">
              Configuración del torneo{" "}
              <span className="font-medium">{selectedTournament.name}</span>
            </p>
          )}
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
                      {activePoints[position - 1] ?? 0}
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
          <dl className="divide-y divide-border">
            <div className="py-3 first:pt-0">
              <dt className="text-sm font-semibold mb-1">🔥 Racha actual</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Cantidad de partidas consecutivas con el mismo resultado (ganadas o
                perdidas, según la última). Se corta cuando cambia el signo del dinero
                ganado.
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">Mejor racha</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                La cadena más larga de partidas ganadas consecutivas en toda la historia
                del jugador.
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">⚔️ Némesis</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                El oponente al que más le fue mejor que a vos en partidas compartidas.
                Por cada partida en común se calcula el diferencial{" "}
                <em>(dinero ganado del oponente − dinero ganado tuyo)</em> y se acumula.
                Gana el que tiene el diferencial positivo más alto contra vos (mínimo 3
                partidas compartidas).
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">Mejor / Peor partida</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                La partida con mayor ganancia y la de mayor pérdida del jugador, con la
                posición y el monto.
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">📅 Día favorito</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                El día de la semana donde el jugador acumula más ganancia neta (mínimo
                2 partidas en ese día, neto positivo).
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">🚀 Killer move</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                La partida con mejor ROI relativo del jugador: donde menos invirtió en
                proporción a lo que ganó. Premia la eficiencia, no el monto absoluto.
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">🎢 ROI por partida</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Curva del retorno (ganancia ÷ inversión) de cada partida individual a lo
                largo del tiempo. Una línea por jugador.
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">🏆 Top 3 Ganadores</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Los tres jugadores con más victorias (1° puesto). Se muestra también el
                pozo más alto que ganaron alguna vez.
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">📈 Evolución de Posiciones</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                La trayectoria del ranking de cada jugador fecha tras fecha, ordenable
                por dinero o por puntos.
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-sm font-semibold mb-1">
                💰 Mejores Partidas / 💸 Peores Partidas
              </dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Las 3 partidas individuales (jugador-fecha) con mayor ganancia y mayor
                pérdida en toda la historia.
              </dd>
            </div>
            <div className="py-3 last:pb-0">
              <dt className="text-sm font-semibold mb-1">Eficiencia vs Inversión</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Cuadrantes que cruzan el ROI lifetime (dinero ganado ÷ dinero invertido
                  en cajitas) con el promedio de cajitas por partida.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pl-0">
                  <li>
                    <span className="font-medium text-foreground">Genio</span> — ROI ≥ 0,
                    pocas cajitas
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Apostador</span> — ROI
                    ≥ 0, muchas cajitas
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Conservador</span> —
                    ROI {"<"} 0, pocas cajitas
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Temerario</span> — ROI{" "}
                    {"<"} 0, muchas cajitas
                  </li>
                </ul>
              </dd>
            </div>
          </dl>
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
