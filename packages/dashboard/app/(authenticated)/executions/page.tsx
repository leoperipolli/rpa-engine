'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Recipe, Execution } from '@/lib/types';
import { isHtml, parseHtmlItem } from '@/lib/html-result';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed:  'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  running: 'Executando',
  success: 'Concluída',
  failed:  'Falhou',
};

// ── Result helpers ────────────────────────────────────────────────────────────

/**
 * Converts a StepResult map into an array of table rows.
 *   - All scalar values      → single row  { key: value, ... }
 *   - Some array values      → zip into multiple rows
 *   - Array-of-objects value → use that array directly as rows
 */
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

function fmtDuration(ms?: number) {
  if (ms == null) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ── Excel export ──────────────────────────────────────────────────────────────

async function downloadXlsx(rows: Record<string, unknown>[], filename: string) {
  // Dynamic import — only loads the xlsx bundle when the button is clicked
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

// ── ResultPanel ───────────────────────────────────────────────────────────────

function ResultPanel({ execution, recipeName }: { execution: Execution; recipeName: string }) {
  const isTerminal = execution.status === 'success' || execution.status === 'failed';
  const rows =
    execution.result && Object.keys(execution.result).length > 0
      ? resultToRows(execution.result)
      : [];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Resultado</span>
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[execution.status]}`}
          >
            {STATUS_LABEL[execution.status]}
          </span>
          {execution.duration_ms != null && (
            <span className="text-xs text-gray-400">{fmtDuration(execution.duration_ms)}</span>
          )}
        </div>

        {execution.status === 'success' && rows.length > 0 && (
          <button
            onClick={() =>
              downloadXlsx(
                rows,
                `${recipeName.replace(/\s+/g, '_').toLowerCase()}_resultado.xlsx`,
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar Excel
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Pending / Running */}
        {!isTerminal && (
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Aguardando resultado da execução...
          </div>
        )}

        {/* Failed */}
        {execution.status === 'failed' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-mono whitespace-pre-wrap">
            {execution.error ?? 'Erro desconhecido.'}
          </div>
        )}

        {/* Success — no data extracted */}
        {execution.status === 'success' && rows.length === 0 && (
          <p className="text-sm text-gray-500">Execução concluída. Nenhum dado extraído.</p>
        )}

        {/* Success — result table */}
        {execution.status === 'success' && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border border-gray-200"
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
                        className="px-4 py-2 text-gray-700 border border-gray-200 align-top"
                      >
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-400">
              {rows.length} {rows.length === 1 ? 'linha' : 'linhas'} &middot; ID:{' '}
              {execution.id}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExecutionsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [execution, setExecution] = useState<Execution | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedRecipe = recipes.find((r) => r.id === selectedId) ?? null;

  // Load all recipes once on mount
  useEffect(() => {
    api
      .get<Recipe[]>('/api/recipes')
      .then((data) => {
        setRecipes(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => setFormError(String(err)))
      .finally(() => setLoadingRecipes(false));
  }, []);

  // Reset inputs whenever the selected recipe changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedRecipe) return;
    const init: Record<string, string> = {};
    selectedRecipe.inputs.forEach((inp) => {
      init[inp.name] = '';
    });
    setInputValues(init);
    setExecution(null);
  }, [selectedId]);

  // Poll execution status every 2 s until it reaches a terminal state
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    setFormError('');
    setExecution(null);
    try {
      const exec = await api.post<Execution>('/api/executions', {
        recipe_id: selectedId,
        inputs: inputValues,
      });
      setExecution(exec);
    } catch (err) {
      setFormError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Execuções</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Dispare uma automação e veja o resultado
        </p>
      </div>

      {/* ── Trigger form ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Disparar execução
        </h2>

        {loadingRecipes ? (
          <p className="text-sm text-gray-400">Carregando receitas...</p>
        ) : recipes.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma receita cadastrada.{' '}
            <a href="/recipes/new" className="text-blue-600 underline">
              Criar receita
            </a>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Recipe dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receita
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {selectedRecipe?.description && (
                <p className="mt-1 text-xs text-gray-400">{selectedRecipe.description}</p>
              )}
            </div>

            {/* Dynamic input fields */}
            {selectedRecipe && selectedRecipe.inputs.length > 0 && (
              <div className="space-y-3 pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Inputs
                </p>
                {selectedRecipe.inputs.map((inp) => (
                  <div key={inp.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {inp.name}
                      {inp.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={inputValues[inp.name] ?? ''}
                      onChange={(e) =>
                        setInputValues((prev) => ({
                          ...prev,
                          [inp.name]: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            )}

            {selectedRecipe && selectedRecipe.inputs.length === 0 && (
              <p className="text-xs text-gray-400">Esta receita não requer inputs.</p>
            )}

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={submitting || !selectedId}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Executar'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Result panel ─────────────────────────────────────────────────────── */}
      {execution && (
        <ResultPanel
          execution={execution}
          recipeName={selectedRecipe?.name ?? 'receita'}
        />
      )}
    </div>
  );
}
