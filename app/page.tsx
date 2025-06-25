"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, Trophy, Medal, Award, Plus, Loader2, Menu, X } from "lucide-react"
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
import type { Player, MatchWithPlayers, PlayerStats } from "../lib/supabase"
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
  const [activeTab, setActiveTab] = useState("sistema")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Data states
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
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
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [playersData, matchesData, statsData, overallData] = await Promise.all([
        DatabaseService.getAllPlayers(),
        DatabaseService.getAllMatches(),
        DatabaseService.getPlayerStats(),
        DatabaseService.getOverallStats(),
      ])

      setPlayers(playersData)
      setMatches(matchesData)
      setPlayerStats(statsData)
      setOverallStats(overallData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data")
    } finally {
      setLoading(false)
    }
  }

  // Update players array when player count changes
  useEffect(() => {
    const newPlayers = Array(formData.playerCount)
      .fill(null)
      .map((_, i) => formData.players[i] || { name: "", cajitas: 1, finalChips: 0, moneyWon: 0 })
    setFormData((prev) => ({ ...prev, players: newPlayers }))
  }, [formData.playerCount])

  // Calculate money won/lost based on investment and final chips
  const updatePlayerMoney = (index: number, field: string, value: any) => {
    const newPlayers = [...formData.players]
    newPlayers[index] = { ...newPlayers[index], [field]: value }

    if (field === "cajitas" || field === "finalChips") {
      const investment = newPlayers[index].cajitas * formData.cajiValue
      const finalValue = newPlayers[index].finalChips
      newPlayers[index].moneyWon = finalValue - investment
    }

    setFormData((prev) => ({ ...prev, players: newPlayers }))
  }

  // Validate balance
  const validateBalance = () => {
    const totalInvestment = formData.players.reduce((sum, p) => sum + p.cajitas * formData.cajiValue, 0)
    const totalFinalChips = formData.players.reduce((sum, p) => sum + p.finalChips, 0)
    return Math.abs(totalInvestment - totalFinalChips) < 0.01
  }

  // Register match
  const registerMatch = async () => {
    if (!validateBalance()) return

    setLoading(true)
    setError(null)
    try {
      await DatabaseService.createMatch({
        date: formData.date,
        cajiValue: formData.cajiValue,
        players: formData.players,
      })

      // Reset form
      setFormData({
        date: new Date().toISOString().split("T")[0],
        cajiValue: 2000,
        playerCount: 4,
        players: Array(4)
          .fill(null)
          .map(() => ({ name: "", cajitas: 1, finalChips: 0, moneyWon: 0 })),
      })

      // Reload data
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

  // Delete match
  const deleteMatch = async (matchId: string) => {
    setLoading(true)
    try {
      await DatabaseService.deleteMatch(matchId)
      await loadAllData()
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
    { id: "sistema", label: "Sistema de Puntos" },
    { id: "registrar", label: "Registrar Partida" },
    { id: "ranking", label: "Ranking Anual" },
    { id: "estadisticas", label: "Estadísticas" },
    { id: "evolucion", label: "Evolución" },
    { id: "analisis", label: "Análisis" },
  ]

  if (loading && matches.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Cargando datos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center mb-6">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent mb-2">
              ♠️ La Cajita
            </h1>
            <p className="text-xl text-gray-300">Torneo Anual de Poker</p>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex flex-wrap justify-center gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "outline"}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? "bg-green-600 hover:bg-green-700 text-white border-green-500"
                    : "bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border-gray-600"
                } backdrop-blur-sm transition-all duration-200`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <div className="flex justify-between items-center">
              <div className="text-lg font-semibold text-green-400">
                {tabs.find((tab) => tab.id === activeTab)?.label}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMenuOpen(true)}
                className="bg-gray-800/50 border-gray-600 text-gray-300"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black z-50 flex flex-col"
          onClick={() => setMobileMenuOpen(false)}
        >
          {/* Header del menú */}
          <div className="flex justify-between items-center p-6 border-b border-gray-700/50">
            <h2 className="text-2xl font-bold text-yellow-400">♠️ La Cajita</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              className="text-white hover:text-yellow-400"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Lista de opciones */}
          <div className="flex-1 flex flex-col justify-center px-8">
            <div className="space-y-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab(tab.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full text-left py-4 px-6 rounded-lg text-xl font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "bg-green-600 text-white"
                      : "text-white hover:text-yellow-400 hover:bg-gray-800/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer del menú */}
          <div className="p-6 text-center text-gray-400 text-sm border-t border-gray-700/50">
            Toca fuera del menú para cerrar
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {error && (
          <Card className="mb-6 bg-red-900/20 border-red-500">
            <CardContent className="p-4">
              <p className="text-red-400">{error}</p>
              <Button
                onClick={() => setError(null)}
                variant="outline"
                size="sm"
                className="mt-2 border-red-500 text-red-400"
              >
                Cerrar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sistema de Puntos Tab */}
        {activeTab === "sistema" && (
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
                  <li>• En caso de empate en puntos, gana quien tenga más dinero ganado</li>
                  <li>• Solo se consideran partidas con mínimo 4 jugadores</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Registrar Partida Tab */}
        {activeTab === "registrar" && (
          <div className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-yellow-400">Registrar Nueva Partida</CardTitle>
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
                              type="number"
                              value={player.cajitas}
                              onChange={(e) => updatePlayerMoney(index, "cajitas", Number(e.target.value))}
                              className="bg-gray-600/50 border-gray-500 text-white"
                              min="1"
                            />
                          </div>
                          <div>
                            <Label className="text-gray-300">Fichas Finales</Label>
                            <Input
                              type="number"
                              value={player.finalChips}
                              onChange={(e) => updatePlayerMoney(index, "finalChips", Number(e.target.value))}
                              className="bg-gray-600/50 border-gray-500 text-white"
                              min="0"
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
                      <div className={`text-lg font-semibold ${validateBalance() ? "text-green-400" : "text-red-400"}`}>
                        {validateBalance() ? "✅ Balance Correcto" : "❌ Balance Incorrecto"}
                      </div>
                      <div className="text-sm text-gray-300 mt-2">
                        Total Invertido: $
                        {formData.players.reduce((sum, p) => sum + p.cajitas * formData.cajiValue, 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-300">
                        Total Fichas Finales: $
                        {formData.players.reduce((sum, p) => sum + p.finalChips, 0).toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={registerMatch}
                  disabled={!validateBalance() || formData.players.some((p) => !p.name) || loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
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
                      <th className="py-3 px-4 text-center text-yellow-400">Partidas</th>
                      <th className="py-3 px-4 text-center text-yellow-400">Cajitas</th>
                      <th className="py-3 px-4 text-center text-yellow-400">Dinero Ganado</th>
                      <th className="py-3 px-4 text-center text-yellow-400">Promedio/Partida</th>
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
                        <td className="py-3 px-4 text-center text-slate-300">{player.matches}</td>
                        <td className="py-3 px-4 text-center text-slate-300">{player.cajitas}</td>
                        <td
                          className={`py-3 px-4 text-center font-semibold ${
                            player.moneyWon >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          ${player.moneyWon.toLocaleString()}
                        </td>
                        <td
                          className={`py-3 px-4 text-center ${
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

        {/* Estadísticas Tab */}
        {activeTab === "estadisticas" && (
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
        )}

        {/* Evolución Tab */}
        {activeTab === "evolucion" && (
          <div className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-yellow-400">Evolución de Puntos</CardTitle>
              </CardHeader>
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
            </Card>

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
                            onClick={() => deleteMatch(match.id)}
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

        {/* Análisis Tab */}
        {activeTab === "analisis" && (
          <div className="space-y-6">
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
      </div>

      {/* PWA Components */}
      <PWAInstall />
      <OfflineIndicator />
    </div>
  )
}
