'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Recipe, Execution } from '@/lib/types';
import { isHtml, parseHtmlItem } from '@/lib/html-result';

// ── Result helpers ─────────────────────────────────────────────────────────────

function resultToRows(result: Record<string, unknown>): Record<string, unknown>[] {
  const entries = Object.entries(result);
  if (entries.length === 0) return [];

  // Array of plain objects → use directly as rows
  for (const [, val] of entries) {
    if (
      Array.isArray(val) &&
      val.length > 0 &&
      val.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
    ) {
      return val as Record<string, unknown>[];
    }
  }

  // Array of HTML strings (e.g. innerHTML of each <li>) → parse each as a row
  for (const [, val] of entries) {
    if (Array.isArray(val) && val.length > 0 && val.every((v) => typeof v === 'string' && isHtml(v))) {
      const rows = val.map(parseHtmlItem).filter((r): r is Record<string, string> => r !== null);
      if (rows.length > 0) return rows;
    }
  }

  const maxLen = Math.max(...entries.map(([, v]) => (Array.isArray(v) ? v.length : 1)));

  if (maxLen === 1) {
    const row: Record<string, unknown> = {};
    for (const [k, v] of entries) row[k] = Array.isArray(v) ? (v[0] ?? '') : v;
    return [row];
  }

  return Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, unknown> = {};
    for (const [k, v] of entries) row[k] = Array.isArray(v) ? (v[i] ?? '') : v;
    return row;
  });
}

async function downloadXlsx(rows: Record<string, unknown>[], filename: string) {
  const XLSX = (await import('xlsx')).default;
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] ?? {});
  ws['!cols'] = headers.map((h) => ({
    wch: Math.max(h.length, ...rows.map((r) => String(r[h] ?? '').length), 10),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultado');
  XLSX.writeFile(wb, filename);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  running: 'Executando',
  success: 'Concluída',
  failed: 'Falhou',
};

// ── Run Modal ─────────────────────────────────────────────────────────────────

function RunModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    recipe.inputs.forEach((inp) => { init[inp.name] = ''; });
    return init;
  });
  const [execution, setExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [xlsxLoading, setXlsxLoading] = useState(false);

  // Poll execution status every 2s until terminal state
  useEffect(() => {
    if (!execution) return;
    if (execution.status === 'success' || execution.status === 'failed') return;

    const timer = setTimeout(async () => {
      try {
        const updated = await api.get<Execution>(`/api/executions/${execution.id}`);
        setExecution(updated);
      } catch {
        // Re-trigger the effect so polling continues on transient errors
        setExecution((prev) => (prev ? { ...prev } : prev));
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [execution]);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const exec = await api.post<Execution>('/api/executions', {
        recipe_id: recipe.id,
        inputs,
      });
      setExecution(exec);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Executar: {recipe.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {!execution ? (
            <>
              {recipe.inputs.length === 0 ? (
                <p className="text-sm text-gray-500 mb-5">
                  Esta receita não requer inputs.
                </p>
              ) : (
                <div className="space-y-4 mb-5">
                  {recipe.inputs.map((inp) => (
                    <div key={inp.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {inp.name}
                        {inp.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={inputs[inp.name] ?? ''}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [inp.name]: e.target.value }))
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={submit}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Executar'}
                </button>
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[execution.status]}`}
                >
                  {STATUS_LABEL[execution.status]}
                </span>
                {(execution.status === 'pending' || execution.status === 'running') && (
                  <span className="text-sm text-gray-500">Aguardando resultado...</span>
                )}
                {execution.duration_ms != null && (
                  <span className="text-sm text-gray-400 ml-auto">
                    {(execution.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>

              {execution.status === 'success' && execution.result && (() => {
                const rows = resultToRows(execution.result);
                const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
                return rows.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Resultado
                      </p>
                      <button
                        disabled={xlsxLoading}
                        onClick={async () => {
                          setXlsxLoading(true);
                          await downloadXlsx(rows, `${recipe.name}.xlsx`);
                          setXlsxLoading(false);
                        }}
                        className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
                      >
                        {xlsxLoading ? 'Exportando...' : 'Exportar XLSX'}
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-gray-200 rounded">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            {headers.map((h) => (
                              <th
                                key={h}
                                className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              {headers.map((h) => (
                                <td
                                  key={h}
                                  className="px-4 py-2 text-gray-700 border-b border-gray-100 align-top"
                                >
                                  {String(row[h] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {rows.length} {rows.length === 1 ? 'linha' : 'linhas'}
                    </p>
                  </div>
                ) : (
                  <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-auto max-h-48">
                    {JSON.stringify(execution.result, null, 2)}
                  </pre>
                );
              })()}

              {execution.status === 'failed' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {execution.error ?? 'Erro desconhecido.'}
                </div>
              )}

              <p className="text-xs text-gray-400 mt-3">ID: {execution.id}</p>

              <div className="flex justify-end mt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runRecipe, setRunRecipe] = useState<Recipe | null>(null);

  async function loadRecipes() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Recipe[]>('/api/recipes');
      setRecipes(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRecipes(); }, []);

  async function handleDelete(id: string) {
    try {
      await api.del(`/api/recipes/${id}`);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(`Erro ao excluir: ${String(err)}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receitas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie suas automações</p>
        </div>
        <Link
          href="/recipes/new"
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          + Nova Receita
        </Link>
      </div>

      {/* States */}
      {loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-16 text-center text-sm text-gray-400">
          Carregando...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-sm text-red-700">
          {error}
          <button onClick={loadRecipes} className="ml-3 underline">
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && recipes.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-16 text-center">
          <p className="text-gray-400 text-sm">Nenhuma receita cadastrada.</p>
          <Link
            href="/recipes/new"
            className="inline-block mt-4 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
          >
            Criar primeira receita
          </Link>
        </div>
      )}

      {!loading && !error && recipes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Nome
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Inputs
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Criada em
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Atualizada
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recipes.map((recipe) => (
                <tr key={recipe.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{recipe.name}</div>
                    {recipe.description && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                        {recipe.description}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {recipe.inputs.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {recipe.inputs.map((i) => i.name).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{fmtDate(recipe.created_at)}</td>
                  <td className="px-5 py-3 text-gray-500">{fmtDate(recipe.updated_at)}</td>
                  <td className="px-5 py-3">
                    {deletingId === recipe.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-600">Confirmar exclusão?</span>
                        <button
                          onClick={() => handleDelete(recipe.id)}
                          className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setRunRecipe(recipe)}
                          className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                        >
                          Executar
                        </button>
                        <Link
                          href={`/recipes/${recipe.id}/edit`}
                          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => setDeletingId(recipe.id)}
                          className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Run modal */}
      {runRecipe && (
        <RunModal recipe={runRecipe} onClose={() => setRunRecipe(null)} />
      )}
    </div>
  );
}
