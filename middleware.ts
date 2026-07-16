import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    if (process.env.VERCEL_ENV === "production") {
      return new NextResponse("Dashboard non configurata", { status: 503 });
    }
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const [user, password] = atob(authorization.slice(6)).split(":");
      if (user === expectedUser && password === expectedPassword) {
        return NextResponse.next();
      }
    } catch {
      // Credenziali non valide: mostra nuovamente il prompt di accesso.
    }
  }

  return new NextResponse("Autenticazione richiesta", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Car One CRM"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
