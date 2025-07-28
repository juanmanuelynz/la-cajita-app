"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Trash2,
  Trophy,
  Medal,
  Award,
  Plus,
  Loader2,
  ArrowLeft,
  NotebookPen,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  BarChart3,
  BookOpen,
  Cannabis,
  Coins,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { DatabaseService } from "../lib/database"
import type { Player, MatchWithPlayers, PlayerStats, ActiveMatch } from "../lib/supabase"
import { PWAInstall } from "@/components/pwa-install"
import { OfflineIndicator } from "@/components/offline-indicator"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface FormPlayer {
  name: string
  cajitas: number
  finalChips: number
  moneyWon: number
}

const POINTS_DISTRIBUTION = [25, 18, 15, 12, 10, 8, 6, 4]
const PLAYER_COLORS = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff", "#5f27cd"]

export default function LaCajitaPoker() {
  const [activeTab, setActiveTab] = useState("ranking")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null)
  const [showEvolutionChart, setShowEvolutionChart] = useState(true)
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set())
  const [rankingSortBy, setRankingSortBy] = useState<"points" | "money">("points")

  // Data states
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([])
  const [overallStats, setOverallStats] = useState({
    totalMatches: 0,
    totalCajitas: 0,
    totalMoney: 0,
    activePlayers: 0,
  })

  // Form states
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    cajiValue: 2000,
    playerCount: 4,
    players: Array(4)
      .fill(null)
      .map(() => ({ name: "", cajitas: 1, finalChips: 0, moneyWon: -2000 })),
  })
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [selectedAnalysisPlayer, setSelectedAnalysisPlayer] = useState("")
  const [newPlayerName, setNewPlayerName] = useState("")
  const [showNewPlayerInput, setShowNewPlayerInput] = useState<number | null>(null)

  // Load initial data
  useEffect(() => {
    testConnectionAndLoadData()
  }, [])

  // Set all players as selected by default when playerStats loads
  useEffect(() => {
    if (playerStats.length > 0 && selectedPlayers.length === 0) {
      setSelectedPlayers(playerStats.map((player) => player.name))
    }
  }, [playerStats])

  const testConnectionAndLoadData = async () => {
    console.log("🚀 Starting app initialization...")

    // Test database connection first
    const isConnected = await DatabaseService.testConnection()
    setConnectionStatus(isConnected)

    if (isConnected) {
      await loadAllData()
    } else {
      setError("No se pudo conectar a la base de datos. Verifica tu conexión.")
    }
  }

  const loadAllData = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("📊 Loading all data...")

      const [playersData, matchesData, statsData, overallData, activeMatchesData] = await Promise.all([
        DatabaseService.getAllPlayers(),
        DatabaseService.getAllMatches(),
        DatabaseService.getPlayerStats(),
        DatabaseService.getOverallStats(),
        DatabaseService.getAllActiveMatches(),
      ])

      console.log("✅ Data loaded successfully:")
      console.log("- Players:", playersData.length)
      console.log("- Matches:", matchesData.length)
      console.log("- Active matches:", activeMatchesData.length)

      setPlayers(playersData)
      setMatches(matchesData)
      setPlayerStats(statsData)
      setOverallStats(overallData)
      setActiveMatches(activeMatchesData)
      setConnectionStatus(true)
    } catch (err) {
      console.error("❌ Error loading data:", err)
      setError(err instanceof Error ? err.message : "Error loading data")
      setConnectionStatus(false)
    } finally {
      setLoading(false)
    }
  }

  // Manual refresh function
  const refreshData = async () => {
    console.log("🔄 Manual refresh triggered")
    await loadAllData()
  }

  // Create new active match
  const createNewActiveMatch = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("🆕 Creating new active match...")

      const newMatch = await DatabaseService.createActiveMatch({
        date: new Date().toISOString().split("T")[0],
        cajiValue: 2000,
        playerCount: 4,
        players: Array(4)
          .fill(null)
          .map(() => ({ name: "", cajitas: 1, finalChips: 0, moneyWon: -2000 })),
      })

      console.log("✅ New active match created:", newMatch)

      // Reload active matches
      const activeMatchesData = await DatabaseService.getAllActiveMatches()
      setActiveMatches(activeMatchesData)

      // Set form data and show form
      setFormData({
        date: newMatch.date,
        cajiValue: newMatch.caji_value,
        playerCount: newMatch.player_count,
        players: newMatch.players,
      })
      setEditingMatchId(newMatch.id)
      setShowRegisterForm(true)
    } catch (err) {
      console.error("❌ Error creating active match:", err)
      setError(err instanceof Error ? err.message : "Error creating active match")
    } finally {
      setLoading(false)
    }
  }

  // Load active match for editing
  const editActiveMatch = (matchId: string) => {
    const match = activeMatches.find((m) => m.id === matchId)
    if (match) {
      setFormData({
        date: match.date,
        cajiValue: match.caji_value,
        playerCount: match.player_count,
        players: match.players,
      })
      setEditingMatchId(matchId)
      setShowRegisterForm(true)
    }
  }

  // Delete active match
  const deleteActiveMatch = async (matchId: string) => {
    setLoading(true)
    setError(null)
    try {
      await DatabaseService.deleteActiveMatch(matchId)

      // Reload active matches
      const activeMatchesData = await DatabaseService.getAllActiveMatches()
      setActiveMatches(activeMatchesData)

      // If we're editing this match, close the form
      if (editingMatchId === matchId) {
        setShowRegisterForm(false)
        setEditingMatchId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting active match")
    } finally {
      setLoading(false)
    }
  }

  // Update active match
  const updateActiveMatch = async () => {
    if (!editingMatchId) return

    try {
      await DatabaseService.updateActiveMatch(editingMatchId, {
        date: formData.date,
        cajiValue: formData.cajiValue,
        playerCount: formData.playerCount,
        players: formData.players,
      })

      // Reload active matches to get updated data
      const activeMatchesData = await DatabaseService.getAllActiveMatches()
      setActiveMatches(activeMatchesData)
    } catch (err) {
      console.error("Error updating active match:", err)
    }
  }

  // Update players array when player count changes
  useEffect(() => {
    const newPlayers = Array(formData.playerCount)
      .fill(null)
      .map((_, i) => {
        const existingPlayer = formData.players[i]
        if (existingPlayer) {
          return existingPlayer
        }
        return { name: "", cajitas: 1, finalChips: 0, moneyWon: -2000 }
      })
    setFormData((prev) => ({ ...prev, players: newPlayers }))
  }, [formData.playerCount])

  // Update active match when form data changes (debounced)
  useEffect(() => {
    if (editingMatchId && showRegisterForm) {
      const timeoutId = setTimeout(() => {
        updateActiveMatch()
      }, 500) // Debounce for 500ms

      return () => clearTimeout(timeoutId)
    }
  }, [formData, editingMatchId, showRegisterForm])

  // Calculate money won/lost based on investment and final chips
  const updatePlayerMoney = (index: number, field: string, value: any) => {
    const newPlayers = [...formData.players]
    newPlayers[index] = { ...newPlayers[index], [field]: value }

    if (field === "cajitas" || field === "finalChips") {
      const cajitas = newPlayers[index].cajitas || 1
      const finalChips = newPlayers[index].finalChips || 0
      const investment = cajitas * formData.cajiValue
      newPlayers[index].moneyWon = finalChips - investment
    }

    setFormData((prev) => ({ ...prev, players: newPlayers }))
  }

  // Validate balance
  const validateBalance = () => {
    const totalInvestment = formData.players.reduce((sum, p) => sum + p.cajitas * formData.cajiValue, 0)
    const totalFinalChips = formData.players.reduce((sum, p) => sum + p.finalChips, 0)
    return Math.abs(totalInvestment - totalFinalChips) < 0.01
  }

  // Register match (convert active match to real match)
  const registerMatch = async () => {
    if (!validateBalance() || !editingMatchId) return

    setLoading(true)
    setError(null)
    try {
      await DatabaseService.registerActiveMatch(editingMatchId)

      // Close form and reload all data
      setShowRegisterForm(false)
      setEditingMatchId(null)
      await loadAllData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error registering match")
    } finally {
      setLoading(false)
    }
  }

  // Create new player
  const createNewPlayer = async (index: number) => {
    if (!newPlayerName.trim()) return

    setLoading(true)
    try {
      await DatabaseService.createPlayer(newPlayerName.trim())
      await DatabaseService.getAllPlayers().then(setPlayers)

      // Update form with new player
      updatePlayerMoney(index, "name", newPlayerName.trim())
      setNewPlayerName("")
      setShowNewPlayerInput(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating player")
    } finally {
      setLoading(false)
    }
  }

  // Delete match with confirmation (for completed matches in historial)
  const confirmDeleteMatch = (matchId: string) => {
    setMatchToDelete(matchId)
  }

  const deleteMatch = async () => {
    if (!matchToDelete) return

    setLoading(true)
    try {
      await DatabaseService.deleteMatch(matchToDelete)
      await loadAllData()
      setMatchToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting match")
    } finally {
      setLoading(false)
    }
  }

  // Get chart data
  const getChartData = () => {
    const datasets = selectedPlayers
      .filter((playerName) => playerStats.some((p) => p.name === playerName))
      .map((playerName, index) => {
        const playerMatches = matches
          .filter((match) => match.match_players.some((mp) => mp.players?.name === playerName))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        let cumulativePoints = 0
        const data = playerMatches.map((match) => {
          const playerInMatch = match.match_players.find((mp) => mp.players?.name === playerName)
          cumulativePoints += playerInMatch?.points || 0
          return cumulativePoints
        })

        return {
          label: playerName,
          data,
          borderColor: PLAYER_COLORS[index % PLAYER_COLORS.length],
          backgroundColor: PLAYER_COLORS[index % PLAYER_COLORS.length] + "20",
          tension: 0.4,
        }
      })

    const maxLength = Math.max(...datasets.map((d) => d.data.length))
    const labels = Array.from({ length: maxLength }, (_, i) => `Partida ${i + 1}`)

    return { labels, datasets }
  }

  // Get player's last matches
  const getPlayerLastMatches = (playerName: string) => {
    return matches
      .filter((match) => match.match_players.some((mp) => mp.players?.name === playerName))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((match) => {
        const playerMatch = match.match_players.find((mp) => mp.players?.name === playerName)!
        return { position: playerMatch.position, moneyWon: playerMatch.money_won }
      })
  }

  // Toggle match expansion
  const toggleMatchExpansion = (matchId: string) => {
    setExpandedMatches(prev => {
      const newSet = new Set(prev)
      if (newSet.has(matchId)) {
        newSet.delete(matchId)
      } else {
        newSet.add(matchId)
      }
      return newSet
    })
  }

  // Get player's best match
  const getPlayerBestMatch = (playerName: string) => {
    const playerMatches = matches.filter((match) =>
      match.match_players.some((mp) => mp.players?.name === playerName)
    )
    
    if (playerMatches.length === 0) return null
    
    let bestMatch = playerMatches[0]
    let bestMp = bestMatch.match_players.find((mp) => mp.players?.name === playerName)!
    
    for (const match of playerMatches) {
      const mp = match.match_players.find((mp) => mp.players?.name === playerName)!
      if (mp.money_won > bestMp.money_won) {
        bestMatch = match
        bestMp = mp
      }
    }
    
    return {
      date: bestMatch.date,
      position: bestMp.position,
      moneyWon: bestMp.money_won
    }
  }

  // Get player's worst match
  const getPlayerWorstMatch = (playerName: string) => {
    const playerMatches = matches.filter((match) =>
      match.match_players.some((mp) => mp.players?.name === playerName)
    )
    
    if (playerMatches.length === 0) return null
    
    let worstMatch = playerMatches[0]
    let worstMp = worstMatch.match_players.find((mp) => mp.players?.name === playerName)!
    
    for (const match of playerMatches) {
      const mp = match.match_players.find((mp) => mp.players?.name === playerName)!
      if (mp.money_won < worstMp.money_won) {
        worstMatch = match
        worstMp = mp
      }
    }
    
    return {
      date: worstMatch.date,
      position: worstMp.position,
      moneyWon: worstMp.money_won
    }
  }

  // Get sorted player stats based on current sort criteria
  const getSortedPlayerStats = () => {
    return [...playerStats]
      .filter(player => player.matches > 0) // Only show players who have played matches
      .sort((a, b) => {
        if (rankingSortBy === "points") {
          return b.points - a.points
        } else {
          return b.moneyWon - a.moneyWon
        }
      })
  }

  const tabs = [
    { id: "ranking", label: "Ranking Anual" },
    { id: "partidas", label: "Partidas" },
    { id: "estadisticas", label: "Estadísticas" },
    { id: "reglas", label: "Reglas" },
  ]

  if (loading && matches.length === 0 && activeMatches.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Cargando datos...</p>
          {connectionStatus === false && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-red-400">Problema de conexión detectado</p>
              <Button onClick={testConnectionAndLoadData} className="mt-2 bg-red-600 hover:bg-red-700">
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent mb-2">
              ♠️ La Cajita
            </h1>

            {/* Connection Status & Refresh Button */}
            {/* <div className="flex items-center justify-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${connectionStatus === true ? "bg-green-400" : connectionStatus === false ? "bg-red-400" : "bg-yellow-400"}`}
              ></div>
              <span className="text-sm text-gray-400">
                {connectionStatus === true
                  ? "Conectado"
                  : connectionStatus === false
                    ? "Sin conexión"
                    : "Conectando..."}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshData}
                disabled={loading}
                className="text-gray-400 hover:text-white p-1"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div> */}
          </div>
        </div>
      </div>



      <div className="container mx-auto px-4 py-8">
        {error && (
          <Card className="mb-6 bg-red-900/20 border-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 font-semibold">Error</p>
              </div>
              <p className="text-red-300 mb-3">{error}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setError(null)}
                  variant="outline"
                  size="sm"
                  className="border-red-500 text-red-400"
                >
                  Cerrar
                </Button>
                <Button onClick={refreshData} size="sm" className="bg-red-600 hover:bg-red-700">
                  Reintentar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info (only in development) */}
        {process.env.NODE_ENV === "development" && (
          <Card className="mb-6 bg-blue-900/20 border-blue-500">
            <CardContent className="p-4">
              <h3 className="text-blue-400 font-semibold mb-2">Debug Info</h3>
              <div className="text-sm text-blue-300 space-y-1">
                <p>Active Matches: {activeMatches.length}</p>
                <p>Connection Status: {connectionStatus?.toString()}</p>
                <p>Loading: {loading.toString()}</p>
                <Button
                  onClick={() => console.log("Active matches:", activeMatches)}
                  size="sm"
                  variant="outline"
                  className="mt-2"
                >
                  Log Active Matches
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmation Dialog */}
        {matchToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="bg-gray-800 border-gray-600 max-w-md w-full">
              <CardHeader>
                <CardTitle className="text-xl text-red-400">Confirmar Eliminación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-300">
                  ¿Estás seguro de que quieres eliminar esta partida? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setMatchToDelete(null)}
                    className="border-gray-600 text-gray-300"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={deleteMatch} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
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

        {/* Ranking Anual Tab */}
        {activeTab === "ranking" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-yellow-400 text-center">Tabla Anual</h2>                      

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="py-2 px-2 text-left text-yellow-400">Pos</th>
                    <th className="py-2 px-2 text-left text-yellow-400">Jugador</th>
                    <th className="py-2 px-2 text-center text-yellow-400">Puntos</th>
                    <th className="py-2 px-2 text-center text-yellow-400">Dinero Ganado</th>
                    <th className="py-2 px-2 text-center text-yellow-400 hidden md:table-cell">Partidas</th>
                    <th className="py-2 px-2 text-center text-yellow-400 hidden md:table-cell">Cajitas</th>                      
                    <th className="py-2 px-2 text-center text-yellow-400 hidden md:table-cell">Promedio/Partida</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedPlayerStats().map((player, index) => (
                    <tr
                      key={player.id}
                      className={`border-b border-gray-700/50 ${
                        index === 0
                          ? "bg-gradient-to-r from-yellow-900/30 to-yellow-800/20"
                          : index === 1
                            ? "bg-gradient-to-r from-gray-400/20 to-gray-500/10"
                            : index === 2
                              ? "bg-gradient-to-r from-orange-900/30 to-orange-800/20"
                              : ""
                      }`}
                    >
                                              <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                          <span className="font-semibold text-slate-200 text-sm">{index + 1}</span>
                            {index === 0 && <Trophy className="w-4 h-4 text-yellow-400" />}
                            {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                            {index === 2 && <Award className="w-4 h-4 text-orange-400" />}                            
                          </div>
                        </td>
                        <td className="py-3 px-2 font-semibold text-white text-sm">{player.name}</td>
                        <td className="py-3 px-2 text-center font-bold text-white text-sm">{player.points}</td>
                        <td
                          className={`py-3 px-2 text-center font-semibold text-sm ${
                            player.moneyWon >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          ${player.moneyWon.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-300 hidden md:table-cell text-sm">{player.matches}</td>
                        <td className="py-3 px-2 text-center text-slate-300 hidden md:table-cell text-sm">{player.cajitas}</td>                        
                        <td
                          className={`py-3 px-2 text-center hidden md:table-cell text-sm ${
                            player.averagePerMatch >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          ${Math.round(player.averagePerMatch).toLocaleString()}
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sort Toggle Switch */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${rankingSortBy === "money" ? "text-white" : "text-gray-400"}`}>
                Puntos
              </span>
              <button
                onClick={() => setRankingSortBy(rankingSortBy === "points" ? "money" : "points")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  rankingSortBy === "money" ? "bg-yellow-400" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rankingSortBy === "money" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${rankingSortBy === "points" ? "text-white" : "text-gray-400"}`}>
                Dinero
              </span>
            </div>
          </div>
        )}

        {/* Partidas Tab */}
        {activeTab === "partidas" && (
          <div className="space-y-6">
            {!showRegisterForm ? (
              <>
                {/* Partidas Activas */}
                <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl text-yellow-400">
                      Partidas ({activeMatches.length})
                    </CardTitle>
                    <div className="flex gap-2">                      
                      <Button
                        onClick={createNewActiveMatch}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <Plus className="w-4 h-4 mr-1" />
                        )}
                        Nueva Partida
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activeMatches.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-400 mb-4">No hay partidas activas</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeMatches.map((match) => {
                          const playersWithNames = match.players.filter((p) => p.name.trim() !== "")
                          const totalInvestment = match.players.reduce(
                            (sum, p) => sum + p.cajitas * match.caji_value,
                            0,
                          )
                          const isComplete =
                            playersWithNames.length === match.player_count &&
                            playersWithNames.every((p) => p.finalChips > 0)

                          return (
                            <Card key={match.id} className="bg-gray-700/30 border-gray-600/50">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex flex-col gap-2">
                                    
                                      <div className="text-lg font-semibold text-green-400">{match.date}</div>
                                    
                                    <div
                                        className={`px-2 py-1 rounded text-xs font-semibold w-fit ${
                                          isComplete
                                            ? "bg-green-600/20 text-green-400"
                                            : "bg-yellow-600/20 text-yellow-400"
                                        }`}
                                      >
                                        {isComplete ? "Lista para registrar" : "En progreso"}
                                      </div>
                                    <div className="text-sm text-gray-400">
                                      {playersWithNames.length}/{match.player_count} jugadores - $
                                      {totalInvestment.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Actualizado:{" "}
                                      {new Date(match.updated_at).toLocaleTimeString()}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => editActiveMatch(match.id)}
                                      className="bg-blue-600/20 border-blue-500 text-blue-400 hover:bg-blue-600/40"
                                    >
                                      <NotebookPen className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteActiveMatch(match.id)}
                                      disabled={loading}
                                      className="bg-red-600/20 border-red-500 text-red-400 hover:bg-red-600/40"
                                    >
                                      {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                {playersWithNames.length > 0 && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                    {playersWithNames.map((player, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center justify-between p-2 bg-gray-600/30 rounded"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold text-white">
                                            {index + 1}
                                          </div>
                                          <span className="text-sm">{player.name}</span>
                                        </div>
                                        <span
                                          className={`text-sm font-semibold ${
                                            player.moneyWon >= 0 ? "text-green-400" : "text-red-400"
                                          }`}
                                        >
                                          {player.finalChips > 0 ? `$${player.moneyWon.toLocaleString()}` : "Pendiente"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Formulario de Registro */
              <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowRegisterForm(false)
                        setEditingMatchId(null)
                      }}
                      className="bg-gray-700/50 border-gray-600 text-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <CardTitle className="text-2xl text-yellow-400">
                      {editingMatchId ? "Editando Partida" : "Nueva Partida"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="date" className="text-gray-300">
                        Fecha
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                        className="bg-gray-700/50 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cajiValue" className="text-gray-300">
                        Valor de una Cajita
                      </Label>
                      <Input
                        id="cajiValue"
                        type="number"
                        value={formData.cajiValue}
                        onChange={(e) => setFormData((prev) => ({ ...prev, cajiValue: Number(e.target.value) }))}
                        className="bg-gray-700/50 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="playerCount" className="text-gray-300">
                        Número de Jugadores
                      </Label>
                      <Select
                        value={formData.playerCount.toString()}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, playerCount: Number(value) }))}
                      >
                        <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600 text-white">
                          {[4, 5, 6, 7, 8].map((count) => (
                            <SelectItem
                              key={count}
                              value={count.toString()}
                              className="hover:bg-green-600 hover:text-white"
                            >
                              {count} jugadores
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-green-400">Jugadores</h3>
                    {formData.players.map((player, index) => (
                      <Card key={index} className="bg-gray-700/30 border-gray-600/50">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label className="text-gray-300">Jugador {index + 1}</Label>
                              {showNewPlayerInput === index ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={newPlayerName}
                                    onChange={(e) => setNewPlayerName(e.target.value)}
                                    className="bg-gray-600/50 border-gray-500 text-white"
                                    placeholder="Nombre del nuevo jugador"
                                  />
                                  <Button
                                    onClick={() => createNewPlayer(index)}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={!newPlayerName.trim() || loading}
                                  >
                                    {loading ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Plus className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setShowNewPlayerInput(null)
                                      setNewPlayerName("")
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="border-gray-500"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Select
                                    value={player.name}
                                    onValueChange={(value) => {
                                      if (value === "new") {
                                        setShowNewPlayerInput(index)
                                      } else {
                                        updatePlayerMoney(index, "name", value)
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="bg-gray-600/50 border-gray-500 text-white">
                                      <SelectValue placeholder="Seleccionar jugador" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-600 text-white">
                                      {players
                                        .filter(
                                          (p) =>
                                            !formData.players.some(
                                              (fp, fpIndex) => fpIndex !== index && fp.name === p.name,
                                            ),
                                        )
                                        .map((p) => (
                                          <SelectItem
                                            key={p.id}
                                            value={p.name}
                                            className="hover:bg-green-600 hover:text-white"
                                          >
                                            {p.name}
                                          </SelectItem>
                                        ))}
                                      <SelectItem
                                        value="new"
                                        className="text-green-400 hover:bg-green-600 hover:text-white"
                                      >
                                        + Crear nuevo jugador
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <Label className="text-gray-300">Cajitas</Label>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={player.cajitas.toString()}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/[^0-9]/g, "")
                                    if (value === "" || (Number.parseInt(value) >= 1 && Number.parseInt(value) <= 999)) {
                                      updatePlayerMoney(index, "cajitas", value === "" ? 1 : Number.parseInt(value))
                                    }
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="bg-gray-600/50 border-gray-500 text-white text-center"
                                  min="1"
                                  placeholder="1"
                                />
                              </div>
                              <div>
                                <Label className="text-gray-300">Fichas Totales</Label>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={player.finalChips === 0 ? "" : player.finalChips.toString()}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/[^0-9]/g, "")
                                    updatePlayerMoney(index, "finalChips", value === "" ? 0 : Number.parseInt(value))
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="bg-gray-600/50 border-gray-500 text-white text-center"
                                  min="0"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-gray-300">Dinero Ganado/Perdido</Label>
                              <div
                                className={`p-2 rounded text-center font-semibold ${
                                  player.moneyWon >= 0 ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                ${player.moneyWon.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {/* <div className="mt-2 text-sm text-gray-400">
                            Inversión: ${(player.cajitas * formData.cajiValue).toLocaleString()}
                          </div> */}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card
                    className={`border-2 ${validateBalance() ? "border-green-500 bg-green-900/20" : "border-red-500 bg-red-900/20"}`}
                  >
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div
                          className={`text-lg font-semibold ${validateBalance() ? "text-green-400" : "text-red-400"}`}
                        >
                          {validateBalance() ? "✅ Balance Correcto" : "❌ Balance Incorrecto"}
                        </div>
                        <div className="text-sm text-gray-300 mt-2">
                          Total Invertido: $
                          {formData.players
                            .reduce((sum, p) => sum + p.cajitas * formData.cajiValue, 0)
                            .toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-300">
                          Total Fichas Finales: $
                          {formData.players.reduce((sum, p) => sum + p.finalChips, 0).toLocaleString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setShowRegisterForm(false)
                        setEditingMatchId(null)
                      }}
                      variant="outline"
                      className="flex-1 border-gray-600 text-gray-300"
                    >
                      Volver
                    </Button>
                    <Button
                      onClick={registerMatch}
                      disabled={!validateBalance() || formData.players.some((p) => !p.name) || loading}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Registrando...
                        </>
                      ) : (
                        "Validar y Registrar Partida"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Historial de Partidas */}
            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-2xl text-yellow-400">Historial de Partidas</CardTitle>
                <Button
                        onClick={refreshData}
                        disabled={loading}
                        variant="outline"
                        size="sm"
                        className="bg-gray-700/50 border-gray-600 text-gray-300"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-4 custom-scrollbar">
                  {matches.map((match) => {
                    const isExpanded = expandedMatches.has(match.id)
                    const winner = match.match_players.find(mp => mp.position === 1)
                    
                    return (
                      <Card key={match.id} className="bg-gray-700/30 border-gray-600/50">
                        <CardContent className="p-4">
                          <div 
                            className="flex justify-between items-start cursor-pointer hover:bg-gray-600/20 rounded p-2 -m-2 transition-colors"
                            onClick={() => toggleMatchExpansion(match.id)}
                          >
                            <div className="flex-1">
                              <div className="text-lg font-semibold text-green-400">{match.date}</div>
                              <div className="text-sm text-gray-400">
                                {match.player_count} jugadores - ${match.total_money.toLocaleString()}
                              </div>
                              {winner && (
                                <div className="text-sm text-yellow-400 mt-1">
                                  🏆 Ganador: {winner.players?.name}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="mt-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-300">
                                  Dinero total jugado: <span className="text-yellow-400 font-semibold">${match.total_money.toLocaleString()}</span>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    confirmDeleteMatch(match.id)
                                  }}
                                  className="bg-red-600/20 border-red-500 text-red-400 hover:bg-red-600/40"
                                  disabled={loading}
                                >
                                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                {match.match_players
                                  .sort((a, b) => a.position - b.position)
                                  .map((mp) => (
                                    <div key={mp.id} className="flex items-center justify-between p-2 bg-gray-600/30 rounded">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                            mp.position === 1
                                              ? "bg-yellow-500 text-black"
                                              : mp.position === 2
                                                ? "bg-gray-400 text-black"
                                                : mp.position === 3
                                                  ? "bg-orange-500 text-black"
                                                  : "bg-gray-600 text-white"
                                          }`}
                                        >
                                          {mp.position}
                                        </div>
                                        <span className="text-sm">{mp.players?.name}</span>
                                      </div>
                                      <span
                                        className={`text-sm font-semibold ${
                                          mp.money_won >= 0 ? "text-green-400" : "text-red-400"
                                        }`}
                                      >
                                        ${mp.money_won.toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Estadísticas Tab */}
        {activeTab === "estadisticas" && (
          <div className="space-y-6">
            {/* Análisis Individual */}
            <div className="space-y-4">
              {playerStats.filter(player => player.matches > 0).map((player) => (
                <Card key={player.id} className="bg-gray-800/80 border-gray-700/80 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-xl font-light text-white">{player.name}</div>
                      <div className="text-xl font-semibold text-white">${player.moneyWon.toLocaleString()}</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                          <Award className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                          <div className="text-xl font-bold text-yellow-400">{player.points}</div>
                          <div className="text-xs text-gray-400">Puntos</div>
                        </div>
                      <div className="text-center">
                        <Cannabis className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <div className="text-xl font-bold text-yellow-400">{player.matches}</div>
                        <div className="text-xs text-gray-400">Partidas</div>
                      </div>
                      <div className="text-center">
                        <Coins className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <div className="text-xl font-bold text-yellow-400">{player.cajitas}</div>
                        <div className="text-xs text-gray-400">Cajitas</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {getPlayerBestMatch(player.name) && (
                        <div className="flex flex-col items-center p-2 border border-green-500/30 bg-green-500/5 rounded-lg">
                          <div className="flex items-center justify-between mb-2 w-full">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-green-400 font-semibold">P{getPlayerBestMatch(player.name)?.position}</span>
                            </div>
                            <div className="text-sm text-green-400 font-semibold">${getPlayerBestMatch(player.name)?.moneyWon.toLocaleString()}</div>

                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-400">{getPlayerBestMatch(player.name)?.date}</div>
                          </div>
                        </div>
                      )}
                      {getPlayerWorstMatch(player.name) && (
                        <div className="flex flex-col items-center p-2 border border-red-500/30 bg-red-500/5 rounded-lg">
                          <div className="flex items-center justify-between mb-2 w-full">
                            <div className="flex items-center gap-2">
                              <TrendingDown className="w-4 h-4 text-red-400" />
                              <span className="text-sm text-red-400 font-semibold">P{getPlayerWorstMatch(player.name)?.position}</span>
                            </div>
                            <div className="text-sm text-red-400 font-semibold">${getPlayerWorstMatch(player.name)?.moneyWon.toLocaleString()}</div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-400">{getPlayerWorstMatch(player.name)?.date}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Últimas 5 partidas</span>
                        <div className="flex gap-1">
                          {getPlayerLastMatches(player.name).slice(0, 5).map((match, index) => (
                            <div
                              key={index}
                              className={`w-5 h-5 rounded-sm flex items-center justify-center text-xs font-normal text-white ${
                                match.moneyWon >= 0 ? "bg-green-500" : "bg-red-500"
                              }`}
                            >
                              {match.position}
                            </div>
                          ))}
                        </div>
                      </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Evolución de Puntos */}
            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader
                className="cursor-pointer hover:bg-gray-700/30 transition-colors"
                onClick={() => setShowEvolutionChart(!showEvolutionChart)}
              >
                <div className="flex justify-between items-center">
                  <CardTitle className="text-2xl text-yellow-400">Evolución de Puntos</CardTitle>
                  {showEvolutionChart ? (
                    <ChevronUp className="w-6 h-6 text-yellow-400" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-yellow-400" />
                  )}
                </div>
              </CardHeader>
              {showEvolutionChart && (
                <CardContent>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">Seleccionar Jugadores</h3>
                    <div className="flex flex-wrap gap-3">
                      {playerStats.filter(player => player.matches > 0).map((player, index) => (
                        <div key={player.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={player.id}
                            checked={selectedPlayers.includes(player.name)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPlayers((prev) => [...prev, player.name])
                              } else {
                                setSelectedPlayers((prev) => prev.filter((p) => p !== player.name))
                              }
                            }}
                          />
                          <Label
                            htmlFor={player.id}
                            className="cursor-pointer"
                            style={{ color: PLAYER_COLORS[index % PLAYER_COLORS.length] }}
                          >
                            {player.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedPlayers.length > 0 && (
                    <div className="h-96 mb-6">
                      <Line
                        data={getChartData()}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              labels: { color: "#ffffff" },
                            },
                          },
                          scales: {
                            x: {
                              ticks: { color: "#ffffff" },
                              grid: { color: "#374151" },
                            },
                            y: {
                              ticks: { color: "#ffffff" },
                              grid: { color: "#ffffff" },
                            },
                          },
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        )}



        {/* Reglas Tab */}
        {activeTab === "reglas" && (
          <div className="space-y-6">
            
            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl text-yellow-400">Reglas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-300">
                  <li>• Los puntos se asignan según la posición final en cada partida</li>
                  <li>
                    •{" "}
                    <strong className="text-yellow-400">
                      Las posiciones se determinan por dinero ganado neto (de mayor a menor)
                    </strong>
                  </li>
                  <li>
                    •{" "}
                    <strong className="text-yellow-400">
                      En caso de empate en dinero ganado, gana quien pidió menos cajitas
                    </strong>
                  </li>
                  <li>• En caso de empate en puntos del ranking anual, gana quien tenga más dinero ganado total</li>
                  
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl text-yellow-400">Sistema de Puntos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-center">
                    <thead>
                      <tr className="border-b border-gray-600">
                        <th className="py-3 px-4 text-yellow-400">Posición</th>
                        <th className="py-3 px-4 text-yellow-400">Puntos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((position) => (
                        <tr key={position} className="border-b border-gray-700/50">
                          <td className="py-3 px-4 font-semibold text-green-400">{position}°</td>
                          <td className="py-3 px-4 text-slate-400 font-bold text-lg">
                            {POINTS_DISTRIBUTION[position - 1]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed p-0 bottom-0 left-0 right-0 h-20 bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-sm border-t border-gray-700/50 z-50">
        <div className="flex justify-around items-center h-full p-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setShowRegisterForm(false)
                setEditingMatchId(null)
              }}
              className={`flex items-center justify-center w-32 h-full transition-all duration-200 ${
                activeTab === tab.id
                  ? "text-yellow-400 bg-yellow-400/10"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
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

      {/* PWA Components */}
      <PWAInstall />
      <OfflineIndicator />
    </div>
  )
}
