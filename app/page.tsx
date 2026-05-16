"use client"

import { useState, useEffect, Suspense, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Trophy,
  Loader2,
  NotebookPen,
  AlertCircle,
  BarChart3,
  BookOpen,
} from "lucide-react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import * as db from "@/lib/database"
import type {
  Player,
  MatchWithPlayers,
  PlayerStats,
  ActiveMatch,
  Tournament,
} from "@/lib/types"
import { PWAInstall } from "@/components/pwa-install"
import { OfflineIndicator } from "@/components/offline-indicator"
import { useRouter, useSearchParams } from "next/navigation"
import { RankingTab } from "@/components/tabs/ranking-tab"
import { PartidasTab } from "@/components/tabs/partidas-tab"
import { EstadisticasTab } from "@/components/tabs/estadisticas-tab"
import { ReglasTab } from "@/components/tabs/reglas-tab"
import { getTodayLocalDate } from "@/lib/formatters"
import { sortPlayerStats, type SortBy } from "@/lib/stats"

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
)

type TabId = "ranking" | "partidas" | "estadisticas" | "reglas"

const TABS: { id: TabId; label: string }[] = [
  { id: "ranking", label: "Ranking Anual" },
  { id: "partidas", label: "Partidas" },
  { id: "estadisticas", label: "Estadísticas" },
  { id: "reglas", label: "Reglas" },
]

function LaCajitaPoker() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>("ranking")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null)
  const [activeMatchToDelete, setActiveMatchToDelete] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null)
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set())
  const [expandedPlayerCards, setExpandedPlayerCards] = useState<Set<string>>(new Set())
  const [rankingSortBy, setRankingSortBy] = useState<SortBy>("money")
  const [evolutionSortBy, setEvolutionSortBy] = useState<SortBy>("money")

  // Tournaments
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [showCreateTournament, setShowCreateTournament] = useState(false)
  const [newTournamentName, setNewTournamentName] = useState("")
  const [creatingTournament, setCreatingTournament] = useState(false)
  const [showCloseTournamentDialog, setShowCloseTournamentDialog] = useState(false)

  // Data
  const [_players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([])

  useEffect(() => {
    testConnectionAndLoadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const tabParam = searchParams?.get("tab") as TabId | null
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const testConnectionAndLoadData = async () => {
    const isConnected = await db.testConnection()
    setConnectionStatus(isConnected)
    if (isConnected) {
      const tournamentsData = await db.getTournaments()
      setTournaments(tournamentsData)
      const mostRecentId = tournamentsData[0]?.id || null
      setSelectedTournamentId(mostRecentId)
      if (mostRecentId) await loadAllData(mostRecentId)
    } else {
      setError("No se pudo conectar a la base de datos. Verifica tu conexión.")
    }
  }

  const loadAllData = async (tournamentId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [playersData, matchesData, statsData, activeMatchesData] = await Promise.all([
        db.getAllPlayers(),
        db.getAllMatches(tournamentId),
        db.getPlayerStats(tournamentId),
        db.getAllActiveMatches(tournamentId),
      ])
      setPlayers(playersData)
      setMatches(matchesData)
      setPlayerStats(statsData)
      setActiveMatches(activeMatchesData)
      setConnectionStatus(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data")
      setConnectionStatus(false)
    } finally {
      setLoading(false)
    }
  }

  const refreshData = async () => {
    if (selectedTournamentId) await loadAllData(selectedTournamentId)
  }

  const handleTournamentChange = async (tournamentId: string) => {
    setSelectedTournamentId(tournamentId)
    await loadAllData(tournamentId)
  }

  const handleCreateTournament = async () => {
    if (!newTournamentName.trim()) return
    setCreatingTournament(true)
    try {
      const created = await db.createTournament(newTournamentName.trim())
      const tournamentsData = await db.getTournaments()
      setTournaments(tournamentsData)
      setShowCreateTournament(false)
      setNewTournamentName("")
      setSelectedTournamentId(created.id)
      await loadAllData(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando torneo")
    } finally {
      setCreatingTournament(false)
    }
  }

  const handleCloseTournament = async () => {
    if (!selectedTournamentId) return
    setCreatingTournament(true)
    try {
      await db.closeTournament(selectedTournamentId)
      const tournamentsData = await db.getTournaments()
      setTournaments(tournamentsData)
      setShowCloseTournamentDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cerrando torneo")
    } finally {
      setCreatingTournament(false)
    }
  }

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId)
  const isTournamentClosed = !!selectedTournament?.closed_at

  const createNewActiveMatch = async () => {
    if (!selectedTournamentId) return
    setLoading(true)
    setError(null)
    try {
      const newMatch = await db.createActiveMatch({
        date: getTodayLocalDate(),
        cajiValue: 2000,
        playerCount: 4,
        tournamentId: selectedTournamentId,
        players: Array(4)
          .fill(null)
          .map(() => ({
            name: "",
            cajitas: 1,
            finalChips: 0,
            moneyWon: -2000,
          })),
      })
      router.push(`/partidas/${newMatch.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating active match")
    } finally {
      setLoading(false)
    }
  }

  const editActiveMatch = (matchId: string) => router.push(`/partidas/${matchId}`)

  const deleteActiveMatch = async (matchId: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deleteActiveMatch(matchId)
      if (selectedTournamentId) {
        const activeMatchesData = await db.getAllActiveMatches(selectedTournamentId)
        setActiveMatches(activeMatchesData)
      }
      setActiveMatchToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting active match")
    } finally {
      setLoading(false)
    }
  }

  const confirmDeleteActiveMatch = () => {
    if (activeMatchToDelete) deleteActiveMatch(activeMatchToDelete)
  }

  const confirmDeleteMatch = (matchId: string) => setMatchToDelete(matchId)

  const deleteMatch = async () => {
    if (!matchToDelete || !selectedTournamentId) return
    setLoading(true)
    try {
      await db.deleteMatch(matchToDelete)
      await loadAllData(selectedTournamentId)
      setMatchToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting match")
    } finally {
      setLoading(false)
    }
  }

  const toggleMatchExpansion = (matchId: string) => {
    setExpandedMatches((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  }

  const togglePlayerCard = (playerId: string) => {
    setExpandedPlayerCards((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  const sortedPlayerStats = useMemo(
    () => sortPlayerStats(playerStats, rankingSortBy),
    [playerStats, rankingSortBy],
  )

  if (loading && matches.length === 0 && activeMatches.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Cargando datos...</p>
          {connectionStatus === false && (
            <div className="mt-4 p-4 border rounded-lg">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p>Problema de conexión detectado</p>
              <Button onClick={testConnectionAndLoadData} className="mt-2">
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-around items-center">
            <h1 className="text-xl md:text-2xl font-bold">♠️</h1>
            <h1 className="text-xl md:text-2xl font-bold">♥️</h1>
            <h1 className="text-xl md:text-2xl font-bold">La Cajita</h1>
            <h1 className="text-xl md:text-2xl font-bold">♦️</h1>
            <h1 className="text-xl md:text-2xl font-bold">♣️</h1>
          </div>
          {tournaments.length > 0 && (
            <div className="flex justify-center mt-3">
              <Select
                value={selectedTournamentId || ""}
                onValueChange={handleTournamentChange}
              >
                <SelectTrigger className="w-56 text-sm">
                  <SelectValue placeholder="Seleccionar torneo" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.closed_at ? " 🔒" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5" />
                <p className="font-semibold">Error</p>
              </div>
              <p className="mb-3">{error}</p>
              <div className="flex gap-2">
                <Button onClick={() => setError(null)} variant="outline" size="sm">
                  Cerrar
                </Button>
                <Button onClick={refreshData} size="sm">
                  Reintentar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {matchToDelete && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle className="text-xl">Confirmar Eliminación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  ¿Estás seguro de que quieres eliminar esta partida? Esta acción no se puede
                  deshacer.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setMatchToDelete(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={deleteMatch} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Eliminando...
                      </>
                    ) : (
                      "Eliminar"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "ranking" && (
          <RankingTab
            activeMatches={activeMatches}
            sortedPlayerStats={sortedPlayerStats}
            rankingSortBy={rankingSortBy}
            onRankingSortChange={setRankingSortBy}
            loading={loading}
            onContinueActive={editActiveMatch}
            onDeleteActive={setActiveMatchToDelete}
          />
        )}

        {activeTab === "partidas" && (
          <PartidasTab
            matches={matches}
            activeMatches={activeMatches}
            expandedMatches={expandedMatches}
            loading={loading}
            isTournamentClosed={isTournamentClosed}
            onToggleExpand={toggleMatchExpansion}
            onCreateActive={createNewActiveMatch}
            onContinueActive={editActiveMatch}
            onDeleteActive={setActiveMatchToDelete}
            onConfirmDeleteMatch={confirmDeleteMatch}
            onRefresh={refreshData}
          />
        )}

        {activeTab === "estadisticas" && (
          <EstadisticasTab
            matches={matches}
            sortedPlayerStats={sortedPlayerStats}
            expandedPlayerCards={expandedPlayerCards}
            evolutionSortBy={evolutionSortBy}
            onTogglePlayerCard={togglePlayerCard}
            onEvolutionSortChange={setEvolutionSortBy}
          />
        )}

        {activeTab === "reglas" && (
          <ReglasTab
            tournaments={tournaments}
            selectedTournamentId={selectedTournamentId}
            selectedTournament={selectedTournament}
            showCreateTournament={showCreateTournament}
            showCloseTournamentDialog={showCloseTournamentDialog}
            newTournamentName={newTournamentName}
            creatingTournament={creatingTournament}
            onShowCreateTournament={setShowCreateTournament}
            onShowCloseTournamentDialog={setShowCloseTournamentDialog}
            onNewTournamentNameChange={setNewTournamentName}
            onCreateTournament={handleCreateTournament}
            onCloseTournament={handleCloseTournament}
          />
        )}
      </div>

      <div className="fixed p-0 bottom-0 left-0 right-0 h-20 backdrop-blur-sm border-t z-50">
        <div className="flex justify-around items-center h-full p-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center w-32 h-full transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.id === "ranking" && <Trophy className="w-7 h-7" />}
              {tab.id === "partidas" && <NotebookPen className="w-7 h-7" />}
              {tab.id === "estadisticas" && <BarChart3 className="w-7 h-7" />}
              {tab.id === "reglas" && <BookOpen className="w-7 h-7" />}
            </button>
          ))}
        </div>
      </div>

      <AlertDialog
        open={!!activeMatchToDelete}
        onOpenChange={() => setActiveMatchToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar partida activa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la partida activa
              y todos sus datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteActiveMatch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PWAInstall />
      <OfflineIndicator />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Cargando...</p>
          </div>
        </div>
      }
    >
      <LaCajitaPoker />
    </Suspense>
  )
}
