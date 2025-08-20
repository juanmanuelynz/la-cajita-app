"use client";

import { useState, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
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
  HelpCircle,
} from "lucide-react";
import { Line, Bar, Scatter } from "react-chartjs-2";
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
} from "chart.js";
import { DatabaseService } from "../lib/database";
import type {
  Player,
  MatchWithPlayers,
  PlayerStats,
  ActiveMatch,
} from "../lib/supabase";
import { PWAInstall } from "@/components/pwa-install";
import { OfflineIndicator } from "@/components/offline-indicator";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface FormPlayer {
  name: string;
  cajitas: number;
  finalChips: number;
  moneyWon: number;
}

const POINTS_DISTRIBUTION = [10, 7, 5, 3, 2, 1, 0, 0];
const PLAYER_COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#feca57",
  "#ff9ff3",
  "#54a0ff",
  "#5f27cd",
];

function LaCajitaPoker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("ranking");

  // Utility function to safely format numbers with Spanish locale
  const formatAmount = (amount: number | string | undefined | null): string => {
    // Handle null, undefined, empty string cases
    if (amount === null || amount === undefined || amount === "") {
      return "0";
    }

    // Convert to number
    const numValue = typeof amount === "string" ? parseFloat(amount) : amount;

    // Handle NaN cases
    if (isNaN(numValue)) {
      return "0";
    }

    // Format with Spanish locale
    return numValue.toLocaleString("es-ES");
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(
    null
  );
  const [showEvolutionChart, setShowEvolutionChart] = useState(true);
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(
    new Set()
  );
  const [expandedPlayerCards, setExpandedPlayerCards] = useState<Set<string>>(
    new Set()
  );
  const [rankingSortBy, setRankingSortBy] = useState<"points" | "money">(
    "money"
  );
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  const getHslColor = (varName: string) => {
    if (typeof window === "undefined") {
      // Fallbacks para SSR
      return varName === "--foreground" ? "#111" : "#e5e5e5";
    }
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return raw
      ? `hsl(${raw})`
      : varName === "--foreground"
      ? "#111"
      : "#e5e5e5";
  };

  // Data states
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalMatches: 0,
    totalCajitas: 0,
    totalMoney: 0,
    activePlayers: 0,
  });

  // Form states
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    cajiValue: 2000,
    playerCount: 4,
    players: Array(4)
      .fill(null)
      .map(() => ({ name: "", cajitas: 1, finalChips: 0, moneyWon: -2000 })),
  });
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedAnalysisPlayer, setSelectedAnalysisPlayer] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [showNewPlayerInput, setShowNewPlayerInput] = useState<number | null>(
    null
  );

  // Load initial data
  useEffect(() => {
    testConnectionAndLoadData();
  }, []);

  // Read tab from query string
  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (
      tabParam &&
      ["ranking", "partidas", "estadisticas", "reglas"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Set all players as selected by default when playerStats loads
  useEffect(() => {
    if (playerStats.length > 0 && selectedPlayers.length === 0) {
      setSelectedPlayers(playerStats.map((player) => player.name));
    }
  }, [playerStats]);

  const testConnectionAndLoadData = async () => {
    console.log("🚀 Starting app initialization...");

    // Test database connection first
    const isConnected = await DatabaseService.testConnection();
    setConnectionStatus(isConnected);

    if (isConnected) {
      await loadAllData();
    } else {
      setError("No se pudo conectar a la base de datos. Verifica tu conexión.");
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("📊 Loading all data...");

      const [
        playersData,
        matchesData,
        statsData,
        overallData,
        activeMatchesData,
      ] = await Promise.all([
        DatabaseService.getAllPlayers(),
        DatabaseService.getAllMatches(),
        DatabaseService.getPlayerStats(),
        DatabaseService.getOverallStats(),
        DatabaseService.getAllActiveMatches(),
      ]);

      console.log("✅ Data loaded successfully:");
      console.log("- Players:", playersData.length);
      console.log("- Matches:", matchesData.length);
      console.log("- Active matches:", activeMatchesData.length);

      setPlayers(playersData);
      setMatches(matchesData);
      setPlayerStats(statsData);
      setOverallStats(overallData);
      setActiveMatches(activeMatchesData);
      setConnectionStatus(true);
    } catch (err) {
      console.error("❌ Error loading data:", err);
      setError(err instanceof Error ? err.message : "Error loading data");
      setConnectionStatus(false);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const refreshData = async () => {
    console.log("🔄 Manual refresh triggered");
    await loadAllData();
  };

  // Create new active match
  const createNewActiveMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("🆕 Creating new active match...");

      const newMatch = await DatabaseService.createActiveMatch({
        date: new Date().toISOString().split("T")[0],
        cajiValue: 2000,
        playerCount: 4,
        players: Array(4)
          .fill(null)
          .map(() => ({
            name: "",
            cajitas: 1,
            finalChips: 0,
            moneyWon: -2000,
          })),
      });

      console.log("✅ New active match created:", newMatch);

      // Reload active matches
      const activeMatchesData = await DatabaseService.getAllActiveMatches();
      setActiveMatches(activeMatchesData);

      // Navegar a pantalla de edición separada
      router.push(`/partidas/${newMatch.id}`);
    } catch (err) {
      console.error("❌ Error creating active match:", err);
      setError(
        err instanceof Error ? err.message : "Error creating active match"
      );
    } finally {
      setLoading(false);
    }
  };

  // Load active match for editing
  const editActiveMatch = (matchId: string) => {
    router.push(`/partidas/${matchId}`);
  };

  // Delete active match
  const deleteActiveMatch = async (matchId: string) => {
    setLoading(true);
    setError(null);
    try {
      await DatabaseService.deleteActiveMatch(matchId);

      // Reload active matches
      const activeMatchesData = await DatabaseService.getAllActiveMatches();
      setActiveMatches(activeMatchesData);

      // If we're editing this match, close the form
      if (editingMatchId === matchId) {
        setShowRegisterForm(false);
        setEditingMatchId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error deleting active match"
      );
    } finally {
      setLoading(false);
    }
  };

  // Update active match
  const updateActiveMatch = async () => {
    if (!editingMatchId) return;

    try {
      await DatabaseService.updateActiveMatch(editingMatchId, {
        date: formData.date,
        cajiValue: formData.cajiValue,
        playerCount: formData.playerCount,
        players: formData.players,
      });

      // Reload active matches to get updated data
      const activeMatchesData = await DatabaseService.getAllActiveMatches();
      setActiveMatches(activeMatchesData);
    } catch (err) {
      console.error("Error updating active match:", err);
    }
  };

  // Update players array when player count changes
  useEffect(() => {
    const newPlayers = Array(formData.playerCount)
      .fill(null)
      .map((_, i) => {
        const existingPlayer = formData.players[i];
        if (existingPlayer) {
          return existingPlayer;
        }
        return { name: "", cajitas: 1, finalChips: 0, moneyWon: -2000 };
      });
    setFormData((prev) => ({ ...prev, players: newPlayers }));
  }, [formData.playerCount]);

  // Update active match when form data changes (debounced)
  useEffect(() => {
    if (editingMatchId && showRegisterForm) {
      const timeoutId = setTimeout(() => {
        updateActiveMatch();
      }, 500); // Debounce for 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [formData, editingMatchId, showRegisterForm]);

  // Calculate money won/lost based on investment and final chips
  const updatePlayerMoney = (index: number, field: string, value: any) => {
    const newPlayers = [...formData.players];
    newPlayers[index] = { ...newPlayers[index], [field]: value };

    if (field === "cajitas" || field === "finalChips") {
      const cajitas = newPlayers[index].cajitas || 1;
      const finalChips = newPlayers[index].finalChips || 0;
      const investment = cajitas * formData.cajiValue;
      newPlayers[index].moneyWon = finalChips - investment;
    }

    setFormData((prev) => ({ ...prev, players: newPlayers }));
  };

  // Validate balance
  const validateBalance = () => {
    const totalInvestment = formData.players.reduce(
      (sum, p) => sum + p.cajitas * formData.cajiValue,
      0
    );
    const totalFinalChips = formData.players.reduce(
      (sum, p) => sum + p.finalChips,
      0
    );
    return Math.abs(totalInvestment - totalFinalChips) < 0.01;
  };

  // Register match (convert active match to real match)
  const registerMatch = async () => {
    if (!validateBalance() || !editingMatchId) return;

    setLoading(true);
    setError(null);
    try {
      await DatabaseService.registerActiveMatch(editingMatchId);

      // Close form and reload all data
      setShowRegisterForm(false);
      setEditingMatchId(null);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error registering match");
    } finally {
      setLoading(false);
    }
  };

  // Create new player
  const createNewPlayer = async (index: number) => {
    if (!newPlayerName.trim()) return;

    setLoading(true);
    try {
      await DatabaseService.createPlayer(newPlayerName.trim());
      await DatabaseService.getAllPlayers().then(setPlayers);

      // Update form with new player
      updatePlayerMoney(index, "name", newPlayerName.trim());
      setNewPlayerName("");
      setShowNewPlayerInput(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating player");
    } finally {
      setLoading(false);
    }
  };

  // Delete match with confirmation (for completed matches in historial)
  const confirmDeleteMatch = (matchId: string) => {
    setMatchToDelete(matchId);
  };

  const deleteMatch = async () => {
    if (!matchToDelete) return;

    setLoading(true);
    try {
      await DatabaseService.deleteMatch(matchToDelete);
      await loadAllData();
      setMatchToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting match");
    } finally {
      setLoading(false);
    }
  };

  // Get chart data
  const getChartData = () => {
    const datasets = selectedPlayers
      .filter((playerName) => playerStats.some((p) => p.name === playerName))
      .map((playerName, index) => {
        const playerMatches = matches
          .filter((match) =>
            match.match_players.some((mp) => mp.players?.name === playerName)
          )
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

        let cumulativePoints = 0;
        const data = playerMatches.map((match) => {
          const playerInMatch = match.match_players.find(
            (mp) => mp.players?.name === playerName
          );
          cumulativePoints += playerInMatch?.points || 0;
          return cumulativePoints;
        });

        return {
          label: playerName,
          data,
          borderColor: PLAYER_COLORS[index % PLAYER_COLORS.length],
          backgroundColor: PLAYER_COLORS[index % PLAYER_COLORS.length] + "20",
          tension: 0.4,
        };
      });

    const maxLength = Math.max(...datasets.map((d) => d.data.length));
    const labels = Array.from(
      { length: maxLength },
      (_, i) => `Partida ${i + 1}`
    );

    return { labels, datasets };
  };

  // Get player's last matches
  const getPlayerLastMatches = (playerName: string) => {
    return matches
      .filter((match) =>
        match.match_players.some((mp) => mp.players?.name === playerName)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((match) => {
        const playerMatch = match.match_players.find(
          (mp) => mp.players?.name === playerName
        )!;
        return {
          position: playerMatch.position,
          moneyWon: playerMatch.money_won,
        };
      });
  };

  // Toggle match expansion
  const toggleMatchExpansion = (matchId: string) => {
    setExpandedMatches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  // Get player's best match
  const getPlayerBestMatch = (playerName: string) => {
    const playerMatches = matches.filter((match) =>
      match.match_players.some((mp) => mp.players?.name === playerName)
    );

    if (playerMatches.length === 0) return null;

    let bestMatch = playerMatches[0];
    let bestMp = bestMatch.match_players.find(
      (mp) => mp.players?.name === playerName
    )!;

    for (const match of playerMatches) {
      const mp = match.match_players.find(
        (mp) => mp.players?.name === playerName
      )!;
      if (mp.money_won > bestMp.money_won) {
        bestMatch = match;
        bestMp = mp;
      }
    }

    return {
      date: bestMatch.date,
      position: bestMp.position,
      moneyWon: bestMp.money_won,
    };
  };

  // Get player's worst match
  const getPlayerWorstMatch = (playerName: string) => {
    const playerMatches = matches.filter((match) =>
      match.match_players.some((mp) => mp.players?.name === playerName)
    );

    if (playerMatches.length === 0) return null;

    let worstMatch = playerMatches[0];
    let worstMp = worstMatch.match_players.find(
      (mp) => mp.players?.name === playerName
    )!;

    for (const match of playerMatches) {
      const mp = match.match_players.find(
        (mp) => mp.players?.name === playerName
      )!;
      if (mp.money_won < worstMp.money_won) {
        worstMatch = match;
        worstMp = mp;
      }
    }

    return {
      date: worstMatch.date,
      position: worstMp.position,
      moneyWon: worstMp.money_won,
    };
  };

  // Componente adaptativo para tooltips en mobile/desktop
  const AdaptiveTooltip = ({
    children,
    content,
    title,
  }: {
    children: React.ReactNode;
    content: React.ReactNode;
    title?: string;
  }) => {
    if (isMobile) {
      return (
        <Dialog>
          <DialogTrigger asChild>{children}</DialogTrigger>
          <DialogContent className="max-w-sm">
            {title && (
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>
            )}
            <div className="text-sm">{content}</div>
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <TooltipProvider>
        <UITooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent className="max-w-sm">{content}</TooltipContent>
        </UITooltip>
      </TooltipProvider>
    );
  };

  // Get sorted player stats based on current sort criteria
  const getSortedPlayerStats = () => {
    return [...playerStats]
      .filter((player) => player.matches > 0) // Only show players who have played matches
      .sort((a, b) => {
        if (rankingSortBy === "points") {
          // Sort by: 1) Points (desc), 2) Money (desc), 3) Cajitas (asc - less cajitas wins)
          if (b.points !== a.points) {
            return b.points - a.points;
          }
          if (b.moneyWon !== a.moneyWon) {
            return b.moneyWon - a.moneyWon;
          }
          return a.cajitas - b.cajitas;
        } else {
          // Sort by: 1) Money (desc), 2) Points (desc), 3) Cajitas (asc - less cajitas wins)
          if (b.moneyWon !== a.moneyWon) {
            return b.moneyWon - a.moneyWon;
          }
          if (b.points !== a.points) {
            return b.points - a.points;
          }
          return a.cajitas - b.cajitas;
        }
      });
  };

  const togglePlayerCard = (playerId: string) => {
    const newExpanded = new Set(expandedPlayerCards);
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId);
    } else {
      newExpanded.add(playerId);
    }
    setExpandedPlayerCards(newExpanded);
  };

  // Función para calcular ROI total para cada jugador
  const calculateROIPerPlayer = () => {
    const playerData: {
      [playerName: string]: { totalInvestment: number; totalMoney: number };
    } = {};

    // Procesar cada partida para acumular inversión total y dinero total ganado
    matches.forEach((match) => {
      match.match_players.forEach((mp) => {
        const playerName = mp.players.name;
        if (!playerData[playerName]) {
          playerData[playerName] = { totalInvestment: 0, totalMoney: 0 };
        }

        // Acumular inversión total (cajitas × valor de cada cajita)
        const investment = mp.cajitas * match.caji_value;
        playerData[playerName].totalInvestment += investment;
        playerData[playerName].totalMoney += mp.money_won;
      });
    });

    // Calcular ROI total: (dinero_total_ganado / inversión_total) * 100
    const roiData: { [playerName: string]: number } = {};
    Object.keys(playerData).forEach((playerName) => {
      const { totalInvestment, totalMoney } = playerData[playerName];
      const roi =
        totalInvestment > 0 ? (totalMoney / totalInvestment) * 100 : 0;
      roiData[playerName] = roi;
    });

    // Ordenar de mayor a menor ROI
    const sortedEntries = Object.entries(roiData)
      .filter(([_, roi]) => !isNaN(roi))
      .sort(([, a], [, b]) => b - a);

    return Object.fromEntries(sortedEntries);
  };

  // Función para formatear datos para el gráfico de barras
  const formatROIForBarChart = () => {
    const roiData = calculateROIPerPlayer();
    const labels = Object.keys(roiData);
    const data = Object.values(roiData);
    const backgroundColor = data.map((roi) =>
      roi >= 0 ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)"
    );
    const borderColor = data.map((roi) =>
      roi >= 0 ? "rgba(34, 197, 94, 1)" : "rgba(239, 68, 68, 1)"
    );

    return {
      labels,
      data,
      backgroundColor,
      borderColor,
    };
  };

  // Función para calcular las mayores recuperaciones en una sola noche
  const calculateTopComebacks = () => {
    const comebacks: {
      jugador: string;
      comeback_amount: number;
      fecha: string;
      partida_detalle: {
        dinero_inicial: number;
        punto_mas_bajo: number;
        dinero_final: number;
        cajitas: number;
        monto_invertido: number;
      };
    }[] = [];

    matches.forEach((match) => {
      match.match_players.forEach((mp) => {
        const playerName = mp.players.name;
        const inversionTotal = mp.cajitas * match.caji_value; // Total invertido en cajitas
        const dineroFinal = mp.final_chips;

        // El punto más bajo real es cuando ha invertido todo (cajitas) pero aún no ha ganado nada
        // Es decir, está en -inversión_total antes de empezar a ganar
        const puntoMasBajo = 0; // Punto de referencia neutral
        const dineroNeto = mp.money_won; // Dinero ganado/perdido después de descontar inversión

        // Solo consideramos recuperaciones significativas (cuando ganan dinero después de invertir)
        // Y que la recuperación sea desde un punto negativo o de pérdida importante
        if (dineroNeto > 0) {
          // La recuperación es desde -inversión hasta el resultado neto positivo
          // Esto representa cuánto tuvo que "recuperar" desde su inversión inicial
          const comebackAmount = inversionTotal + dineroNeto;

          comebacks.push({
            jugador: playerName,
            comeback_amount: comebackAmount,
            fecha: match.date,
            partida_detalle: {
              dinero_inicial: 0, // Empieza sin dinero
              punto_mas_bajo: -inversionTotal, // Después de invertir las cajitas
              dinero_final: dineroNeto, // Ganancia neta final
              cajitas: mp.cajitas,
              monto_invertido: inversionTotal, // Agregamos el monto invertido
            },
          });
        }
      });
    });

    // Ordenar por mayor recuperación y tomar top 3
    return comebacks
      .sort((a, b) => b.comeback_amount - a.comeback_amount)
      .slice(0, 3);
  };

  // Función para formatear datos para el podio
  const formatForPodium = () => {
    return calculateTopComebacks();
  };

  // Función para obtener el top comeback para la card principal
  const getTopComeback = () => {
    const topComebacks = calculateTopComebacks();
    return topComebacks.length > 0 ? topComebacks[0] : null;
  };

  // Función para calcular eficiencia vs inversión
  const calculateEfficiencyAnalysis = () => {
    const playerAnalysis: {
      [playerName: string]: {
        inversion_total: number;
        cajitas_total: number;
        partidas: number;
        dinero_ganado_total: number;
      };
    } = {};

    // Procesar cada partida para acumular totales
    matches.forEach((match) => {
      match.match_players.forEach((mp) => {
        const playerName = mp.players.name;
        if (!playerAnalysis[playerName]) {
          playerAnalysis[playerName] = {
            inversion_total: 0,
            cajitas_total: 0,
            partidas: 0,
            dinero_ganado_total: 0,
          };
        }

        const inversion = mp.cajitas * match.caji_value;

        playerAnalysis[playerName].inversion_total += inversion;
        playerAnalysis[playerName].cajitas_total += mp.cajitas;
        playerAnalysis[playerName].partidas += 1;
        playerAnalysis[playerName].dinero_ganado_total += mp.money_won;
      });
    });

    // Calcular eficiencia total y promedios
    return Object.entries(playerAnalysis)
      .map(([jugador, data]) => {
        // Eficiencia total: dinero_ganado_total / inversion_total
        const eficiencia_total =
          data.inversion_total > 0
            ? data.dinero_ganado_total / data.inversion_total
            : 0;
        const cajitas_promedio =
          data.partidas > 0 ? data.cajitas_total / data.partidas : 0;
        const cuadrante = getCuadrante(eficiencia_total, cajitas_promedio);

        return {
          jugador,
          eficiencia_promedio: eficiencia_total, // Renombrado para mantener compatibilidad
          cajitas_promedio,
          cuadrante,
          partidas: data.partidas,
          dinero_ganado_total: data.dinero_ganado_total,
        };
      })
      .filter((player) => player.partidas > 0);
  };

  // Función para determinar el cuadrante
  const getCuadrante = (eficiencia: number, riesgo: number) => {
    const eficienciaMediana = 0; // Punto neutro (break-even)
    const riesgoMediano = 2; // Promedio de cajitas como punto de referencia

    if (eficiencia >= eficienciaMediana && riesgo < riesgoMediano) {
      return "Genio"; // Alta eficiencia, bajo riesgo
    } else if (eficiencia >= eficienciaMediana && riesgo >= riesgoMediano) {
      return "Apostador"; // Alta eficiencia, alto riesgo
    } else if (eficiencia < eficienciaMediana && riesgo < riesgoMediano) {
      return "Conservador"; // Baja eficiencia, bajo riesgo
    } else {
      return "Temerario"; // Baja eficiencia, alto riesgo
    }
  };

  // Función para formatear datos para el scatter plot
  const formatForQuadrantChart = () => {
    const analysis = calculateEfficiencyAnalysis();

    const datasets = [
      {
        label: "Genio",
        data: analysis
          .filter((p) => p.cuadrante === "Genio")
          .map((p) => ({
            x: p.cajitas_promedio,
            y: p.eficiencia_promedio * 100, // Convertir a porcentaje
            jugador: p.jugador,
          })),
        backgroundColor: "rgba(34, 197, 94, 0.8)",
        borderColor: "rgba(34, 197, 94, 1)",
      },
      {
        label: "Apostador",
        data: analysis
          .filter((p) => p.cuadrante === "Apostador")
          .map((p) => ({
            x: p.cajitas_promedio,
            y: p.eficiencia_promedio * 100,
            jugador: p.jugador,
          })),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgba(59, 130, 246, 1)",
      },
      {
        label: "Conservador",
        data: analysis
          .filter((p) => p.cuadrante === "Conservador")
          .map((p) => ({
            x: p.cajitas_promedio,
            y: p.eficiencia_promedio * 100,
            jugador: p.jugador,
          })),
        backgroundColor: "rgba(156, 163, 175, 0.8)",
        borderColor: "rgba(156, 163, 175, 1)",
      },
      {
        label: "Temerario",
        data: analysis
          .filter((p) => p.cuadrante === "Temerario")
          .map((p) => ({
            x: p.cajitas_promedio,
            y: p.eficiencia_promedio * 100,
            jugador: p.jugador,
          })),
        backgroundColor: "rgba(239, 68, 68, 0.8)",
        borderColor: "rgba(239, 68, 68, 1)",
      },
    ];

    return datasets.filter((dataset) => dataset.data.length > 0);
  };

  const tabs = [
    { id: "ranking", label: "Ranking Anual" },
    { id: "partidas", label: "Partidas" },
    { id: "estadisticas", label: "Estadísticas" },
    { id: "reglas", label: "Reglas" },
  ];

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
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-2">
              ♠️ La Cajita
            </h1>
          </div>
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
                <Button
                  onClick={() => setError(null)}
                  variant="outline"
                  size="sm"
                >
                  Cerrar
                </Button>
                <Button onClick={refreshData} size="sm">
                  Reintentar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info (only in development) */}
        {process.env.NODE_ENV === "development" && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">Debug Info</h3>
              <div className="text-sm space-y-1">
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
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle className="text-xl">Confirmar Eliminación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  ¿Estás seguro de que quieres eliminar esta partida? Esta
                  acción no se puede deshacer.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setMatchToDelete(null)}
                  >
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

        {/* Ranking Anual Tab */}
        {activeTab === "ranking" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Tabla Anual</h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-2 text-left">Pos</th>
                    <th className="py-2 px-2 text-left">Jugador</th>
                    <th className="py-2 px-2 text-center">Dinero</th>
                    <th className="py-2 px-2 text-center">Puntos</th>
                    <th className="py-2 px-2 text-center hidden md:table-cell">
                      Partidas
                    </th>
                    <th className="py-2 px-2 text-center hidden md:table-cell">
                      Cajitas
                    </th>
                    <th className="py-2 px-2 text-center hidden md:table-cell">
                      Promedio/Partida
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedPlayerStats().map((player, index) => (
                    <tr
                      key={player.id}
                      className={`border-b ${
                        theme === "dark"
                          ? index === 0
                            ? "bg-yellow-800/40"
                            : index === 1
                            ? "bg-slate-600/50"
                            : index === 2
                            ? "bg-orange-800/40"
                            : ""
                          : index === 0
                          ? "bg-amber-100"
                          : index === 1
                          ? "bg-zinc-200"
                          : index === 2
                          ? "bg-orange-100"
                          : ""
                      }`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <span
                            className={`font-semibold text-sm ${
                              theme === "dark"
                                ? index === 0
                                  ? "text-yellow-400"
                                  : index === 1
                                  ? "text-slate-300"
                                  : index === 2
                                  ? "text-orange-400"
                                  : ""
                                : index === 0
                                ? "text-yellow-600"
                                : index === 1
                                ? "text-gray-600"
                                : index === 2
                                ? "text-orange-600"
                                : ""
                            }`}
                          >
                            {index + 1}
                          </span>
                          {index === 0 && (
                            <Trophy
                              className={`w-4 h-4 ${
                                theme === "dark"
                                  ? "text-yellow-400"
                                  : "text-yellow-600"
                              }`}
                            />
                          )}
                          {index === 1 && (
                            <Medal
                              className={`w-4 h-4 ${
                                theme === "dark"
                                  ? "text-slate-300"
                                  : "text-gray-600"
                              }`}
                            />
                          )}
                          {index === 2 && (
                            <Award
                              className={`w-4 h-4 ${
                                theme === "dark"
                                  ? "text-orange-400"
                                  : "text-orange-600"
                              }`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 font-semibold text-sm">
                        {player.name}
                      </td>
                      <td
                        className={`py-3 px-2 text-center font-semibold text-sm ${
                          player.moneyWon >= 0
                            ? "text-emerald-500"
                            : "text-rose-500"
                        }`}
                      >
                        ${formatAmount(player.moneyWon)}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-sm">
                        {player.points}
                      </td>
                      <td className="py-3 px-2 text-center hidden md:table-cell text-sm">
                        {player.matches}
                      </td>
                      <td className="py-3 px-2 text-center hidden md:table-cell text-sm">
                        {player.cajitas}
                      </td>
                      <td
                        className={`py-3 px-2 text-center hidden md:table-cell text-sm ${
                          player.averagePerMatch >= 0
                            ? "text-emerald-500"
                            : "text-rose-500"
                        }`}
                      >
                        ${formatAmount(Math.round(player.averagePerMatch))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sort Toggle Switch */}
            <div className="flex items-center justify-center gap-4">
              <span
                className={`text-sm font-medium ${
                  rankingSortBy === "money" ? "" : "text-muted-foreground"
                }`}
              >
                Dinero
              </span>
              <Switch
                checked={rankingSortBy === "points"}
                onCheckedChange={(checked) =>
                  setRankingSortBy(checked ? "points" : "money")
                }
                aria-label="Cambiar orden de ranking"
              />
              <span
                className={`text-sm font-medium ${
                  rankingSortBy === "points" ? "" : "text-muted-foreground"
                }`}
              >
                Puntos
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
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl">
                      Partidas ({activeMatches.length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button onClick={createNewActiveMatch} disabled={loading}>
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
                        <p className="mb-4">No hay partidas activas</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeMatches.map((match) => {
                          const playersWithNames = match.players.filter(
                            (p) => p.name.trim() !== ""
                          );
                          const totalInvestment = match.players.reduce(
                            (sum, p) => sum + p.cajitas * match.caji_value,
                            0
                          );
                          const isComplete =
                            playersWithNames.length === match.player_count &&
                            playersWithNames.every((p) => p.finalChips > 0);

                          return (
                            <Card key={match.id}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex flex-col gap-2">
                                    <div className="text-lg font-semibold">
                                      {match.date}
                                    </div>
                                    {/*
                                    <div className={`px-2 py-1 rounded text-xs font-semibold w-fit ${
                                      isComplete ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"
                                    }`}>
                                      {isComplete ? "Lista para registrar" : "En progreso"}
                                    </div>
                                    */}
                                    <div className="text-sm text-muted-foreground">
                                      {playersWithNames.length}/
                                      {match.player_count} jugadores - $
                                      {formatAmount(totalInvestment)}
                                    </div>
                                    {/*
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Actualizado:{" "}
                                      {new Date(match.updated_at).toLocaleTimeString()}
                                    </div>}
                                    */}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => editActiveMatch(match.id)}
                                    >
                                      <NotebookPen className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        deleteActiveMatch(match.id)
                                      }
                                      disabled={loading}
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
                                        className="flex items-center justify-between p-2 bg-muted rounded"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-muted-foreground flex items-center justify-center text-xs font-bold text-muted">
                                            {index + 1}
                                          </div>
                                          <span className="text-sm">
                                            {player.name}
                                          </span>
                                        </div>
                                        <span
                                          className={`text-sm font-semibold ${
                                            player.moneyWon >= 0
                                              ? "text-emerald-500"
                                              : "text-rose-500"
                                          }`}
                                        >
                                          {/*{player.finalChips > 0 ? `$${player.moneyWon.toLocaleString()}` : "Pendiente"}*/}
                                          {`$${formatAmount(player.moneyWon)}`}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Formulario de Registro */
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowRegisterForm(false);
                        setEditingMatchId(null);
                      }}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <CardTitle className="text-2xl">
                      {editingMatchId ? "Editando Partida" : "Nueva Partida"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="date">Fecha</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            date: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="cajiValue">Valor de una Cajita</Label>
                      <Input
                        id="cajiValue"
                        type="number"
                        value={formData.cajiValue}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            cajiValue: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="playerCount">Número de Jugadores</Label>
                      <Select
                        value={formData.playerCount.toString()}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            playerCount: Number(value),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[4, 5, 6, 7, 8].map((count) => (
                            <SelectItem key={count} value={count.toString()}>
                              {count} jugadores
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Jugadores</h3>
                    {formData.players.map((player, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label>Jugador {index + 1}</Label>
                              {showNewPlayerInput === index ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={newPlayerName}
                                    onChange={(e) =>
                                      setNewPlayerName(e.target.value)
                                    }
                                    placeholder="Nombre del nuevo jugador"
                                  />
                                  <Button
                                    onClick={() => createNewPlayer(index)}
                                    size="sm"
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
                                      setShowNewPlayerInput(null);
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
                                    value={player.name}
                                    onValueChange={(value) => {
                                      if (value === "new") {
                                        setShowNewPlayerInput(index);
                                      } else {
                                        updatePlayerMoney(index, "name", value);
                                      }
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccionar jugador" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {players
                                        .filter(
                                          (p) =>
                                            !formData.players.some(
                                              (fp, fpIndex) =>
                                                fpIndex !== index &&
                                                fp.name === p.name
                                            )
                                        )
                                        .map((p) => (
                                          <SelectItem key={p.id} value={p.name}>
                                            {p.name}
                                          </SelectItem>
                                        ))}
                                      <SelectItem value="new">
                                        + Crear nuevo jugador
                                      </SelectItem>
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
                                    const value = e.target.value.replace(
                                      /[^0-9]/g,
                                      ""
                                    );
                                    if (
                                      value === "" ||
                                      (Number.parseInt(value) >= 1 &&
                                        Number.parseInt(value) <= 999)
                                    ) {
                                      updatePlayerMoney(
                                        index,
                                        "cajitas",
                                        value === ""
                                          ? 1
                                          : Number.parseInt(value)
                                      );
                                    }
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="text-center"
                                  min="1"
                                  placeholder="1"
                                />
                              </div>
                              <div>
                                <Label>Fichas Totales</Label>
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
                                  onFocus={(e) => e.target.select()}
                                  className="text-center"
                                  min="0"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Dinero Ganado/Perdido</Label>
                              <div
                                className={`p-2 rounded text-center font-semibold ${
                                  player.moneyWon >= 0
                                    ? "text-emerald-500"
                                    : "text-rose-500"
                                }`}
                              >
                                ${formatAmount(player.moneyWon)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card
                    className={`border-2 ${
                      validateBalance()
                        ? "border-emerald-500"
                        : "border-rose-500"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div
                          className={`text-lg font-semibold ${
                            validateBalance()
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {validateBalance()
                            ? "✅ Balance Correcto"
                            : "❌ Balance Incorrecto"}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          Total Invertido: $
                          {formatAmount(
                            formData.players.reduce(
                              (sum, p) => sum + p.cajitas * formData.cajiValue,
                              0
                            )
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total Fichas Finales: $
                          {formatAmount(
                            formData.players.reduce(
                              (sum, p) => sum + p.finalChips,
                              0
                            )
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setShowRegisterForm(false);
                        setEditingMatchId(null);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Volver
                    </Button>
                    <Button
                      onClick={registerMatch}
                      disabled={
                        !validateBalance() ||
                        formData.players.some((p) => !p.name) ||
                        loading
                      }
                      className="flex-1"
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
            <Card className="border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-2xl">
                  Historial de Partidas
                </CardTitle>
                <Button
                  onClick={refreshData}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-200 overflow-y-auto space-y-4 custom-scrollbar">
                  {matches.map((match) => {
                    const isExpanded = expandedMatches.has(match.id);
                    const winner = match.match_players.find(
                      (mp) => mp.position === 1
                    );

                    return (
                      <Card key={match.id}>
                        <CardContent className="p-4">
                          <div
                            className="flex justify-between items-start cursor-pointer hover:bg-muted rounded p-2 -m-2 transition-colors"
                            onClick={() => toggleMatchExpansion(match.id)}
                          >
                            <div className="flex-1">
                              <div className="text-lg font-semibold">
                                {match.date}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {match.player_count} jugadores - $
                                {formatAmount(match.total_money)}
                              </div>
                              {winner && (
                                <div className="text-sm mt-1">
                                  🏆 Ganador: {winner.players?.name}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <div className="text-sm">
                                  Dinero total jugado:{" "}
                                  <span className="font-semibold">
                                    ${formatAmount(match.total_money)}
                                  </span>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDeleteMatch(match.id);
                                  }}
                                  disabled={loading}
                                >
                                  {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                {match.match_players
                                  .sort((a, b) => a.position - b.position)
                                  .map((mp) => (
                                    <div
                                      key={mp.id}
                                      className="flex items-center justify-between p-2 bg-muted rounded"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                            mp.position === 1
                                              ? "bg-yellow-500 text-black"
                                              : mp.position === 2
                                              ? "bg-slate-400 text-black"
                                              : mp.position === 3
                                              ? "bg-orange-500 text-black"
                                              : "bg-muted-foreground text-muted"
                                          }`}
                                        >
                                          {mp.position}
                                        </div>
                                        <span className="text-sm">
                                          {mp.players?.name}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-sm font-semibold ${
                                          mp.money_won >= 0
                                            ? "text-emerald-500"
                                            : "text-rose-500"
                                        }`}
                                      >
                                        ${formatAmount(mp.money_won)}{" "}
                                        <span className="text-xs text-muted-foreground font-normal">
                                          ({mp.cajitas} cajita
                                          {mp.cajitas !== 1 ? "s" : ""})
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
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
            <h2 className="text-2xl font-bold">Análisis Individual</h2>
            <div className="space-y-4">
              {getSortedPlayerStats().map((player) => {
                const isExpanded = expandedPlayerCards.has(player.id);
                return (
                  <Card key={player.id}>
                    <CardContent className="p-0">
                      {/* Header siempre visible */}
                      <div
                        className="p-5 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => togglePlayerCard(player.id)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="text-2xl font-light">
                            {player.name}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-xl font-semibold">
                              ${formatAmount(player.moneyWon)}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contenido colapsable */}
                      {isExpanded && (
                        <div className="px-5 pb-5 flex flex-col gap-2">
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="text-center">
                              <Award className="w-8 h-8 mx-auto mb-2" />
                              <div className="text-xl font-bold">
                                {player.points}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Puntos
                              </div>
                            </div>
                            <div className="text-center">
                              <Cannabis className="w-8 h-8 mx-auto mb-2" />
                              <div className="text-xl font-bold">
                                {player.matches}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Partidas
                              </div>
                            </div>
                            <div className="text-center">
                              <Coins className="w-8 h-8 mx-auto mb-2" />
                              <div className="text-xl font-bold">
                                {player.cajitas}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Cajitas
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {getPlayerBestMatch(player.name) && (
                              <div className="flex flex-col items-center p-2 bg-emerald-800/30 rounded-lg">
                                <div className="flex items-center justify-between mb-2 w-full">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    <span className="text-sm text-emerald-600 font-semibold">
                                      P
                                      {
                                        getPlayerBestMatch(player.name)
                                          ?.position
                                      }
                                    </span>
                                  </div>
                                  <div className="text-sm text-emerald-600 font-semibold">
                                    $
                                    {formatAmount(
                                      getPlayerBestMatch(player.name)?.moneyWon
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-emerald-50/50">
                                    {getPlayerBestMatch(player.name)?.date}
                                  </div>
                                </div>
                              </div>
                            )}
                            {getPlayerWorstMatch(player.name) && (
                              <div className="flex flex-col items-center p-2 bg-rose-800/30 rounded-lg">
                                <div className="flex items-center justify-between mb-2 w-full">
                                  <div className="flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-rose-500" />
                                    <span className="text-sm text-rose-500 font-semibold">
                                      P
                                      {
                                        getPlayerWorstMatch(player.name)
                                          ?.position
                                      }
                                    </span>
                                  </div>
                                  <div className="text-sm text-rose-500 font-semibold">
                                    $
                                    {formatAmount(
                                      getPlayerWorstMatch(player.name)?.moneyWon
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-rose-50/50">
                                    {getPlayerWorstMatch(player.name)?.date}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm">Últimas 5 partidas</span>
                            <div className="flex gap-1">
                              {getPlayerLastMatches(player.name)
                                .slice(0, 5)
                                .map((match, index) => (
                                  <div
                                    key={index}
                                    className={`w-5 h-5 rounded-sm flex items-center justify-center text-xs font-normal ${
                                      match.moneyWon >= 0
                                        ? "bg-emerald-500 text-white"
                                        : "bg-rose-500 text-white"
                                    }`}
                                  >
                                    {match.position}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Top 3 */}
            {/* Helper functions */}
            {(() => {
              // Flatten all partidas individuales
              type PartidaFlat = {
                jugador: string;
                dinero_ganado: number;
                fecha: string;
                cajitas: number;
                rank?: number;
              };
              const partidasFlat: PartidaFlat[] = matches.flatMap((match) =>
                match.match_players.map((mp) => ({
                  jugador: mp.players.name,
                  dinero_ganado: mp.money_won,
                  fecha: match.date,
                  cajitas: mp.cajitas,
                }))
              );

              // Top 3 ganadores
              const getTopWins = (
                partidas: PartidaFlat[],
                limit: number = 3
              ): PartidaFlat[] =>
                partidas
                  .filter((p: PartidaFlat) => p.dinero_ganado > 0)
                  .sort(
                    (a: PartidaFlat, b: PartidaFlat) =>
                      b.dinero_ganado - a.dinero_ganado
                  )
                  .slice(0, limit)
                  .map((p: PartidaFlat, i: number) => ({ ...p, rank: i + 1 }));

              // Top 3 perdedores
              const getTopLosses = (
                partidas: PartidaFlat[],
                limit: number = 3
              ): PartidaFlat[] =>
                partidas
                  .filter((p: PartidaFlat) => p.dinero_ganado < 0)
                  .sort(
                    (a: PartidaFlat, b: PartidaFlat) =>
                      a.dinero_ganado - b.dinero_ganado
                  )
                  .slice(0, limit)
                  .map((p: PartidaFlat, i: number) => ({ ...p, rank: i + 1 }));

              const topWins: PartidaFlat[] = getTopWins(partidasFlat);
              const topLosses: PartidaFlat[] = getTopLosses(partidasFlat);

              return (
                <>
                  {/* Card 1: Mejores Partidas */}
                  <Card className="flex-1 ">
                    <CardHeader>
                      <CardTitle className="text-white text-xl flex items-center gap-2">
                        💰 Mejores Partidas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {topWins.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6">
                          No hay datos
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {topWins.map((p: PartidaFlat) => (
                            <div
                              key={p.rank}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-white text-xl font-bold w-6 text-center">
                                  {p.rank}
                                </span>
                                <span className="text-white font-semibold text-base md:text-lg">
                                  {p.jugador}
                                </span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-emerald-400 text-lg">
                                  ${formatAmount(p.dinero_ganado)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {p.fecha}
                                </span>
                                <span className="text-xs text-white/70">
                                  {p.cajitas} cajitas
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card 2: Peores Partidas */}
                  <Card className="flex-1">
                    <CardHeader>
                      <CardTitle className="text-white text-xl flex items-center gap-2">
                        💸 Peores Partidas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {topLosses.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6">
                          No hay datos
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {topLosses.map((p: PartidaFlat) => (
                            <div
                              key={p.rank}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-white text-xl font-bold w-6 text-center">
                                  {p.rank}
                                </span>
                                <span className="text-white font-semibold text-base md:text-lg">
                                  {p.jugador}
                                </span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-rose-400 text-lg">
                                  ${formatAmount(p.dinero_ganado)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {p.fecha}
                                </span>
                                <span className="text-xs text-white/70">
                                  {p.cajitas} cajitas
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}

            {/* Mayores Recuperaciones */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">
                    Mayores Recuperaciones
                  </CardTitle>
                  <AdaptiveTooltip
                    title="¿Qué es una Recuperación?"
                    content={
                      <div className="space-y-2">
                        <p>
                          Una <strong>recuperación</strong> mide cuánto dinero
                          logró ganar un jugador después de haber invertido en
                          cajitas.
                        </p>
                        <div className="space-y-1 text-sm">
                          <p>
                            <strong>Inversión:</strong> Dinero gastado en
                            cajitas al inicio
                          </p>
                          <p>
                            <strong>Recuperación:</strong> Inversión total +
                            ganancia neta final
                          </p>
                          <p>
                            <strong>Solo se cuentan:</strong> Partidas donde se
                            gana dinero
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Fórmula: Cajitas invertidas + Ganancia neta
                        </p>
                      </div>
                    }
                  >
                    <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
                  </AdaptiveTooltip>
                </div>
                <p className="text-sm text-muted-foreground">
                  Las remontadas más épicas en una sola partida
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Card destacada para el #1 */}
                {getTopComeback() && (
                  <Card className="border-2 border-yellow-500/50 ">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-3xl">🥇</div>
                        <div>
                          <h3 className="font-bold text-lg">
                            {getTopComeback()!.jugador}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {getTopComeback()!.fecha}
                          </p>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-2xl font-bold text-emerald-600">
                            +$
                            {formatAmount(getTopComeback()!.comeback_amount)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Recuperación
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div>
                          <div className="font-semibold text-white">
                            {getTopComeback()!.partida_detalle.cajitas}
                          </div>
                          <div className="text-muted-foreground">Cajitas</div>
                        </div>
                        <div>
                          <div className="font-semibold text-rose-600">
                            $
                            {formatAmount(
                              getTopComeback()!.partida_detalle.punto_mas_bajo
                            )}
                          </div>
                          <div className="text-muted-foreground">Invertido</div>
                        </div>
                        <div>
                          <div className="font-semibold text-emerald-600">
                            +$
                            {formatAmount(
                              getTopComeback()!.partida_detalle.dinero_final
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            Ganancia neta
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Podio 2do y 3er puesto */}
                <div className="grid grid-cols-2 gap-4">
                  {formatForPodium()
                    .slice(1, 3)
                    .map((comeback, index) => {
                      const position = index + 2; // +2 porque empezamos desde el 2do puesto
                      const medals = ["🥈", "🥉"];
                      const borderColors = [
                        "border-gray-400/50",
                        "border-orange-600/50",
                      ];

                      return (
                        <Card
                          key={`${comeback.jugador}-${comeback.fecha}`}
                          className={`${borderColors[index]} border-2`}
                        >
                          <CardContent className="p-3 text-center">
                            <div className="text-2xl mb-2">{medals[index]}</div>
                            <div className="font-semibold text-sm mb-1">
                              {comeback.jugador}
                            </div>
                            <div className="text-lg font-bold text-emerald-600 mb-1">
                              +${formatAmount(comeback.comeback_amount)}
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                              {comeback.fecha}
                            </div>
                            <div className="text-xs text-rose-600">
                              $
                              {formatAmount(
                                comeback.partida_detalle.monto_invertido
                              )}{" "}
                              invertido
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>

                {formatForPodium().length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay datos de recuperaciones disponibles</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ROI por Cajita */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">ROI por Cajita (%)</CardTitle>
                  <AdaptiveTooltip
                    title="¿Qué es el ROI?"
                    content={
                      <div className="space-y-2">
                        <p>
                          El <strong>ROI (Return on Investment)</strong> mide
                          cuánto dinero ganas o pierdes por cada peso que
                          inviertes en cajitas.
                        </p>
                        <div className="space-y-1 text-sm">
                          <p>
                            <strong>ROI positivo:</strong> Ganas más de lo que
                            inviertes
                          </p>
                          <p>
                            <strong>ROI negativo:</strong> Pierdes dinero
                          </p>
                          <p>
                            <strong>ROI = 0%:</strong> Recuperas exactamente tu
                            inversión
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Fórmula: (Dinero ganado / Dinero invertido) × 100
                        </p>
                      </div>
                    }
                  >
                    <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
                  </AdaptiveTooltip>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retorno de inversión promedio por cajita comprada
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <Bar
                    data={{
                      labels: formatROIForBarChart().labels,
                      datasets: [
                        {
                          label: "ROI (%)",
                          data: formatROIForBarChart().data,
                          backgroundColor:
                            formatROIForBarChart().backgroundColor,
                          borderColor: formatROIForBarChart().borderColor,
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      indexAxis: "y" as const,
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const value = context.parsed.x;
                              return `ROI: ${value.toFixed(1)}%`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: "ROI (%)",
                          },
                          ticks: {
                            callback: function (value) {
                              return value + "%";
                            },
                          },
                        },
                        y: {
                          title: {
                            display: true,
                            text: "Jugadores",
                          },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Análisis de Eficiencia vs Inversión */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">
                    Análisis de Eficiencia vs Inversión
                  </CardTitle>
                  <AdaptiveTooltip
                    title="Análisis de Eficiencia"
                    content={
                      <div className="space-y-2">
                        <p>
                          <strong>Eficiencia:</strong> Dinero ganado / Inversión
                          total acumulada.
                        </p>
                        <p>
                          <strong>Cuadrantes:</strong>
                        </p>
                        <div className="space-y-1 text-sm">
                          <p>
                            🧠 <strong>Genio:</strong> Alta eficiencia, baja
                            inversión
                          </p>
                          <p>
                            🎰 <strong>Apostador:</strong> Alta eficiencia, alta
                            inversión
                          </p>
                          <p>
                            🛡️ <strong>Conservador:</strong> Baja eficiencia,
                            baja inversión
                          </p>
                          <p>
                            🔥 <strong>Temerario:</strong> Baja eficiencia, alta
                            inversión
                          </p>
                        </div>
                      </div>
                    }
                  >
                    <HelpCircle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
                  </AdaptiveTooltip>
                </div>
              </CardHeader>
              <CardContent>
                {calculateEfficiencyAnalysis().length > 0 ? (
                  <div className="h-80">
                    <Scatter
                      data={{
                        datasets: formatForQuadrantChart(),
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: "top" as const,
                            labels: {
                              usePointStyle: true,
                            },
                          },
                          tooltip: {
                            callbacks: {
                              label: (context: any) => {
                                const dataPoint = context.raw;
                                return `${
                                  dataPoint.jugador
                                }: ${context.parsed.y.toFixed(
                                  1
                                )}% eficiencia, ${context.parsed.x.toFixed(
                                  1
                                )} cajitas promedio`;
                              },
                            },
                          },
                        },
                        scales: {
                          x: {
                            display: true,
                            title: {
                              display: true,
                              text: "Cajitas Promedio por Partida",
                            },
                            min: 0,
                          },
                          y: {
                            display: true,
                            title: {
                              display: true,
                              text: "Eficiencia (%)",
                            },
                            ticks: {
                              callback: function (value: any) {
                                return value + "%";
                              },
                            },
                          },
                        },
                        elements: {
                          point: {
                            radius: 8,
                            hoverRadius: 10,
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Cannabis className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay datos de eficiencia disponibles</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reglas Tab */}
        {activeTab === "reglas" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Configuración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">☀️</span>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? "dark" : "light")
                    }
                    aria-label="Cambiar tema"
                  />
                  <span className="text-sm">🌙</span>
                  <span className="ml-2 text-sm">
                    Tema {theme === "dark" ? "oscuro" : "claro"}
                  </span>
                </div>

                {/* Botón temporal para actualizar sistema de puntos */}
                {/*
                <div className="pt-4 border-t">
                  <Button
                    onClick={async () => {
                      if (confirm("¿Estás seguro de que quieres actualizar el sistema de puntos? Esto recalculará todos los puntos de las partidas pasadas.")) {
                        setLoading(true);
                        try {
                          await DatabaseService.updatePointsSystem();
                          await loadAllData(); // Recargar datos
                          alert("¡Sistema de puntos actualizado correctamente!");
                        } catch (error) {
                          console.error(error);
                          alert("Error al actualizar el sistema de puntos");
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Actualizando...
                      </>
                    ) : (
                      "Actualizar Sistema de Puntos"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Recalcula todos los puntos con el nuevo sistema: 1º=10, 2º=7, 3º=5, 4º=3, 5º=2, 6º=1, 7º=0, 8º=0
                  </p>
                </div>
                */}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Reglas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li>
                    • Los puntos se asignan según la posición final en cada
                    partida
                  </li>
                  <li>
                    •{" "}
                    <strong>
                      Las posiciones se determinan por dinero ganado neto (de
                      mayor a menor)
                    </strong>
                  </li>
                  <li>
                    •{" "}
                    <strong>
                      En caso de empate en dinero ganado, gana quien pidió menos
                      cajitas
                    </strong>
                  </li>
                  <li>
                    • En caso de empate en puntos del ranking anual, gana quien
                    tenga más dinero ganado total
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
                          <td className="py-3 px-4 font-semibold">
                            {position}°
                          </td>
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
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed p-0 bottom-0 left-0 right-0 h-20 backdrop-blur-sm border-t z-50">
        <div className="flex justify-around items-center h-full p-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowRegisterForm(false);
                setEditingMatchId(null);
              }}
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

      {/* PWA Components */}
      <PWAInstall />
      <OfflineIndicator />
    </div>
  );
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
  );
}
