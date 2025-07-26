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
      .map(() => ({ name: "", cajitas: 1, finalChips: 0, moneyWon: 0 })),
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
          .map(() => ({ name: "", cajitas: 1, finalChips: 0, moneyWon: 0 })),
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
      .map((_, i) => formData.players[i] || { name: "", cajitas: 1, finalChips: 0, moneyWon: 0 })
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent mb-2">
              ♠️ La Cajita
            </h1>

            {/* Connection Status & Refresh Button */}
            <div className="flex items-center justify-center gap-2">
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
            </div>
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
          <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-yellow-400">Ranking Anual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="py-3 px-4 text-left text-yellow-400">Pos</th>
                      <th className="py-3 px-4 text-left text-yellow-400">Jugador</th>
                      <th className="py-3 px-4 text-center text-yellow-400">Puntos</th>
                      <th className="py-3 px-4 text-center text-yellow-400">Dinero Ganado</th>
                      <th className="py-3 px-4 text-center text-yellow-400 hidden md:table-cell">Partidas</th>
                      <th className="py-3 px-4 text-center text-yellow-400 hidden md:table-cell">Cajitas</th>                      
                      <th className="py-3 px-4 text-center text-yellow-400 hidden md:table-cell">Promedio/Partida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map((player, index) => (
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
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Trophy className="w-5 h-5 text-yellow-400" />}
                            {index === 1 && <Medal className="w-5 h-5 text-gray-400" />}
                            {index === 2 && <Award className="w-5 h-5 text-orange-400" />}
                            <span className="font-semibold text-white">{index + 1}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-green-400">{player.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-yellow-400">{player.points}</td>
                        <td
                          className={`py-3 px-4 text-center font-semibold ${
                            player.moneyWon >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          ${player.moneyWon.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-300 hidden md:table-cell">{player.matches}</td>
                        <td className="py-3 px-4 text-center text-slate-300 hidden md:table-cell">{player.cajitas}</td>                        
                        <td
                          className={`py-3 px-4 text-center hidden md:table-cell ${
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
            </CardContent>
          </Card>
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
                      Partidas Activas ({activeMatches.length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        onClick={refreshData}
                        disabled={loading}
                        variant="outline"
                        size="sm"
                        className="bg-gray-700/50 border-gray-600 text-gray-300"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                      <Button
                        onClick={createNewActiveMatch}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
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
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="text-lg font-semibold text-green-400">{match.date}</div>
                                      <div
                                        className={`px-2 py-1 rounded text-xs font-semibold ${
                                          isComplete
                                            ? "bg-green-600/20 text-green-400"
                                            : "bg-yellow-600/20 text-yellow-400"
                                        }`}
                                      >
                                        {isComplete ? "Lista para registrar" : "En progreso"}
                                      </div>
                                    </div>
                                    <div className="text-sm text-gray-400">
                                      {playersWithNames.length}/{match.player_count} jugadores - $
                                      {totalInvestment.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      ID: {match.id.slice(0, 8)}... | Actualizado:{" "}
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
                                      <Edit className="w-4 h-4" />
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
                              <Label className="text-gray-300">Fichas Finales</Label>
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
                            <div>
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
                          <div className="mt-2 text-sm text-gray-400">
                            Inversión: ${(player.cajitas * formData.cajiValue).toLocaleString()}
                          </div>
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
              <CardHeader>
                <CardTitle className="text-2xl text-yellow-400">Historial de Partidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-4 custom-scrollbar">
                  {matches.map((match) => (
                    <Card key={match.id} className="bg-gray-700/30 border-gray-600/50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-lg font-semibold text-green-400">{match.date}</div>
                            <div className="text-sm text-gray-400">
                              {match.player_count} jugadores - ${match.total_money.toLocaleString()}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => confirmDeleteMatch(match.id)}
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Estadísticas Tab */}
        {activeTab === "estadisticas" && (
          <div className="space-y-6">
            {/* Estadísticas generales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-gray-800/50 to-gray-700/30 border-gray-600/50 backdrop-blur-sm hover:scale-105 transition-transform rounded-xl">
                <CardContent className="p-6 text-center bg-slate-700 border-0 rounded-xl shadow-none">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">{overallStats.totalMatches}</div>
                  <div className="text-gray-300">Total Partidas Jugadas</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-gray-800/50 to-gray-700/30 border-gray-600/50 backdrop-blur-sm hover:scale-105 transition-transform rounded-xl">
                <CardContent className="p-6 text-center rounded-xl bg-slate-700">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">{overallStats.totalCajitas}</div>
                  <div className="text-gray-300">Total Cajitas</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-gray-800/50 to-gray-700/30 border-gray-600/50 backdrop-blur-sm hover:scale-105 transition-transform rounded-xl">
                <CardContent className="p-6 text-center rounded-xl bg-slate-700">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">
                    ${overallStats.totalMoney.toLocaleString()}
                  </div>
                  <div className="text-gray-300">Dinero en Juego</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-gray-800/50 to-gray-700/30 border-gray-600/50 backdrop-blur-sm hover:scale-105 transition-transform rounded-xl">
                <CardContent className="p-6 text-center rounded-xl bg-slate-700">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">{overallStats.activePlayers}</div>
                  <div className="text-gray-300">Jugadores Activos</div>
                </CardContent>
              </Card>
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
                      {playerStats.map((player, index) => (
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
                              grid: { color: "#374151" },
                            },
                          },
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Últimas 5 Partidas */}
            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-yellow-400">Últimas 5 Partidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playerStats.map((player) => {
                    const lastMatches = getPlayerLastMatches(player.name)
                    const positiveCount = lastMatches.filter((m) => m.moneyWon > 0).length
                    const totalMoney = lastMatches.reduce((sum, m) => sum + m.moneyWon, 0)

                    return (
                      <Card key={player.id} className="bg-gray-700/30 border-gray-600/50">
                        <CardContent className="p-4">
                          <div className="text-lg font-semibold text-green-400 mb-3">{player.name}</div>
                          <div className="flex gap-1 mb-3">
                            {lastMatches.map((match, index) => (
                              <div
                                key={index}
                                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                                  match.moneyWon > 0 ? "bg-green-600" : "bg-red-600"
                                } text-white`}
                              >
                                {match.position}
                              </div>
                            ))}
                            {Array.from({ length: 5 - lastMatches.length }).map((_, index) => (
                              <div key={`empty-${index}`} className="w-8 h-8 rounded bg-gray-600/50"></div>
                            ))}
                          </div>
                          <div className="text-sm space-y-1">
                            <div className="text-slate-400">Sesiones positivas: {positiveCount}/5</div>
                            <div className={`font-semibold ${totalMoney >= 0 ? "text-green-400" : "text-red-400"}`}>
                              Total: ${totalMoney.toLocaleString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Análisis Individual */}
            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-yellow-400">Análisis Individual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <Label className="text-gray-300">Seleccionar Jugador</Label>
                  <Select value={selectedAnalysisPlayer} onValueChange={setSelectedAnalysisPlayer}>
                    <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                      <SelectValue placeholder="Selecciona un jugador" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 text-white">
                      {playerStats.map((player) => (
                        <SelectItem key={player.id} value={player.name} className="hover:bg-green-600 hover:text-white">
                          {player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAnalysisPlayer && (
                  <div className="space-y-4">
                    {(() => {
                      const playerMatches = matches.filter((match) =>
                        match.match_players.some((mp) => mp.players?.name === selectedAnalysisPlayer),
                      )
                      const playerResults = playerMatches.map((match) => {
                        const mp = match.match_players.find((mp) => mp.players?.name === selectedAnalysisPlayer)!
                        return { match, mp }
                      })

                      if (playerResults.length === 0) {
                        return <p className="text-gray-400">No hay datos para este jugador</p>
                      }

                      const bestGame = playerResults.reduce(
                        (best, current) => (current.mp.money_won > best.mp.money_won ? current : best),
                        playerResults[0],
                      )

                      const worstGame = playerResults.reduce(
                        (worst, current) => (current.mp.money_won < worst.mp.money_won ? current : worst),
                        playerResults[0],
                      )

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card className="bg-green-900/20 border-green-600/50">
                            <CardContent className="p-4">
                              <h3 className="text-lg font-semibold text-green-400 mb-2">Mejor Partida</h3>
                              <div className="space-y-1 text-sm">
                                <div className="text-white">Fecha: {bestGame.match.date}</div>
                                <div className="text-white">Posición: {bestGame.mp.position}°</div>
                                <div className="text-green-400 font-semibold">
                                  Ganancia: ${bestGame.mp.money_won.toLocaleString()}
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-red-900/20 border-red-600/50">
                            <CardContent className="p-4">
                              <h3 className="text-lg font-semibold text-red-400 mb-2">Peor Partida</h3>
                              <div className="space-y-1 text-sm">
                                <div className="text-white">Fecha: {worstGame.match.date}</div>
                                <div className="text-white">Posición: {worstGame.mp.position}°</div>
                                <div className="text-red-400 font-semibold">
                                  Pérdida: ${worstGame.mp.money_won.toLocaleString()}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}



        {/* Reglas Tab */}
        {activeTab === "reglas" && (
          <div className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-yellow-400">Sistema de Puntos</CardTitle>
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

            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl text-yellow-400">Reglas del Sistema</CardTitle>
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
                  <li>• Solo se consideran partidas con mínimo 4 jugadores</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-sm border-t border-gray-700/50 z-50">
        <div className="flex justify-around items-center h-full px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setShowRegisterForm(false)
                setEditingMatchId(null)
              }}
              className={`flex items-center justify-center w-32 h-16 transition-all duration-200 ${
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
