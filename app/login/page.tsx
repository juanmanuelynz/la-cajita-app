"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChipSpinner, CHIP_COLORS, PokerChip } from "@/components/poker-chip";
import { login } from "./actions";

const PIN_LENGTH = 6;
const BOX_SIZE = 88;
// Tiempo que se muestra la cajita abierta antes de entrar a la app.
const OPEN_DURATION_MS = 1300;

// Fichas que salen disparadas de la cajita al abrirse: un abanico hacia arriba.
const BURST = Array.from({ length: 9 }, (_, i) => {
  const angle = (-160 + i * 17.5) * (Math.PI / 180);
  const dist = 95 + (i % 3) * 22;
  return {
    bx: `${Math.cos(angle) * dist}px`,
    by: `${Math.sin(angle) * dist}px`,
    br: `${(i % 2 ? 1 : -1) * (180 + i * 40)}deg`,
    delay: 120 + (i % 4) * 45,
    color: CHIP_COLORS[i % CHIP_COLORS.length],
    suit: ["♠", "♥", "♦", "♣"][i % 4],
  };
});

function Cajita({ open }: { open: boolean }) {
  return (
    <div
      className="cajita-scene relative mx-auto flex h-44 w-44 items-center justify-center"
      aria-hidden
    >
      <div
        className="cajita-glow"
        style={{ opacity: open ? 1 : 0.45, transform: open ? "scale(1.25)" : "scale(1)" }}
      />
      <div className="cajita-float">
        <div
          className="cajita-box"
          data-state={open ? "open" : "closed"}
          style={{ "--size": `${BOX_SIZE}px` } as React.CSSProperties}
        >
          {/* U+FE0E fuerza la versión texto (no emoji) para poder colorearla */}
          <div className="cajita-face front text-rose-500">{"\u2665\uFE0E"}</div>
          <div className="cajita-face back text-emerald-50">{"\u2660\uFE0E"}</div>
          <div className="cajita-face right text-emerald-50">{"\u2663\uFE0E"}</div>
          <div className="cajita-face left text-rose-500">{"\u2666\uFE0E"}</div>
          <div className="cajita-face bottom" />
          <div className="cajita-lid">
            <div className="cajita-lid-inner">
              <div className="cajita-face">🃏</div>
            </div>
          </div>
        </div>
      </div>
      {open &&
        BURST.map((b, i) => (
          <span
            key={i}
            className="cajita-burst"
            style={
              {
                "--bx": b.bx,
                "--by": b.by,
                "--br": b.br,
                animationDelay: `${b.delay}ms`,
              } as React.CSSProperties
            }
          >
            <PokerChip
              className="h-full w-full drop-shadow-lg"
              body={b.color.body}
              edge={b.color.edge}
              suit={b.suit}
            />
          </span>
        ))}
    </div>
  );
}

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [state, formAction, isPending] = useActionState(login, { error: null });
  const [shakeKey, setShakeKey] = useState(0);
  const opened = !!state?.ok;

  useEffect(() => {
    if (state?.error) setShakeKey((k) => k + 1);
  }, [state]);

  useEffect(() => {
    if (!state?.ok) return;
    const t = setTimeout(() => window.location.replace("/"), OPEN_DURATION_MS);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      <Cajita open={opened} />
      <Card
        key={shakeKey}
        className={`w-full max-w-sm transition-all duration-500 ${
          shakeKey > 0 ? "shake" : ""
        } ${opened ? "translate-y-6 opacity-0" : ""}`}
      >
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            ♥️♠️ La Cajita ♣️♦️
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Ingresá el PIN para ingresar
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <Input
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
              className="text-center text-2xl tracking-[0.5em] h-14"
            />
            {state?.error && (
              <p className="text-sm text-rose-500 text-center">{state.error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || opened || pin.length !== PIN_LENGTH}
            >
              {isPending || opened ? (
                <ChipSpinner className="w-4 h-4" />
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
