/**
 * Next.js Middleware - Route Protection (OSS mode)
 *
 * In OSS mode, all routes are accessible. Authentication is handled
 * by the control-plane API via API key.
 */

import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
