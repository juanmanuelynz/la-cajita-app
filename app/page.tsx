"use client"

import { SUIT_RED } from "@/components/training/playing-card"
import { useState, useEffect, useRef, Suspense, useMemo, useCallback, type ComponentType } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  AlertCircle,
  BarChart3,
  Settings,
  Brain,
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
import { ChipSpinner } from "@/components/poker-chip"
import { TournamentLine } from "@/components/tournament-line"
import { SpadeGlyph } from "@/components/spade-glyph"
import { MatchSummary } from "@/components/match-summary"
import type {
  MatchWithPlayers,
  Player,
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
import { EntrenarTab } from "@/components/tabs/entrenar-tab"
import { getTodayLocalDate } from "@/lib/formatters"
import { sortPlayerStats, type SortBy } from "@/lib/stats"
import type { RankingScope } from "@/components/tabs/ranking-tab"
import type { AuthRole } from "@/lib/auth"
import { AjustesCard } from "@/components/ajustes-card"
import { TrucoPromo } from "@/components/truco/truco-promo"
import { SplashScreen } from "@/components/splash-screen"
import { LogoType } from "@/components/logo-type"
import { getLastApp, setLastApp } from "@/lib/last-app"
import { markAppBooted } from "@/lib/app-boot"
import { DockNav, type DockTab } from "@/components/dock-nav"

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

type TabId = "ranking" | "partidas" | "estadisticas" | "entrenar" | "reglas"


// En el orden de la barra (y del deslizar entre pestañas). Partidas va al centro,
// como botón grande: es lo que más se usa en una noche de juego.
// Partidas, el botón grande del centro, va con una pica rellena.
const CENTER_ICON: ComponentType<{ className?: string }> = SpadeGlyph
const TABS: DockTab<TabId>[] = [
  { id: "ranking", label: "Ranking Anual", short: "Ranking", icon: Trophy },
  { id: "estadisticas", label: "Estadísticas", short: "Estadísticas", icon: BarChart3 },
  { id: "partidas", label: "Partidas", short: "Partidas", icon: CENTER_ICON },
  { id: "entrenar", label: "Entrenar", short: "Entrenar", icon: Brain },
  // El id sigue siendo "reglas" para no romper links con ?tab=reglas.
  { id: "reglas", label: "Configuración", short: "Ajustes", icon: Settings },
]

// El invitado (GUEST_PIN) solo ve sus sueltas, Entrenar y los Ajustes (con el logout).
const GUEST_TABS: typeof TABS = [
  { id: "entrenar", label: "Entrenar", short: "Entrenar", icon: Brain },
  { id: "partidas", label: "Partidas", short: "Partidas", icon: CENTER_ICON },
  { id: "reglas", label: "Configuración", short: "Ajustes", icon: Settings },
]

function LaCajitaPoker() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [role, setRole] = useState<AuthRole | null>(null)
  const isGuest = role === "guest"
  const tabs = isGuest ? GUEST_TABS : TABS
  const [activeTab, setActiveTab] = useState<TabId>("ranking")
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    containScroll: "trimSnaps",
    duration: 20,
    // Sin deslizar para cambiar de pantalla: se cambia con la barra de abajo, y
    // así lo que se desliza de costado adentro de una pantalla no choca.
    watchDrag: false,
  })

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap()
      const next = tabs[idx]?.id
      if (next) setActiveTab(next)
    }
    emblaApi.on("select", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi, tabs])

  // Al cambiar la cantidad de pantallas (invitado), Embla tiene que medir de nuevo.
  useEffect(() => {
    emblaApi?.reInit()
  }, [emblaApi, tabs])

  // Si la pestaña elegida no existe para este rol, ir a Partidas (el invitado arranca en sus sueltas).
  useEffect(() => {
    if (role && !tabs.some((t) => t.id === activeTab)) setActiveTab("partidas")
  }, [role, tabs, activeTab])

  useEffect(() => {
    if (!emblaApi) return
    const idx = tabs.findIndex((t) => t.id === activeTab)
    if (idx >= 0 && emblaApi.selectedScrollSnap() !== idx) {
      emblaApi.scrollTo(idx)
    }
  }, [activeTab, emblaApi, tabs])

  const [loading, setLoading] = useState(false)
  // Splash: tapa todo hasta que termina la primera carga (rol + datos), así no
  // se ve la ficha, media pantalla y la ficha otra vez. Después se va con un fundido.
  const [booted, setBooted] = useState(false)
  const [splashLeaving, setSplashLeaving] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null)
  const [activeMatchToDelete, setActiveMatchToDelete] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null)
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set())
  const [expandedPlayerCards, setExpandedPlayerCards] = useState<Set<string>>(new Set())
  const [rankingSortBy, setRankingSortBy] = useState<SortBy>("money")
  const [evolutionSortBy, setEvolutionSortBy] = useState<SortBy>("money")
  const [rankingScope, setRankingScope] = useState<RankingScope>("torneo")
  const [allTimeStats, setAllTimeStats] = useState<PlayerStats[]>([])

  // Tournaments
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [showCreateTournament, setShowCreateTournament] = useState(false)
  const [newTournamentName, setNewTournamentName] = useState("")
  const [creatingTournament, setCreatingTournament] = useState(false)
  const [showCloseTournamentDialog, setShowCloseTournamentDialog] = useState(false)
  const [showPodium, setShowPodium] = useState(false)
  // Resumen animado de una partida ("Fin de la partida").
  const [summaryMatchId, setSummaryMatchId] = useState<string | null>(null)

  // Data
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [roster, setRoster] = useState<Player[]>([])
  // Sueltas: no pertenecen a ningún torneo, se cargan aparte.
  const [casualMatches, setCasualMatches] = useState<MatchWithPlayers[]>([])
  const [casualActiveMatches, setCasualActiveMatches] = useState<ActiveMatch[]>([])

  /** Sueltas + jugadores: lo único que ve el invitado (y que el admin ve aparte). */
  const loadCasualData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [casualData, casualActiveData, allPlayersData] = await Promise.all([
        db.getCasualMatches(),
        db.getCasualActiveMatches(),
        db.getAllPlayers(),
      ])
      setCasualMatches(casualData)
      setCasualActiveMatches(casualActiveData)
      setAllPlayers(allPlayersData)
      setConnectionStatus(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data")
      setConnectionStatus(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAllData = useCallback(async (tournamentId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [
        matchesData,
        statsData,
        activeMatchesData,
        rosterData,
        allPlayersData,
        casualData,
        casualActiveData,
      ] = await Promise.all([
        db.getAllMatches(tournamentId),
        db.getPlayerStats(tournamentId),
        db.getAllActiveMatches(tournamentId),
        db.getTournamentRoster(tournamentId),
        db.getAllPlayers(),
        db.getCasualMatches(),
        db.getCasualActiveMatches(),
      ])
      setCasualMatches(casualData)
      setCasualActiveMatches(casualActiveData)
      setMatches(matchesData)
      setPlayerStats(statsData)
      setActiveMatches(activeMatchesData)
      setRoster(rosterData)
      setAllPlayers(allPlayersData)
      setConnectionStatus(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data")
      setConnectionStatus(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshRoster = async () => {
    if (!selectedTournamentId) return
    const [rosterData, allPlayersData] = await Promise.all([
      db.getTournamentRoster(selectedTournamentId),
      db.getAllPlayers(),
    ])
    setRoster(rosterData)
    setAllPlayers(allPlayersData)
  }

  const handleAddPlayerToRoster = async (playerId: string) => {
    if (!selectedTournamentId) return
    await db.addPlayerToTournament(selectedTournamentId, playerId)
    await refreshRoster()
  }

  const handleRemovePlayerFromRoster = async (playerId: string) => {
    if (!selectedTournamentId) return
    await db.removePlayerFromTournament(selectedTournamentId, playerId)
    await refreshRoster()
  }

  const handleCreateAndAddPlayer = async (name: string) => {
    if (!selectedTournamentId) return
    await db.createPlayer(name, selectedTournamentId)
    await refreshRoster()
  }

  // Alta de jugador desde Entrenar: no lo suma a ningún torneo.
  const handleCreateTrainingPlayer = async (name: string): Promise<Player> => {
    const created = await db.createPlayer(name)
    setAllPlayers(await db.getAllPlayers())
    return created
  }

  const initializeApp = useCallback(async () => {
    try {
      const sessionRole = await db.getSessionRole()
      setRole(sessionRole)
      if (sessionRole === "guest") {
        await loadCasualData()
        return
      }
      const tournamentsData = await db.getTournaments()
      setTournaments(tournamentsData)
      const mostRecentId = tournamentsData[0]?.id || null
      setSelectedTournamentId(mostRecentId)
      if (mostRecentId) {
        await loadAllData(mostRecentId)
      } else {
        // Sin torneos igual se pueden jugar sueltas.
        await loadCasualData()
      }
    } catch (err) {
      setConnectionStatus(false)
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo conectar a la base de datos. Verifica tu conexión.",
      )
    } finally {
      setBooted(true)
    }
  }, [loadAllData, loadCasualData])

  useEffect(() => {
    if (booted) markAppBooted()
    if (!booted || splashDone) return
    // Un cuadro con el splash encima de la app ya armada, y recién ahí el fundido.
    const raf = requestAnimationFrame(() => setSplashLeaving(true))
    const t = setTimeout(() => setSplashDone(true), 400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [booted, splashDone])

  useEffect(() => {
    // Si la última vez estabas en Truco, la app abre ahí (el splash sigue mientras tanto).
    if (getLastApp() === "truco") {
      router.replace("/truco")
      return
    }
    setLastApp("poker")
    void initializeApp()
  }, [initializeApp, router])

  useEffect(() => {
    const tabParam = searchParams?.get("tab") as TabId | null
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      // Si el invitado llega con una pestaña que no tiene, el efecto de
      // arriba lo manda a la primera.
      setActiveTab(tabParam)
    }
    // ?resumen=<matchId> llega al registrar una partida: abrimos el resumen
    // y limpiamos el parámetro para que no se reabra al refrescar.
    const resumen = searchParams?.get("resumen")
    if (resumen) {
      setSummaryMatchId(resumen)
      router.replace(tabParam ? `/?tab=${tabParam}` : "/", { scroll: false })
    }
  }, [searchParams, router])

  // El toggle histórico vuelve a "torneo actual" al salir del tab Ranking.
  useEffect(() => {
    if (activeTab !== "ranking") setRankingScope("torneo")
  }, [activeTab])

  useEffect(() => {
    if (rankingScope !== "historico") return
    let cancelled = false
    db.getAllTimeStats()
      .then((stats) => {
        if (!cancelled) setAllTimeStats(stats)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Error cargando histórico")
        setRankingScope("torneo")
      })
    return () => {
      cancelled = true
    }
  }, [rankingScope])

  const refreshData = async () => {
    if (!isGuest && selectedTournamentId) await loadAllData(selectedTournamentId)
    else await loadCasualData()
  }

  // Al volver a la app después de un rato (otro pudo cargar una partida), refrescar solo.
  const refreshRef = useRef(refreshData)
  refreshRef.current = refreshData
  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 30_000) void refreshRef.current()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  // Tocar el nombre del torneo lleva a Ajustes → Torneo, donde se elige.
  const [torneoSignal, setTorneoSignal] = useState(0)
  const openTournaments = () => {
    setActiveTab("reglas")
    setTorneoSignal((n) => n + 1)
  }

  const handleTournamentChange = async (tournamentId: string) => {
    setSelectedTournamentId(tournamentId)
    await loadAllData(tournamentId)
  }

  const handleCreateTournament = async (
    pointsConfig: number[],
    rosterIds: string[],
  ) => {
    if (!newTournamentName.trim()) return
    setCreatingTournament(true)
    try {
      const created = await db.createTournament(
        newTournamentName.trim(),
        pointsConfig,
        rosterIds,
      )
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
      setShowPodium(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cerrando torneo")
    } finally {
      setCreatingTournament(false)
    }
  }

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId)
  const isTournamentClosed = !!selectedTournament?.closed_at
  const tournamentLine = (title?: boolean) =>
    selectedTournament ? (
      <TournamentLine
        title={title}
        name={selectedTournament.name}
        closed={isTournamentClosed}
        loading={loading}
        onOpen={openTournaments}
        onRefresh={refreshData}
      />
    ) : undefined

  // isCasual = partida suelta: se anota igual pero no suma al torneo, así
  // que se permite aunque el torneo esté cerrado.
  const createNewActiveMatch = async (isCasual = false) => {
    // Las sueltas no son de ningún torneo: se crean aunque no haya uno.
    if (!isCasual && !selectedTournamentId) return
    setLoading(true)
    setError(null)
    try {
      const newMatch = await db.createActiveMatch({
        date: getTodayLocalDate(),
        cajiValue: 2000,
        playerCount: 4,
        tournamentId: isCasual ? null : selectedTournamentId,
        isCasual,
        players: Array(4)
          .fill(null)
          .map(() => ({
            name: "",
            cajitas: 1,
            finalChips: 0,
            moneyWon: -2000,
          })),
      })
      // Sin setLoading(false) en el éxito: la mezcla de cartas sigue hasta
      // que se desmonta esta pantalla al navegar a la partida.
      router.push(`/partidas/${newMatch.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating active match")
      setLoading(false)
    }
  }

  const editActiveMatch = (matchId: string) => router.push(`/partidas/${matchId}`)

  const deleteActiveMatch = async (matchId: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deleteActiveMatch(matchId)
      const [activeMatchesData, casualActiveData] = await Promise.all([
        !isGuest && selectedTournamentId
          ? db.getAllActiveMatches(selectedTournamentId)
          : Promise.resolve(activeMatches),
        db.getCasualActiveMatches(),
      ])
      setActiveMatches(activeMatchesData)
      setCasualActiveMatches(casualActiveData)
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
    if (!matchToDelete) return
    setLoading(true)
    try {
      await db.deleteMatch(matchToDelete)
      if (selectedTournamentId) await loadAllData(selectedTournamentId)
      else await loadCasualData()
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

  // Solo las partidas del torneo. getAllMatches ya no trae sueltas, pero el
  // filtro queda por las dudas: no cuentan para ranking, estadísticas ni podio.
  const tournamentMatches = useMemo(
    () => matches.filter((m) => !m.is_casual),
    [matches],
  )

  const summaryMatch = summaryMatchId
    ? (matches.find((m) => m.id === summaryMatchId) ??
      casualMatches.find((m) => m.id === summaryMatchId))
    : undefined
  const closeSummary = useCallback(() => setSummaryMatchId(null), [])

  const sortedPlayerStats = useMemo(
    () => sortPlayerStats(playerStats, rankingSortBy),
    [playerStats, rankingSortBy],
  )

  const sortedAllTimeStats = useMemo(
    () => sortPlayerStats(allTimeStats, rankingSortBy),
    [allTimeStats, rankingSortBy],
  )

  if (!booted) return <SplashScreen />

  if (
    (role === null && connectionStatus !== false) ||
    (loading &&
      matches.length === 0 &&
      activeMatches.length === 0 &&
      casualMatches.length === 0 &&
      casualActiveMatches.length === 0)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ChipSpinner className="w-8 h-8 mx-auto mb-4" />
          <p>Cargando datos...</p>
          {connectionStatus === false && (
            <div className="mt-4 p-4 border rounded-lg">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p>Problema de conexión detectado</p>
              <Button onClick={initializeApp} className="mt-2">
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Una pantalla por pestaña; se muestran las que correspondan al rol.
  const screens: Record<TabId, React.ReactNode> = {
    ranking: (
      <RankingTab
        activeMatches={activeMatches}
        matches={tournamentMatches}
        sortedPlayerStats={
          rankingScope === "historico" ? sortedAllTimeStats : sortedPlayerStats
        }
        rankingScope={rankingScope}
        onRankingScopeChange={setRankingScope}
        rankingSortBy={rankingSortBy}
        onRankingSortChange={setRankingSortBy}
        loading={loading}
        onContinueActive={editActiveMatch}
        onDeleteActive={setActiveMatchToDelete}
        tournamentTitle={tournamentLine(true)}
      />
    ),
    partidas: (
      <PartidasTab
        matches={tournamentMatches}
        activeMatches={activeMatches}
        casualMatches={casualMatches}
        casualActiveMatches={casualActiveMatches}
        guest={isGuest}
        expandedMatches={expandedMatches}
        loading={loading}
        isTournamentClosed={isTournamentClosed}
        onToggleExpand={toggleMatchExpansion}
        onCreateActive={() => createNewActiveMatch(false)}
        onCreateCasual={() => createNewActiveMatch(true)}
        onContinueActive={editActiveMatch}
        onDeleteActive={setActiveMatchToDelete}
        onConfirmDeleteMatch={isGuest ? undefined : confirmDeleteMatch}
        onShowSummary={setSummaryMatchId}
        header={
          isGuest ? (
            <div className="space-y-0.5 text-center">
              <TournamentLine name="Invitado" loading={loading} onRefresh={refreshData} />
              <p className="text-xs text-muted-foreground">
                Como invitado podés anotar partidas sueltas y usar Entrenar.
              </p>
            </div>
          ) : (
            tournamentLine()
          )
        }
      />
    ),
    estadisticas: (
      <EstadisticasTab
        matches={tournamentMatches}
        sortedPlayerStats={sortedPlayerStats}
        expandedPlayerCards={expandedPlayerCards}
        evolutionSortBy={evolutionSortBy}
        onTogglePlayerCard={togglePlayerCard}
        onEvolutionSortChange={setEvolutionSortBy}
        header={tournamentLine()}
      />
    ),
    entrenar: (
      <EntrenarTab players={allPlayers} onCreatePlayer={handleCreateTrainingPlayer} />
    ),
    reglas: isGuest ? (
      <div className="space-y-4 pt-4 pb-8">
        <TrucoPromo />
        <AjustesCard />
      </div>
    ) : (
      <ReglasTab
        tournaments={tournaments}
        selectedTournamentId={selectedTournamentId}
        selectedTournament={selectedTournament}
        showCreateTournament={showCreateTournament}
        showCloseTournamentDialog={showCloseTournamentDialog}
        newTournamentName={newTournamentName}
        creatingTournament={creatingTournament}
        playerStats={playerStats}
        matches={tournamentMatches}
        showPodium={showPodium}
        allPlayers={allPlayers}
        roster={roster}
        onShowPodium={setShowPodium}
        onShowCreateTournament={setShowCreateTournament}
        onShowCloseTournamentDialog={setShowCloseTournamentDialog}
        onNewTournamentNameChange={setNewTournamentName}
        onCreateTournament={handleCreateTournament}
        onCloseTournament={handleCloseTournament}
        onAddPlayerToRoster={handleAddPlayerToRoster}
        onRemovePlayerFromRoster={handleRemovePlayerFromRoster}
        onCreateAndAddPlayer={handleCreateAndAddPlayer}
        onSelectTournament={handleTournamentChange}
        showTorneoSignal={torneoSignal}
      />
    ),
  }

  return (
    <div className="relative h-[100dvh] flex flex-col">
      {/* Header compacto: solo la marca. El torneo y refrescar van dentro de las pantallas donde importan. */}
      {/* Fondo sólido, sin backdrop-blur. ios-pwa-top-gap lo baja en la app instalada de iOS: iOS 27 pone un vidrio borroso arriba (ver globals.css). */}
      <div className="ios-pwa-top-gap border-b bg-background text-foreground flex-shrink-0">
        <div className="container mx-auto flex items-center justify-around px-4 py-2 text-lg font-bold md:text-xl">
          {/* Palos como texto (\uFE0E), no emoji: en el iPhone ♠ y ♣ salían negros sobre el fondo oscuro. Mismo coral que las cartas. */}
          <span aria-hidden>{"♠\uFE0E"}</span>
          <span aria-hidden className={SUIT_RED}>{"♥\uFE0E"}</span>
          <LogoType className="text-[26px]" />
          <span aria-hidden className={SUIT_RED}>{"♦\uFE0E"}</span>
          <span aria-hidden>{"♣\uFE0E"}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 flex-1 min-h-0 flex flex-col">
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

        <AlertDialog
          open={!!matchToDelete}
          onOpenChange={() => setMatchToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar partida?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente la partida y
                todos sus datos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteMatch}
                disabled={loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? (
                  <>
                    <ChipSpinner className="w-4 h-4 mr-2" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="overflow-hidden flex-1 min-h-0" ref={emblaRef}>
          <div className="flex h-full touch-pan-y">
            {tabs.map((tab) => (
              // Abajo deja lugar para la barra flotante, así no tapa lo último de cada pestaña.
              <div key={tab.id} className="flex-[0_0_100%] min-w-0 px-1 h-full overflow-y-auto no-scrollbar pb-[var(--dock-space)]">
                {screens[tab.id]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Barra flotante de vidrio: íconos + nombre; Partidas al centro, como botón grande que sobresale. */}
      <DockNav tabs={tabs} active={activeTab} centerId="partidas" onSelect={setActiveTab} />

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

      {summaryMatch && (
        <MatchSummary
          match={summaryMatch}
          tournamentMatches={tournamentMatches}
          tournamentName={selectedTournament?.name}
          sortBy={rankingSortBy}
          onClose={closeSummary}
        />
      )}

      <PWAInstall />
      <OfflineIndicator />
      {!splashDone && <SplashScreen leaving={splashLeaving} />}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <LaCajitaPoker />
    </Suspense>
  )
}
