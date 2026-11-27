import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE_NAME, verifyToken } from "./lib/auth"
import { LAST_APP_COOKIE } from "./lib/last-app"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /login es la única ruta pública dentro del matcher.
  if (pathname.startsWith("/login")) {
    return NextResponse.next()
  }

  const secret = process.env.APP_SECRET
  // Fail-open si no hay secret configurado: evita lockear el entorno por error
  // de configuración. La protección real depende de que APP_SECRET esté seteado.
  if (!secret) return openLastApp(request) ?? NextResponse.next()

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const role = await verifyToken(token, secret)
  if (!role) {
    const url = new URL("/login", request.url)
    // Que el login (y su SEO, que es lo que ve quien comparte el link) sea el de Truco.
    if (pathname === "/truco" || pathname.startsWith("/truco/")) url.searchParams.set("app", "truco")
    return NextResponse.redirect(url)
  }
  return openLastApp(request) ?? NextResponse.next()
}

/**
 * Abrir la app ("/") cuando la última vez estabas en Truco: directo a /truco,
 * así se ve su splash y no el de Poker. Solo al abrir la página (no en las
 * navegaciones ni precargas internas de Next, que no son "document").
 */
function openLastApp(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return null
  if (request.headers.get("sec-fetch-dest") !== "document") return null
  if (request.cookies.get(LAST_APP_COOKIE)?.value !== "truco") return null
  return NextResponse.redirect(new URL("/truco", request.url))
}

export const config = {
  // Excluye assets estáticos, PWA y sonidos (el login también los usa). Cualquier ruta de app pasa por el middleware.
  matcher: [
    "/((?!_next/static|_next/image|favicon|icon-|manifest.json|browserconfig.xml|sw.js|workbox-|sounds/).*)",
  ],
}
