'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Recipe, DownloadStep, ExtractStep, ScreenshotStep } from '@/lib/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/api/executions`;

function IconCopy() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      Object.assign(ta.style, { position: 'fixed', opacity: '0' });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={secret ? 'password' : 'text'}
          readOnly
          value={value}
          className="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-md text-gray-800 outline-none"
        />
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
            copied
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

export default function ApiPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);

  useEffect(() => {
    api.get<Recipe[]>('/api/recipes')
      .then(setRecipes)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">API</h1>
        <p className="text-sm text-gray-500 mt-1">
          Selecione uma receita para gerar a URL de execução via API (ex: n8n HTTP Request).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: recipe list */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Receitas disponíveis</h2>

          {loading && (
            <p className="text-sm text-gray-400">Carregando receitas...</p>
          )}

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && recipes.length === 0 && (
            <p className="text-sm text-gray-400">Nenhuma receita cadastrada.</p>
          )}

          {!loading && !error && (
            <ul className="space-y-2">
              {recipes.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    onClick={() => setSelected(recipe)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                      selected?.id === recipe.id
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{recipe.name}</div>
                    {recipe.description && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{recipe.description}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {recipe.inputs?.length ?? 0} input{(recipe.inputs?.length ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: generated config */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Configuração gerada</h2>

          {!selected ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
              Selecione uma receita ao lado
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {selected.name}
                </div>

                <div className="space-y-3">
                  <CopyField
                    label="Método + URL"
                    value={`POST ${ENDPOINT}`}
                  />
                  <CopyField
                    label="Recipe ID (body → recipe_id)"
                    value={selected.id}
                  />
                  <CopyField
                    label="API Key (header → X-API-Key)"
                    value="<sua-api-key> (definida em API_KEY no servidor)"
                  />
                </div>
              </div>

              {selected.inputs && selected.inputs.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    Inputs da receita (body → inputs)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.inputs.map((inp) => (
                      <span
                        key={inp.name}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          inp.required
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {inp.name}
                        {!inp.required && <span className="ml-1 opacity-60">(opcional)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Exemplo de headers (JSON)</div>
                  <pre className="text-xs font-mono bg-gray-50 rounded-md p-3 text-gray-700 overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(
  {
    'Content-Type': 'application/json',
    'X-API-Key': '<sua-api-key>',
  },
  null,
  2
)}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Exemplo de body (JSON)</div>
                  <pre className="text-xs font-mono bg-gray-50 rounded-md p-3 text-gray-700 overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(
  {
    recipe_id: selected.id,
    inputs: Object.fromEntries(
      (selected.inputs ?? []).map((inp) => [inp.name, ''])
    ),
  },
  null,
  2
)}
                  </pre>
                </div>
              </div>

              {/* Download file info */}
              {(() => {
                const downloadKeys = selected.steps
                  .filter((s): s is DownloadStep | ExtractStep | ScreenshotStep =>
                    s.type === 'download' || s.type === 'extract' || s.type === 'screenshot'
                  )
                  .map((s) => ('name' in s ? s.name : undefined))
                  .filter((n): n is string => !!n);
                if (downloadKeys.length === 0) return null;
                return (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      Download de arquivos (binário)
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      Adicione <code className="text-xs bg-gray-100 px-1 rounded">?format=file&key=nome</code> ao POST para receber o arquivo binário direto (1 request):
                    </p>
                    <div className="space-y-2">
                      {downloadKeys.map((key) => (
                        <CopyField
                          key={key}
                          label={key}
                          value={`POST ${ENDPOINT}?format=file&key=${key}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
