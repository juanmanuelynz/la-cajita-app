import { describe, expect, it } from "vitest"
import { makeToken, verifyToken } from "../lib/auth"

const SECRET = "a".repeat(64)
const PINS = { guest: "111111", truco: "222222" }

describe("auth tokens con rol", () => {
  it("el token de admin conserva el formato viejo (expiry.firma)", async () => {
    const token = await makeToken(SECRET)
    expect(token.split(".")).toHaveLength(2)
    expect(await verifyToken(token, SECRET)).toBe("admin")
  })

  it("el token de invitado devuelve guest", async () => {
    const token = await makeToken(SECRET, "guest", PINS)
    expect(token.split(".")).toHaveLength(3)
    expect(await verifyToken(token, SECRET, PINS)).toBe("guest")
  })

  it("no se puede pasar de invitado a admin editando el token", async () => {
    const [expiry, , sig] = (await makeToken(SECRET, "guest", PINS)).split(".")
    expect(await verifyToken(`${expiry}.${sig}`, SECRET, PINS)).toBeNull()
    expect(await verifyToken(`${expiry}.admin.${sig}`, SECRET, PINS)).toBeNull()
  })

  it("rechaza firma de otro secret y tokens vencidos o vacíos", async () => {
    expect(await verifyToken(await makeToken("b".repeat(64), "guest", PINS), SECRET, PINS)).toBeNull()
    expect(await verifyToken(undefined, SECRET)).toBeNull()
    expect(await verifyToken("1.guest.abc", SECRET)).toBeNull()
  })

  it("el token de Truco devuelve truco y no sirve como invitado ni admin", async () => {
    const token = await makeToken(SECRET, "truco", PINS)
    expect(await verifyToken(token, SECRET, PINS)).toBe("truco")
    const [expiry, , sig] = token.split(".")
    expect(await verifyToken(`${expiry}.guest.${sig}`, SECRET, PINS)).toBeNull()
    expect(await verifyToken(`${expiry}.${sig}`, SECRET, PINS)).toBeNull()
  })

  it("cambiar el PIN de invitado o de Truco cierra solo esas sesiones", async () => {
    const admin = await makeToken(SECRET)
    const guest = await makeToken(SECRET, "guest", PINS)
    const truco = await makeToken(SECRET, "truco", PINS)
    const newGuestPin = { ...PINS, guest: "333333" }
    expect(await verifyToken(guest, SECRET, newGuestPin)).toBeNull()
    expect(await verifyToken(truco, SECRET, newGuestPin)).toBe("truco")
    expect(await verifyToken(admin, SECRET, newGuestPin)).toBe("admin")
    // Sin el PIN configurado, el rol no existe.
    expect(await verifyToken(truco, SECRET, { guest: PINS.guest })).toBeNull()
  })
})
