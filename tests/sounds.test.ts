import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { SOUNDS, playSound, soundUrl } from "../lib/sounds"

const PUBLIC = join(__dirname, "..", "public")
const declared = Object.values(SOUNDS).flatMap((s) => [...s.files])

describe("sounds", () => {
  it("cada sonido declarado tiene su archivo en /public/sounds", () => {
    for (const file of declared) {
      expect(existsSync(join(PUBLIC, soundUrl(file))), file).toBe(true)
    }
  })

  it("no quedan archivos de sonido sin usar", () => {
    const onDisk = readdirSync(join(PUBLIC, "sounds")).filter((f) => f.endsWith(".mp3"))
    expect(onDisk.sort()).toEqual([...new Set(declared)].map((f) => `${f}.mp3`).sort())
  })

  it("todos los archivos figuran en CREDITS.txt", () => {
    const credits = readFileSync(join(PUBLIC, "sounds", "CREDITS.txt"), "utf8")
    for (const file of declared) {
      const base = file.replace(/-\d+$/, "")
      expect(credits, file).toContain(base)
    }
  })

  it("volúmenes entre 0 y 1", () => {
    for (const s of Object.values(SOUNDS)) {
      expect(s.volume).toBeGreaterThan(0)
      expect(s.volume).toBeLessThanOrEqual(1)
    }
  })

  it("playSound no rompe fuera del navegador", () => {
    expect(() => playSound("chipLay")()).not.toThrow()
  })
})
