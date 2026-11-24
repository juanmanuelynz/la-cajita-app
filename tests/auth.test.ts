import { describe, expect, it } from "vitest"
import { makeToken, verifyToken } from "../lib/auth"

const SECRET = "a".repeat(64)

describe("auth tokens con rol", () => {
  it("el token de admin conserva el formato viejo (expiry.firma)", async () => {
    const token = await makeToken(SECRET)
    expect(token.split(".")).toHaveLength(2)
    expect(await verifyToken(token, SECRET)).toBe("admin")
  })

  it("el token de invitado devuelve guest", async () => {
    const token = await makeToken(SECRET, "guest")
    expect(token.split(".")).toHaveLength(3)
    expect(await verifyToken(token, SECRET)).toBe("guest")
  })

  it("no se puede pasar de invitado a admin editando el token", async () => {
    const [expiry, , sig] = (await makeToken(SECRET, "guest")).split(".")
    expect(await verifyToken(`${expiry}.${sig}`, SECRET)).toBeNull()
    expect(await verifyToken(`${expiry}.admin.${sig}`, SECRET)).toBeNull()
  })

  it("rechaza firma de otro secret y tokens vencidos o vacíos", async () => {
    expect(await verifyToken(await makeToken("b".repeat(64), "guest"), SECRET)).toBeNull()
    expect(await verifyToken(undefined, SECRET)).toBeNull()
    expect(await verifyToken("1.guest.abc", SECRET)).toBeNull()
  })
})
