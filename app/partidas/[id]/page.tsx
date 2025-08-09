"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DatabaseService } from "@/lib/database"
import type { ActiveMatch } from "@/lib/database"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, ArrowLeft, GripVertical, Plus, Trophy, Medal, Award } from "lucide-react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
// Nota: evitamos CSS.Transform.toString para prevenir errores en algunos entornos

interface FormPlayer {
  name: string
  cajitas: number
  finalChips: number
  moneyWon: number
  tieBreak?: number
}

function SortablePlayerRow({ id, index, children }: { id: string; index: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 p-1 touch-none" {...listeners} aria-label="Reordenar">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  )
}

export default function EditActiveMatchPage() {
  const params = useParams()
  const rawId = (params as any)?.id
  const matchId = Array.isArray(rawId) ? rawId[0] : (rawId as string)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [playersList, setPlayersList] = useState<string[]>([])
  const [formData, setFormData] = useState<{ date: string; cajiValue: number; playerCount: number; players: FormPlayer[] } | null>(null)
  const [newPlayerInputIndex, setNewPlayerInputIndex] = useState<number | null>(null)
  const [newPlayerName, setNewPlayerName] = useState("")
  const [creatingPlayer, setCreatingPlayer] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const POINTS_DISTRIBUTION = [25, 18, 15, 12, 10, 8, 6, 4]

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      const match = await DatabaseService.getActiveMatchById(matchId)
      if (!mounted) return
      if (match) {
        setFormData({
          date: match.date,
          cajiValue: match.caji_value,
          playerCount: match.player_count,
          players: (match.players as Array<FormPlayer | (FormPlayer & { tieBreak?: number })>).map((p) => ({
            ...p,
            tieBreak: (p as any).tieBreak ?? Math.random(),
          })),
        })
      }
      const allPlayers = await DatabaseService.getAllPlayers()
      if (!mounted) return
      setPlayersList(allPlayers.map((p) => p.name))
      setLoading(false)
    }
    if (matchId) load()
    return () => {
      mounted = false
    }
  }, [matchId])

  const updatePlayerMoney = (index: number, field: keyof FormPlayer, value: any) => {
    if (!formData) return
    const newPlayers = [...formData.players]
    newPlayers[index] = { ...newPlayers[index], [field]: value }
    if (field === "cajitas" || field === "finalChips") {
      const cajitas = newPlayers[index].cajitas || 1
      const finalChips = newPlayers[index].finalChips || 0
      const investment = cajitas * formData.cajiValue
      newPlayers[index].moneyWon = finalChips - investment
    }
    setFormData((prev) => (prev ? { ...prev, players: newPlayers } : prev))
  }

  const validateBalance = useMemo(() => {
    if (!formData) return false
    const totalInvestment = formData.players.reduce((sum, p) => sum + p.cajitas * formData.cajiValue, 0)
    const totalFinalChips = formData.players.reduce((sum, p) => sum + p.finalChips, 0)
    return Math.abs(totalInvestment - totalFinalChips) < 0.01
  }, [formData])

  const handleSave = async () => {
    if (!formData) return
    setSaving(true)
    try {
      await DatabaseService.updateActiveMatch(matchId, {
        date: formData.date,
        cajiValue: formData.cajiValue,
        playerCount: formData.playerCount,
        players: formData.players,
      })
    } finally {
      setSaving(false)
    }
  }

  const openPreview = () => {
    if (!formData || !validateBalance) return
    setShowPreview(true)
  }

  const confirmRegister = async () => {
    setRegistering(true)
    try {
      await DatabaseService.registerActiveMatch(matchId)
      router.push("/?tab=partidas")
    } finally {
      setRegistering(false)
    }
  }

  const onDragEnd = (event: any) => {
    if (!formData) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = formData.players.findIndex((_, i) => i.toString() === String(active.id))
    const newIndex = formData.players.findIndex((_, i) => i.toString() === String(over.id))
    const newPlayers = arrayMove(formData.players, oldIndex, newIndex)
    setFormData({ ...formData, players: newPlayers })
  }

  const createNewPlayer = async (index: number) => {
    if (!newPlayerName.trim() || creatingPlayer) return
    setCreatingPlayer(true)
    try {
      await DatabaseService.createPlayer(newPlayerName.trim())
      const refreshed = await DatabaseService.getAllPlayers()
      setPlayersList(refreshed.map((p) => p.name))
      updatePlayerMoney(index, "name", newPlayerName.trim())
      setNewPlayerName("")
      setNewPlayerInputIndex(null)
    } finally {
      setCreatingPlayer(false)
    }
  }

  if (loading || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Cargando partida...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push("/?tab=partidas")}> 
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Editar Partida</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la Partida</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cajiValue">Valor de una Cajita</Label>
              <Input
                id="cajiValue"
                type="number"
                value={formData.cajiValue}
                onChange={(e) => setFormData({ ...formData, cajiValue: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="playerCount">Número de Jugadores</Label>
              <Select
                value={String(formData.playerCount)}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    playerCount: Number(v),
                    players: Array(Number(v))
                      .fill(null)
                      .map((_, i) =>
                        formData.players[i] || {
                          name: "",
                          cajitas: 1,
                          finalChips: 0,
                          moneyWon: -formData.cajiValue,
                          tieBreak: Math.random(),
                        },
                      ),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8].map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c} jugadores
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-transparent">
          <CardHeader>
            <CardTitle>Jugadores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={formData.players.map((_, i) => i.toString())} strategy={verticalListSortingStrategy}>
                {formData.players.map((player, index) => (
                  <SortablePlayerRow key={index} id={index.toString()} index={index}>
                    <Card className="">
                      <CardContent className="p-4 pl-8 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            {/*  <Label>Jugador {index + 1}</Label> */}                           
                            {newPlayerInputIndex === index ? (
                              <div className="flex gap-2">
                                <Input
                                  value={newPlayerName}
                                  onChange={(e) => setNewPlayerName(e.target.value)}
                                  placeholder="Nombre del nuevo jugador"
                                  className="h-12 text-xl"
                                />
                                <Button onClick={() => createNewPlayer(index)} size="sm" disabled={!newPlayerName.trim() || creatingPlayer}>
                                  {creatingPlayer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                </Button>
                                <Button
                                  onClick={() => {
                                    setNewPlayerInputIndex(null)
                                    setNewPlayerName("")
                                  }}
                                  size="sm"
                                  variant="outline"
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
                                      setNewPlayerInputIndex(index)
                                    } else {
                                      updatePlayerMoney(index, "name", value)
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-12 text-xl">
                                    <SelectValue placeholder="Seleccionar jugador" />
                                  </SelectTrigger>
                                  <SelectContent className="text-base">
                                    {playersList
                                      .filter((p) => !formData.players.some((fp, fpIndex) => fpIndex !== index && fp.name === p))
                                      .map((name) => (
                                        <SelectItem key={name} value={name} className="text-base py-3">
                                          {name}
                                        </SelectItem>
                                      ))}
                                    <SelectItem value="new" className="text-base py-3">+ Crear nuevo jugador</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <Label>Cajitas</Label>
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
                                onFocus={(e) => e.currentTarget.select()}
                                className="text-center"
                                min={1}
                                placeholder="1"
                              />
                            </div>
                            <div>
                              <Label>Total Fichas</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={player.finalChips === 0 ? "" : player.finalChips.toString()}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9]/g, "")
                                  updatePlayerMoney(index, "finalChips", value === "" ? 0 : Number.parseInt(value))
                                }}
                                onFocus={(e) => e.currentTarget.select()}
                                className="text-center"
                                min={0}
                                placeholder="0"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Dinero Ganado/Perdido</Label>
                            <div className={`p-2 rounded text-center font-semibold ${player.moneyWon >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                              ${player.moneyWon.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </SortablePlayerRow>
                ))}
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>

        <Card className={`border-2 ${validateBalance ? "border-emerald-500" : "border-rose-500"}`}>
          <CardContent className="p-4">
            <div className="text-center">
              <div className={`text-lg font-semibold ${validateBalance ? "text-emerald-600" : "text-rose-600"}`}>
                {validateBalance ? "✅ Balance Correcto" : "❌ Balance Incorrecto"}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Total Invertido: ${formData.players.reduce((sum, p) => sum + p.cajitas * formData.cajiValue, 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Fichas Finales: ${formData.players.reduce((sum, p) => sum + p.finalChips, 0).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => router.push("/?tab=partidas")}>
            Volver
          </Button>
          <Button onClick={handleSave} disabled={saving} variant="secondary" className="flex-1">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
          <Button onClick={openPreview} disabled={!validateBalance || formData.players.some((p) => !p.name) || saving} className="flex-1">
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Registrando...
              </>
            ) : (
              "Validar y Registrar Partida"
            )}
          </Button>
        </div>
      </div>
      {formData && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vista previa del registro</DialogTitle>
              <DialogDescription>
                {formData.date} · {formData.playerCount} jugadores · ${" "}
                {formData.cajiValue.toLocaleString()} por cajita
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {([...formData.players]
                .map((p, originalIndex) => ({ ...p, originalIndex }))
                .sort((a, b) => {
                  if (b.moneyWon !== a.moneyWon) return b.moneyWon - a.moneyWon
                  if (a.cajitas !== b.cajitas) return a.cajitas - b.cajitas
                  return (a.tieBreak ?? 0) - (b.tieBreak ?? 0)
                })
              ).map((p, idx) => {
                const pos = idx + 1
                const points = POINTS_DISTRIBUTION[idx] || 0
                return (
                  <div key={p.originalIndex} className="flex items-center justify-between p-3 rounded-xl border">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          pos === 1
                            ? "bg-yellow-500 text-black"
                            : pos === 2
                              ? "bg-slate-400 text-black"
                              : pos === 3
                                ? "bg-orange-500 text-black"
                                : "bg-muted-foreground text-muted"
                        }`}
                      >
                        {pos}
                      </div>
                      <div className="text-lg font-semibold flex items-center gap-2">
                        {pos === 1 && <Trophy className="w-4 h-4" />}
                        {pos === 2 && <Medal className="w-4 h-4" />}
                        {pos === 3 && <Award className="w-4 h-4" />}
                        {p.name || `Jugador ${p.originalIndex + 1}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-base font-semibold ${p.moneyWon >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        ${p.moneyWon.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">{points} pts</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Volver
              </Button>
              <Button onClick={confirmRegister} disabled={registering}>
                {registering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Registrando...
                  </>
                ) : (
                  "Confirmar y Registrar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

