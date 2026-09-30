import { NextRequest } from 'next/server';

// Proxy autenticado do dashboard para o backend.
// A API key fica só no servidor (API_KEY) e nunca vai para o bundle do navegador.
// O middleware exige sessão válida antes de chegar aqui.

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.API_KEY ?? '';

// Headers da resposta do backend que repassamos ao navegador
const HEADERS_REPASSADOS = ['content-type', 'content-disposition'];

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const url = `${API_URL}/${params.path.join('/')}${req.nextUrl.search}`;
  const temCorpo = req.method !== 'GET' && req.method !== 'HEAD';

  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers: {
        'X-API-Key': API_KEY,
        ...(temCorpo ? { 'Content-Type': req.headers.get('content-type') ?? 'application/json' } : {}),
      },
      body: temCorpo ? await req.text() : undefined,
      cache: 'no-store',
    });
  } catch {
    return Response.json({ error: 'Backend indisponível' }, { status: 502 });
  }

  const headers = new Headers();
  for (const nome of HEADERS_REPASSADOS) {
    const valor = res.headers.get(nome);
    if (valor) headers.set(nome, valor);
  }
  return new Response(res.body, { status: res.status, headers });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
