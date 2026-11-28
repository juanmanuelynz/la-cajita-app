"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChipSpinner } from "@/components/poker-chip";
import { ChipCase } from "@/components/chip-case";
import { ChipLogo } from "@/components/chip-logo";
import {
  POKER_SPLASH_BG,
  PokerLogoRow,
  SPLASH_CHIP_CLASS,
  TRUCO_SPLASH_BG,
  TrucoLogoRow,
} from "@/components/splash-screen";
import { BravasFan } from "@/components/truco/bravas-fan";
import { MatchBox } from "@/components/truco/match-box";
import { getLastApp, setLastApp, type CajitaApp } from "@/lib/last-app";
import { cn } from "@/lib/utils";
import { login } from "./actions";
import { playSequence, playSound, preloadSounds } from "@/lib/sounds";

const PIN_LENGTH = 6;
// Al entrar: el PIN se va, la cajita se abre y, cuando ya soltó las fichas (o
// los fósforos), se funde en lo que muestra el splash de la app que sigue: la
// ficha (Poker) o el dorso de las bravas (Truco), quietos en el mismo lugar.
// Ahí recién se navega, y el splash arranca a girar la ficha o abrir el abanico.
const REVEAL_AT_MS = 1150;
const OPEN_DURATION_MS = 1800;

export function LoginScreen({ initialApp }: { initialApp: CajitaApp }) {
  // La cookie de la última app la lee el servidor; si no llegó, queda lo que
  // recuerda el celular.
  const [app, setApp] = useState<CajitaApp>(initialApp);
  useEffect(() => {
    if (initialApp === "poker" && getLastApp() === "truco") setApp("truco");
  }, [initialApp]);
  const truco = app === "truco";

  // Selector Poker | Truco: cambia la escena sin recargar y también la
  // dirección (al entrar se recarga la dirección actual) y la última app.
  // Desde una dirección de Poker (por ejemplo /partidas/5) se vuelve a ella.
  const pokerPath = useRef<string | null>(null);
  function chooseApp(next: CajitaApp) {
    if (next === app) return;
    const here = window.location.pathname;
    const inTruco = here === "/truco" || here.startsWith("/truco/");
    if (!inTruco && here !== "/login") pokerPath.current = here + window.location.search;
    const path = next === "truco" ? "/truco" : pokerPath.current ?? "/";
    if (path !== here + window.location.search) window.history.replaceState(null, "", path);
    document.title = next === "truco" ? "La Cajita Truco" : "La Cajita Poker";
    setLastApp(next);
    setApp(next);
    inputRef.current?.focus();
  }

  const [pin, setPin] = useState("");
  const [state, formAction, isPending] = useActionState(login, { error: null });
  const [shakeKey, setShakeKey] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const opened = !!state?.ok;

  // Los sonidos de la cajita se descargan apenas abre la página: en la PWA el
  // teclado aparece solo y el primer toque suele ser "Entrar", así que no
  // hay tiempo de cargarlos entre el toque y la respuesta del servidor.
  useEffect(() => {
    preloadSounds(
      truco
        ? ["fosforoA", "fosforoB", "fosforoSaca", "error"]
        : ["latch", "latchClick", "chipsBurst", "error"],
    );
  }, [truco]);

  useEffect(() => {
    if (state?.error) {
      setShakeKey((k) => k + 1);
      playSound("error");
    }
  }, [state]);

  useEffect(() => {
    if (!state?.ok) return;
    // El PIN de Truco entra solo a Truco: si la escena era la de Poker, pasa a la de Truco.
    const toTruco = truco || state.app === "truco";
    if (toTruco && !truco) setApp("truco");
    // Se cierra el teclado, así la escena queda centrada igual que el splash.
    inputRef.current?.blur();
    playSequence(
      toTruco
        ? // El cajón que sale y los fósforos que saltan (ver match-box / globals.css).
          [
            { name: "fosforoA", at: 0.1 },
            { name: "fosforoB", at: 0.24 },
            { name: "fosforoSaca", at: 0.5 },
            { name: "fosforoSaca", at: 0.62, volume: 0.35 },
            { name: "fosforoSaca", at: 0.78, volume: 0.3 },
          ]
        : // Trabas, tapa y las fichas que saltan (ver chip-case / globals.css).
          [
            { name: "latch", at: 0 },
            { name: "latch", at: 0.09 },
            { name: "latchClick", at: 0.22, volume: 0.7 },
            { name: "chipsBurst", at: 0.45 },
          ],
    );
    const t1 = setTimeout(() => setRevealed(true), REVEAL_AT_MS);
    // El login se muestra en la dirección que se abrió: se recarga esa misma
    // (la sesión de Truco, siempre a /truco; el middleware igual lo asegura).
    const here = window.location.pathname;
    const target =
      here === "/login" ? (toTruco ? "/truco" : "/") : state.app === "truco" && !here.startsWith("/truco") ? "/truco" : here + window.location.search;
    const t2 = setTimeout(() => window.location.replace(target), OPEN_DURATION_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // Solo cuando llega la respuesta del login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const boxClass = cn(
    "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[opacity,scale] duration-500",
    revealed && "pointer-events-none scale-75 opacity-0",
  );
  const revealClass = cn(
    "transition-[opacity,translate,scale] duration-500 ease-out",
    revealed ? "opacity-100" : "translate-y-6 scale-50 opacity-0",
  );

  return (
    <div className={cn("min-h-dvh overflow-x-hidden", truco ? TRUCO_SPLASH_BG : POKER_SPLASH_BG)}>
      {/* Mismo armado que el splash (components/splash-screen.tsx): lo de
          arriba, 32px y el logo, centrados. El PIN va debajo y al entrar se
          pliega, así la escena termina donde la muestra el splash. */}
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-4">
        {truco ? (
          <div className="relative">
            <div className={revealClass}>
              <BravasFan backOnly className="mb-6 scale-125" />
            </div>
            <div className={boxClass}>
              <MatchBox open={opened} />
            </div>
          </div>
        ) : (
          <div className="relative size-56">
            <div className={cn("size-full", revealClass)}>
              <ChipLogo className={SPLASH_CHIP_CLASS} />
            </div>
            <div className={boxClass}>
              <ChipCase open={opened} />
            </div>
          </div>
        )}

        {truco ? <TrucoLogoRow className="mt-8" /> : <PokerLogoRow className="mt-8" />}

        <div
          className={cn(
            "grid w-full max-w-sm transition-all duration-500",
            opened ? "mt-0 grid-rows-[0fr] opacity-0" : "mt-8 grid-rows-[1fr]",
          )}
        >
          <div className={cn("min-h-0", opened && "overflow-hidden")}>
            <div
              role="radiogroup"
              aria-label="App"
              className="mx-auto mb-4 grid w-56 grid-cols-2 rounded-full border border-white/15 bg-black/25 p-1 backdrop-blur-sm"
            >
              {(["poker", "truco"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={app === a}
                  disabled={opened}
                  onClick={() => chooseApp(a)}
                  className={cn(
                    "rounded-full py-1.5 text-sm font-semibold transition-colors",
                    app === a ? "bg-[#e2ab3c] text-[#1b1718] shadow" : "text-white/70 hover:text-white",
                  )}
                >
                  {a === "poker" ? "Poker" : "Truco"}
                </button>
              ))}
            </div>
            <div
              key={shakeKey}
              className={cn(
                "rounded-2xl border border-white/10 bg-black/25 p-5 shadow-xl backdrop-blur-sm",
                shakeKey > 0 && "shake",
              )}
            >
              <form action={formAction} className="space-y-4">
                <label htmlFor="pin" className="block text-center text-sm opacity-80">
                  Ingresá el PIN para entrar
                </label>
                <Input
                  ref={inputRef}
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  autoComplete="off"
                  maxLength={PIN_LENGTH}
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
                  }
                  placeholder="••••••"
                  aria-label="PIN"
                  className="h-14 border-white/20 bg-black/20 text-center text-2xl tracking-[0.5em] placeholder:text-white/35 focus-visible:ring-[#e2ab3c]/60 focus-visible:ring-offset-0"
                />
                {state?.error && (
                  <p className="text-center text-sm font-medium text-[#f4a39b]">{state.error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-[#e2ab3c] font-semibold text-[#1b1718] hover:bg-[#ecbb55] disabled:opacity-60"
                  disabled={isPending || opened || pin.length !== PIN_LENGTH}
                >
                  {isPending || opened ? (
                    // Truco no usa nada de fichas.
                    truco ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChipSpinner className="h-4 w-4" />
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
