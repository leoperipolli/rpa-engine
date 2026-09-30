import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? '');

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value;

  if (!token) {
    return negar(req);
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return negar(req);
  }
}

// Chamadas ao proxy da API recebem 401 em vez de redirecionar para o login
function negar(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/backend/')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  return redirectToLogin(req);
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!login|auth|_next/static|_next/image|favicon.ico).*)'],
};
