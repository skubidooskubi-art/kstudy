import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the path starts with /hermes-chat
  if (request.nextUrl.pathname.startsWith('/hermes-chat')) {
    // Clone the request headers
    const requestHeaders = new Headers(request.headers);
    // Add the X-Forwarded-Prefix header
    requestHeaders.set('x-forwarded-prefix', '/hermes-chat');

    // Return the response with the modified request headers
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/hermes-chat', '/hermes-chat/:path*'],
};
