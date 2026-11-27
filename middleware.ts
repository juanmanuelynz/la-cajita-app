import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE_NAME, rolePins, verifyToken } from "./lib/auth"
import { LAST_APP_COOKIE } from "./lib/last-app"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /login ya no es una dirección propia: el PIN se pide en la misma dirección
  // que se abrió (ver abajo). En el iPhone, agregar a inicio desde /login dejaba
  // la app con la barra del navegador; así siempre se agrega desde / o /truco.
  // Los links viejos a /login (y el cerrar sesión) van a la app que corresponde.
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (request.method !== "GET") return NextResponse.next()
    const truco =
      request.nextUrl.searchParams.get("app") === "truco" || request.cookies.get(LAST_APP_COOKIE)?.value === "truco"
    return NextResponse.redirect(new URL(truco ? "/truco" : "/", request.url))
  }

  const secret = process.env.APP_SECRET
  // Fail-open si no hay secret configurado: evita lockear el entorno por error
  // de configuración. La protección real depende de que APP_SECRET esté seteado.
  if (!secret) return openLastApp(request) ?? NextResponse.next()

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const role = await verifyToken(token, secret, rolePins())
  if (!role) {
    // Sin sesión: se muestra el login sin cambiar la dirección (rewrite, no
    // redirect). Desde /truco, el login (y su SEO, que es lo que ve quien
    // comparte el link) es el de Truco.
    const url = new URL("/login", request.url)
    if (isTruco(pathname)) url.searchParams.set("app", "truco")
    return NextResponse.rewrite(url)
  }
  // La sesión de Truco (TRUCO_PIN) solo entra a /truco.
  if (role === "truco" && !isTruco(pathname)) {
    return NextResponse.redirect(new URL("/truco", request.url))
  }
  return openLastApp(request) ?? NextResponse.next()
}

function isTruco(pathname: string) {
  return pathname === "/truco" || pathname.startsWith("/truco/")
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
