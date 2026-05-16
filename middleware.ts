import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE_NAME, verifyToken } from "./lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /login es la única ruta pública dentro del matcher.
  if (pathname.startsWith("/login")) {
    return NextResponse.next()
  }

  const secret = process.env.APP_SECRET
  // Fail-open si no hay secret configurado: evita lockear el entorno por error
  // de configuración. La protección real depende de que APP_SECRET esté seteado.
  if (!secret) return NextResponse.next()

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const valid = await verifyToken(token, secret)
  if (!valid) {
    const url = new URL("/login", request.url)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  // Excluye assets estáticos y PWA. Cualquier ruta de app pasa por el middleware.
  matcher: [
    "/((?!_next/static|_next/image|favicon|icon-|manifest.json|browserconfig.xml|sw.js|workbox-).*)",
  ],
}
