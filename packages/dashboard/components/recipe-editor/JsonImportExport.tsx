'use client';

import { useState } from 'react';
import type { Step, InputDefinition, SessionConfig } from '@/lib/types';

export interface RecipeFormData {
  name: string;
  description: string;
  inputs: InputDefinition[];
  steps: Step[];
  session: SessionConfig | null;
  outputs: Record<string, string> | null;
  secrets: Record<string, string> | null;
}

interface Props {
  recipeData: RecipeFormData;
  onImport: (data: Partial<RecipeFormData>) => void;
}

export function JsonImportExport({ recipeData, onImport }: Props) {
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleImport = () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importText);

      const data: Partial<RecipeFormData> = {};

      if (parsed.name) data.name = parsed.name;
      if (parsed.description) data.description = parsed.description;
      if (Array.isArray(parsed.inputs)) data.inputs = parsed.inputs;
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        data.steps = parsed.steps;
      } else {
        setImportError('O JSON deve conter ao menos 1 step.');
        return;
      }
      if (parsed.session) data.session = parsed.session;
      if (parsed.outputs) data.outputs = parsed.outputs;
      if (parsed.secrets) data.secrets = parsed.secrets;

      onImport(data);
      setShowImport(false);
      setImportText('');
    } catch {
      setImportError('JSON inválido. Verifique a sintaxe.');
    }
  };

  const exportJson = () => {
    const obj: Record<string, unknown> = {};
    if (recipeData.steps.length > 0) obj.steps = recipeData.steps;
    if (recipeData.inputs.length > 0) obj.inputs = recipeData.inputs;
    if (recipeData.session) obj.session = recipeData.session;
    if (recipeData.outputs) obj.outputs = recipeData.outputs;
    return JSON.stringify(obj, null, 2);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportJson());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setShowImport(true); setShowExport(false); }}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Importar JSON
        </button>
        <button
          type="button"
          onClick={() => { setShowExport(true); setShowImport(false); }}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Ver JSON
        </button>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-gray-800">Importar JSON</h3>
              <button
                type="button"
                onClick={() => { setShowImport(false); setImportError(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-2">
                Cole o JSON exportado pela extensão ou de outra fonte.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={12}
                spellCheck={false}
                placeholder={'{\n  "steps": [...],\n  "inputs": [...]\n}'}
                className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
              {importError && <p className="mt-1 text-xs text-red-600">{importError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => { setShowImport(false); setImportError(''); }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-gray-800">JSON da Receita</h3>
              <button
                type="button"
                onClick={() => setShowExport(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <textarea
                readOnly
                value={exportJson()}
                rows={16}
                className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-mono bg-gray-50 resize-y"
              />
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => setShowExport(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
