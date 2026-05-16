"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { login } from "./actions";

const PIN_LENGTH = 6;

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [state, formAction, isPending] = useActionState(login, { error: null });

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
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
              disabled={isPending || pin.length !== PIN_LENGTH}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
