"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { logout } from "@/app/login/actions";
import { useSoundEnabled } from "@/hooks/use-sound-enabled";
import { playSound } from "@/lib/sounds";

/**
 * Tema, sonidos y cerrar sesión. Va en Configuración → Ajustes (y es todo lo
 * que ve el invitado ahí) en Poker y en Truco. Pasar de una app a la otra está
 * en las presentaciones de arriba (TrucoPromo en Poker, PokerPromo en Truco).
 */
export function AjustesCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";
  const [soundOn, setSoundOn] = useSoundEnabled();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Configuración</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2" suppressHydrationWarning>
          <span className="text-sm">☀️</span>
          <Switch
            checked={isDark}
            onCheckedChange={(checked) =>
              setTheme(checked ? "dark" : "light")
            }
            aria-label="Cambiar tema"
          />
          <span className="text-sm">🌙</span>
          <span className="ml-2 text-sm" suppressHydrationWarning>
            Tema {mounted ? (isDark ? "oscuro" : "claro") : ""}
          </span>
        </div>

        <div className="flex items-center gap-2" suppressHydrationWarning>
          <span className="text-sm">🔇</span>
          <Switch
            checked={mounted ? soundOn : true}
            onCheckedChange={(checked) => {
              setSoundOn(checked);
              // Muestra cómo suena al prenderlo.
              if (checked) playSound("chipLay");
            }}
            aria-label="Activar sonidos"
          />
          <span className="text-sm">🔊</span>
          <span className="ml-2 text-sm" suppressHydrationWarning>
            Sonidos {mounted ? (soundOn ? "activados" : "desactivados") : ""}
          </span>
        </div>


        <form action={logout}>
          <Button type="submit" variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </form>
        <details className="text-[11px] text-muted-foreground/70">
          <summary className="cursor-pointer select-none">Créditos de sonido</summary>
          <p className="mt-1">
            Fichas:{" "}
            <a href="https://freesound.org/s/170295/" target="_blank" rel="noreferrer" className="underline">
              “Clay Chips” de ArtOrDie
            </a>
            ,{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">
              CC BY 4.0
            </a>{" "}
            (recortado). Mazo: vkproduktion, CC0. Fósforos: JarredGibb y MeanRaccoon, CC0. Resto: Kenney, CC0.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
