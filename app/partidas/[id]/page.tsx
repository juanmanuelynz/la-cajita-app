"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import * as db from "@/lib/database";
import type { ActiveMatch, Player } from "@/lib/types";
import { POINTS_DISTRIBUTION } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Plus, Trophy, Medal, Award } from "lucide-react";
// Nota: evitamos CSS.Transform.toString para prevenir errores en algunos entornos

interface FormPlayer {
  // playerId es null hasta que el usuario elige un jugador. name queda
  // sincronizado por conveniencia visual (y para drafts legacy que no tienen id).
  playerId: string | null;
  name: string;
  cajitas: number;
  finalChips: number;
  moneyWon: number;
}

export default function EditActiveMatchPage() {
  const params = useParams();
  const rawId = (params as any)?.id;
  const matchId = Array.isArray(rawId) ? rawId[0] : (rawId as string);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [formData, setFormData] = useState<{
    date: string;
    cajiValue: number;
    playerCount: number;
    players: FormPlayer[];
  } | null>(null);
  const [newPlayerInputIndex, setNewPlayerInputIndex] = useState<number | null>(
    null
  );
  const [newPlayerName, setNewPlayerName] = useState("");
  const [creatingPlayer, setCreatingPlayer] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentView, setCurrentView] = useState<"edit" | "close">("edit");

  const [pointsConfig, setPointsConfig] = useState<number[]>([
    ...POINTS_DISTRIBUTION,
  ]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serializa los guardados: nunca hay más de un updateActiveMatch en vuelo, así
  // las respuestas llegan a la DB en el orden de envío. Si se piden más saves
  // mientras uno corre, pendingRef dispara otro al final con el formData más nuevo.
  const hasUserEditedRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const latestFormDataRef = useRef<{
    date: string;
    cajiValue: number;
    playerCount: number;
    players: FormPlayer[];
  } | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const markDirty = () => {
    hasUserEditedRef.current = true;
  };

  const saveNow = async (): Promise<void> => {
    const snap = latestFormDataRef.current;
    if (!snap) return;
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setSaveState("saving");
    try {
      await db.updateActiveMatch(matchId, {
        date: snap.date,
        cajiValue: snap.cajiValue,
        playerCount: snap.playerCount,
        // El server espera playerId opcional (no null). Convertimos los slots
        // vacíos (playerId: null) a ausencia del campo.
        players: snap.players.map((p) => ({
          ...(p.playerId ? { playerId: p.playerId } : {}),
          name: p.name,
          cajitas: p.cajitas,
          finalChips: p.finalChips,
          moneyWon: p.moneyWon,
        })),
      });
      setSaveState("saved");
      setLastSavedAt(new Date());
    } catch {
      setSaveState("error");
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        await saveNow();
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [match, allPlayers] = await Promise.all([
        db.getActiveMatchById(matchId),
        db.getAllPlayers(),
      ]);
      if (!mounted) return;
      setPlayersList(allPlayers);
      if (match) {
        // El JSONB legacy puede no traer playerId — lo hidratamos por nombre
        // contra la tabla de jugadores. tieBreak viejo se descarta.
        const byId = new Map(allPlayers.map((p) => [p.id, p]));
        const byName = new Map(allPlayers.map((p) => [p.name, p]));
        type RawPlayer = Partial<FormPlayer> & { player_id?: string };
        setFormData({
          date: match.date,
          cajiValue: match.caji_value,
          playerCount: match.player_count,
          players: (match.players as RawPlayer[]).map((p) => {
            const id = p.playerId ?? p.player_id ?? null;
            const known = id ? byId.get(id) : p.name ? byName.get(p.name) : null;
            return {
              playerId: known?.id ?? null,
              name: known?.name ?? p.name ?? "",
              cajitas: p.cajitas ?? 1,
              finalChips: p.finalChips ?? 0,
              moneyWon: p.moneyWon ?? 0,
            };
          }),
        });
        const tournament = await db.getTournamentById(match.tournament_id);
        if (!mounted) return;
        if (tournament?.points_config) {
          setPointsConfig(tournament.points_config);
        }
      }
      setLoading(false);
    };
    if (matchId) load();
    return () => {
      mounted = false;
    };
  }, [matchId]);

  const updatePlayerMoney = (
    index: number,
    field: keyof FormPlayer,
    value: any
  ) => {
    if (!formData) return;
    markDirty();
    const newPlayers = [...formData.players];
    newPlayers[index] = { ...newPlayers[index], [field]: value };
    if (field === "cajitas" || field === "finalChips") {
      const cajitas = newPlayers[index].cajitas || 1;
      const finalChips = newPlayers[index].finalChips || 0;
      const investment = cajitas * formData.cajiValue;
      newPlayers[index].moneyWon = finalChips - investment;
    }
    setFormData((prev) => (prev ? { ...prev, players: newPlayers } : prev));
  };

  const balance = useMemo(() => {
    if (!formData) {
      return {
        totalInvestment: 0,
        totalFinalChips: 0,
        diff: 0,
        isBalanced: true,
      };
    }
    const totalInvestment = formData.players.reduce(
      (sum, p) => sum + p.cajitas * formData.cajiValue,
      0
    );
    const totalFinalChips = formData.players.reduce(
      (sum, p) => sum + p.finalChips,
      0
    );
    const diff = totalInvestment - totalFinalChips;
    return {
      totalInvestment,
      totalFinalChips,
      diff,
      isBalanced: Math.abs(diff) < 0.01,
    };
  }, [formData]);

  const validateBalance = balance.isBalanced;

  const emptyPlayerIndices = useMemo(() => {
    if (!formData) return [] as number[];
    return formData.players
      .map((p, i) => (p.finalChips === 0 ? i : -1))
      .filter((i) => i >= 0);
  }, [formData]);

  const canAutoComplete =
    emptyPlayerIndices.length === 1 && balance.diff > 0;

  const autoCompleteLastPlayer = () => {
    if (!canAutoComplete) return;
    updatePlayerMoney(emptyPlayerIndices[0], "finalChips", balance.diff);
  };

  // Mantener latestFormDataRef siempre con el snapshot más reciente para que
  // saveNow() lo lea cuando le toca correr (evita stale closures).
  useEffect(() => {
    latestFormDataRef.current = formData;
  }, [formData]);

  // Auto-guardado con debounce. Solo dispara después de la primera edición
  // del usuario — así el setFormData del load inicial no escribe en la DB.
  useEffect(() => {
    if (!formData) return;
    if (!hasUserEditedRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void saveNow();
    }, 500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, matchId]);

  // Estado online/offline
  useEffect(() => {
    const setFromNavigator = () =>
      setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    setFromNavigator();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Ocultar automáticamente el indicador "Guardado" tras unos segundos
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(t);
  }, [saveState]);

  const openPreview = () => {
    if (!formData || !validateBalance) return;
    setShowPreview(true);
  };

  const goToCloseView = () => {
    // Validar que todos los jugadores tengan nombre antes de ir al cierre
    if (!formData || formData.players.some((p) => !p.playerId)) {
      return;
    }
    setCurrentView("close");
  };

  const goBackToEdit = () => {
    setCurrentView("edit");
  };

  const confirmRegister = async () => {
    setRegistering(true);
    try {
      await db.registerActiveMatch(matchId);
      router.push("/?tab=partidas");
    } finally {
      setRegistering(false);
    }
  };

  const selectPlayer = (index: number, playerId: string) => {
    if (!formData) return;
    const picked = playersList.find((p) => p.id === playerId);
    if (!picked) return;
    markDirty();
    const newPlayers = [...formData.players];
    newPlayers[index] = {
      ...newPlayers[index],
      playerId: picked.id,
      name: picked.name,
    };
    setFormData((prev) => (prev ? { ...prev, players: newPlayers } : prev));
  };

  const createNewPlayer = async (index: number) => {
    if (!newPlayerName.trim() || creatingPlayer) return;
    setCreatingPlayer(true);
    try {
      const created = await db.createPlayer(newPlayerName.trim());
      const refreshed = await db.getAllPlayers();
      setPlayersList(refreshed);
      selectPlayer(index, created.id);
      setNewPlayerName("");
      setNewPlayerInputIndex(null);
    } finally {
      setCreatingPlayer(false);
    }
  };

  const handleBack = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (hasUserEditedRef.current) {
      try {
        await saveNow();
      } catch {
        // ignore
      }
    }
    router.push("/?tab=partidas");
  };

  if (loading || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Cargando partida...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Editar Partida</h1>
            <div className="ml-auto flex items-center gap-2 text-xs">
              {!isOnline ? (
                <div className="flex items-center gap-2 text-rose-500">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Sin conexión
                </div>
              ) : saveState === "saving" ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Guardando...
                </div>
              ) : saveState === "error" ? (
                <div className="flex items-center gap-2 text-rose-500">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Error al
                  guardar
                </div>
              ) : saveState === "saved" ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Guardado
                  {lastSavedAt
                    ? ` ${lastSavedAt
                        .getHours()
                        .toString()
                        .padStart(2, "0")}:${lastSavedAt
                        .getMinutes()
                        .toString()
                        .padStart(2, "0")}`
                    : ""}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {currentView === "edit" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Datos de la Partida</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date" className="text-muted-foreground">
                    Fecha
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => {
                      markDirty();
                      setFormData({ ...formData, date: e.target.value });
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="cajiValue" className="text-muted-foreground">
                    Valor de una Cajita
                  </Label>
                  <Input
                    id="cajiValue"
                    type="number"
                    value={formData.cajiValue}
                    onChange={(e) => {
                      markDirty();
                      setFormData({
                        ...formData,
                        cajiValue: Number(e.target.value),
                      });
                    }}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="playerCount"
                    className="text-muted-foreground"
                  >
                    Número de Jugadores
                  </Label>
                  <Select
                    value={String(formData.playerCount)}
                    onValueChange={(v) => {
                      markDirty();
                      setFormData({
                        ...formData,
                        playerCount: Number(v),
                        players: Array(Number(v))
                          .fill(null)
                          .map(
                            (_, i) =>
                              formData.players[i] || {
                                playerId: null,
                                name: "",
                                cajitas: 1,
                                finalChips: 0,
                                moneyWon: -formData.cajiValue,
                              }
                          ),
                      });
                    }}
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

            <Card className="">
              <CardHeader>
                <CardTitle>Jugadores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.players.map((player, index) => (
                  <Card
                    className="border-0 bg-transparent"
                    key={index}
                    id={index.toString()}
                  >
                    <CardContent className="p-0 py-2">
                      <div className="space-y-4">
                        {/* Player Select and Cajitas */}
                        <div className="flex gap-4">
                          <div className="w-full min-w-[90px]">
                            {/* <Label className="text-muted-foreground">
                              Jugador {index + 1}
                            </Label>*/}
                            {newPlayerInputIndex === index ? (
                              <div className="flex gap-2">
                                <Input
                                  value={newPlayerName}
                                  onChange={(e) =>
                                    setNewPlayerName(e.target.value)
                                  }
                                  placeholder="Nombre del nuevo jugador"
                                  className="h-12 text-xl"
                                />
                                <Button
                                  onClick={() => createNewPlayer(index)}
                                  size="sm"
                                  disabled={
                                    !newPlayerName.trim() || creatingPlayer
                                  }
                                >
                                  {creatingPlayer ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  onClick={() => {
                                    setNewPlayerInputIndex(null);
                                    setNewPlayerName("");
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
                                  value={player.playerId ?? ""}
                                  onValueChange={(value) => {
                                    if (value === "new") {
                                      setNewPlayerInputIndex(index);
                                    } else {
                                      selectPlayer(index, value);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-12 text-xl">
                                    <SelectValue placeholder="Seleccionar" />
                                  </SelectTrigger>
                                  <SelectContent className="text-base">
                                    {playersList
                                      .filter(
                                        (p) =>
                                          !formData.players.some(
                                            (fp, fpIndex) =>
                                              fpIndex !== index &&
                                              fp.playerId === p.id
                                          )
                                      )
                                      .map((p) => (
                                        <SelectItem
                                          key={p.id}
                                          value={p.id}
                                          className="text-base py-3"
                                        >
                                          {p.name}
                                        </SelectItem>
                                      ))}
                                    <SelectItem
                                      value="new"
                                      className="text-base py-3"
                                    >
                                      + Crear nuevo jugador
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <div className="w-full">
                            {/*<Label
                              className="text-muted-foreground"
                              style={{ opacity: 0 }}
                            >
                              Cajitas
                            </Label>*/}
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 flex-shrink-0"
                                onClick={() => {
                                  const newValue = Math.max(
                                    1,
                                    player.cajitas - 1
                                  );
                                  updatePlayerMoney(index, "cajitas", newValue);
                                }}
                                disabled={player.cajitas <= 1}
                              >
                                -
                              </Button>
                              <Input
                                type="text"
                                value={player.cajitas.toString()}
                                readOnly
                                className="text-center text-xl h-12 bg-muted cursor-default min-w-[48px]"
                                placeholder="1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 flex-shrink-0"
                                onClick={() => {
                                  const newValue = Math.min(
                                    999,
                                    player.cajitas + 1
                                  );
                                  updatePlayerMoney(index, "cajitas", newValue);
                                }}
                                disabled={player.cajitas >= 999}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                Volver
              </Button>
              <Button
                onClick={goToCloseView}
                disabled={formData.players.some((p) => !p.playerId)}
                className="flex-1"
              >
                Cerrar Partida
              </Button>
            </div>
          </>
        )}

        {currentView === "close" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-semibold">Cierre de Partida</h2>
            </div>

            <Card className="border-0 bg-transparent shadow-none">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jugador</TableHead>
                      <TableHead className="text-center px-2">Cjts.</TableHead>
                      <TableHead className="text-center pr-2">
                        Fichas Finales
                      </TableHead>
                      <TableHead className="text-center pl-3">
                        Balance
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.players.map((player, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {player.name}
                        </TableCell>
                        <TableCell className="text-center px-2">
                          {player.cajitas}
                        </TableCell>
                        <TableCell className="text-center pr-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={
                              player.finalChips === 0
                                ? ""
                                : player.finalChips.toString()
                            }
                            onChange={(e) => {
                              const value = e.target.value.replace(
                                /[^0-9]/g,
                                ""
                              );
                              updatePlayerMoney(
                                index,
                                "finalChips",
                                value === "" ? 0 : Number.parseInt(value)
                              );
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                            className="text-center w-24 mx-auto"
                            min={0}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-center pl-3">
                          <div
                            className={`font-semibold ${
                              player.moneyWon >= 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            ${player.moneyWon.toLocaleString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card
              className={`border-2 ${
                balance.isBalanced
                  ? "border-emerald-500"
                  : balance.diff > 0
                  ? "border-amber-500"
                  : "border-rose-500"
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="text-center">
                  <div
                    className={`text-lg font-semibold ${
                      balance.isBalanced
                        ? "text-emerald-600"
                        : balance.diff > 0
                        ? "text-amber-600"
                        : "text-rose-600"
                    }`}
                  >
                    {balance.isBalanced
                      ? "✅ Balance Correcto"
                      : balance.diff > 0
                      ? `Faltan $${balance.diff.toLocaleString()} en fichas`
                      : `Sobran $${Math.abs(
                          balance.diff
                        ).toLocaleString()} en fichas`}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Total Invertido: $
                    {balance.totalInvestment.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Fichas Finales: $
                    {balance.totalFinalChips.toLocaleString()}
                  </div>
                </div>
                {canAutoComplete && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={autoCompleteLastPlayer}
                  >
                    Auto-completar {formData.players[emptyPlayerIndices[0]].name ||
                      `Jugador ${emptyPlayerIndices[0] + 1}`}{" "}
                    con ${balance.diff.toLocaleString()}
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={goBackToEdit}
              >
                Volver
              </Button>
              <Button
                onClick={openPreview}
                disabled={
                  !validateBalance || formData.players.some((p) => !p.playerId)
                }
                className="flex-1"
              >
                {registering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                    Registrando...
                  </>
                ) : (
                  "Validar y Registrar Partida"
                )}
              </Button>
            </div>
          </>
        )}
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
              {[...formData.players]
                .map((p, originalIndex) => ({ ...p, originalIndex }))
                .sort((a, b) => {
                  if (b.moneyWon !== a.moneyWon) return b.moneyWon - a.moneyWon;
                  if (a.cajitas !== b.cajitas) return a.cajitas - b.cajitas;
                  // Mismo criterio que createMatch en el servidor: el índice
                  // de carga rompe el empate (gana el que aparece antes).
                  return a.originalIndex - b.originalIndex;
                })
                .map((p, idx) => {
                  const pos = idx + 1;
                  const points = pointsConfig[idx] || 0;
                  return (
                    <div
                      key={p.originalIndex}
                      className="flex items-center justify-between p-3 rounded-xl border"
                    >
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
                        <div
                          className={`text-base font-semibold ${
                            p.moneyWon >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          ${p.moneyWon.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {points} pts
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Volver
              </Button>
              <Button onClick={confirmRegister} disabled={registering}>
                {registering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                    Registrando...
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
  );
}
