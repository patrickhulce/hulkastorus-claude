import {withAuth} from "next-auth/middleware";
import {NextResponse} from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({req, token}) => {
        const pathname = req.nextUrl.pathname;

        // Public routes that don't require authentication
        const publicRoutes = [
          "/",
          "/login",
          "/register",
          "/reset-password",
          "/privacy",
          "/terms",
          "/docs",
        ];

        // API routes that don't require authentication
        const publicApiRoutes = ["/api/auth", "/api/v1/users"];

        // Check if the current path is public
        if (publicRoutes.includes(pathname)) {
          return true;
        }

        // Check if it's a public API route
        if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
          return true;
        }

        // All other routes require authentication
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
