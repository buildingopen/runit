/**
 * Next.js Middleware - Route Protection
 *
 * Redirects unauthenticated users to login for protected routes.
 * Public routes: /, /login, /signup, /auth/*, /s/*, /r/*
 * Protected routes: /new, /create/*, /p/*
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const AUTH_ROUTES = ['/login', '/signup'];

const PROTECTED_PREFIXES = [
  '/new',
  '/create/',
  '/p/',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only run auth checks on protected routes and auth routes
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (!isProtected && !isAuthRoute) {
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect authenticated users away from login/signup
  if (user && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect unauthenticated users to login (skip for auth routes)
  if (!user && !AUTH_ROUTES.includes(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
