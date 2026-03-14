/**
 * Next.js Middleware - Route Protection + Dynamic CSP (OSS mode)
 *
 * In OSS mode, all routes are accessible. Authentication is handled
 * by the control-plane API via API key.
 *
 * Sets Content-Security-Policy dynamically so connect-src allows
 * the API on port 3001 of whatever host the user accesses.
 */

import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Build dynamic API origin from request host
  const host = request.headers.get('host') || 'localhost:3000';
  const hostname = host.split(':')[0];
  const protocol = request.nextUrl.protocol || 'http:';
  const apiOrigin = `${protocol}//${hostname}:3001`;

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} http://localhost:3001 http://127.0.0.1:3001`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
