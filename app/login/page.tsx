"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChipSpinner } from "@/components/poker-chip";
import { ChipCase } from "@/components/chip-case";
import { login } from "./actions";
import { playSequence, playSound, preloadSounds } from "@/lib/sounds";

const PIN_LENGTH = 6;
// Tiempo que se muestra el maletín abriéndose antes de entrar a la app.
const OPEN_DURATION_MS = 1600;

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [state, formAction, isPending] = useActionState(login, { error: null });
  const [shakeKey, setShakeKey] = useState(0);
  const opened = !!state?.ok;

  // Los sonidos del maletín se descargan apenas abre la página: en la PWA el
  // teclado aparece solo y el primer toque suele ser "Entrar", así que no
  // hay tiempo de cargarlos entre el toque y la respuesta del servidor.
  useEffect(() => {
    preloadSounds(["latch", "latchClick", "chipsBurst", "error"]);
  }, []);

  useEffect(() => {
    if (state?.error) {
      setShakeKey((k) => k + 1);
      playSound("error");
    }
  }, [state]);

  useEffect(() => {
    if (!state?.ok) return;
    // Trabas, tapa y las fichas que saltan (ver tiempos en chip-case / globals.css).
    playSequence([
      { name: "latch", at: 0 },
      { name: "latch", at: 0.09 },
      { name: "latchClick", at: 0.22, volume: 0.7 },
      { name: "chipsBurst", at: 0.45 },
    ]);
    const t = setTimeout(() => window.location.replace("/"), OPEN_DURATION_MS);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      <ChipCase open={opened} />
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
