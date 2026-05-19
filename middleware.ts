import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        // Middleware ejecuta solo si hay sesión válida
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/admin/login",
        },
    }
);

// Proteger todas las rutas que empiecen con /admin excepto /admin/login
export const config = {
    matcher: [
        "/admin/dashboard/:path*",
        "/admin/servicios/:path*",
        "/admin/aliados/:path*",
        "/admin/conductores/:path*",
        "/admin/vehiculos/:path*",
        "/admin/reservas/:path*",
        "/admin/calificaciones/:path*",
        "/admin/estadisticas/:path*",
        "/admin/base-datos/:path*",
        "/admin/calendario/:path*",
    ],
};
