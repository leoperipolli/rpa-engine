'use client';

import { useEffect, useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Recipe, Step, InputDefinition, SessionConfig } from '@/lib/types';
import { Section } from './FieldHelpers';
import { StepList } from './StepList';
import { InputsList } from './InputsList';
import { OutputsEditor } from './OutputsEditor';
import { SecretsEditor } from './SecretsEditor';
import { SessionEditor } from './SessionEditor';
import { JsonImportExport, type RecipeFormData } from './JsonImportExport';

// ─── State ────────────────────────────────────────────────
interface FormState {
  name: string;
  description: string;
  inputs: InputDefinition[];
  steps: Step[];
  session: SessionConfig | null;
  outputs: Record<string, string> | null;
  secrets: Record<string, string> | null;
}

type Action =
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_DESCRIPTION'; payload: string }
  | { type: 'SET_INPUTS'; payload: InputDefinition[] }
  | { type: 'SET_STEPS'; payload: Step[] }
  | { type: 'SET_SESSION'; payload: SessionConfig | null }
  | { type: 'SET_OUTPUTS'; payload: Record<string, string> | null }
  | { type: 'SET_SECRETS'; payload: Record<string, string> | null }
  | { type: 'IMPORT_JSON'; payload: Partial<RecipeFormData> }
  | { type: 'LOAD_RECIPE'; payload: FormState };

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'SET_NAME': return { ...state, name: action.payload };
    case 'SET_DESCRIPTION': return { ...state, description: action.payload };
    case 'SET_INPUTS': return { ...state, inputs: action.payload };
    case 'SET_STEPS': return { ...state, steps: action.payload };
    case 'SET_SESSION': return { ...state, session: action.payload };
    case 'SET_OUTPUTS': return { ...state, outputs: action.payload };
    case 'SET_SECRETS': return { ...state, secrets: action.payload };
    case 'IMPORT_JSON': return { ...state, ...action.payload };
    case 'LOAD_RECIPE': return action.payload;
  }
}

const INITIAL_STATE: FormState = {
  name: '',
  description: '',
  inputs: [],
  steps: [],
  session: null,
  outputs: null,
  secrets: null,
};

// ─── Component ────────────────────────────────────────────
interface Props {
  mode: 'create' | 'edit';
  id?: string;
}

export function RecipeEditor({ mode, id }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [loading, setLoading] = useState(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; steps?: string; api?: string }>({});

  // Load recipe for edit mode
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    api.get<Recipe>(`/api/recipes/${id}`)
      .then((recipe) => {
        dispatch({
          type: 'LOAD_RECIPE',
          payload: {
            name: recipe.name,
            description: recipe.description ?? '',
            inputs: recipe.inputs,
            steps: recipe.steps,
            session: recipe.session ?? null,
            outputs: recipe.outputs ?? null,
            secrets: null, // Never loaded from server (encrypted)
          },
        });
      })
      .catch((err) => setErrors({ api: String(err) }))
      .finally(() => setLoading(false));
  }, [mode, id]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!state.name.trim()) next.name = 'Nome é obrigatório.';
    if (state.steps.length === 0) next.steps = 'Adicione pelo menos 1 passo.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});
    try {
      const payload: Record<string, unknown> = {
        name: state.name.trim(),
        steps: state.steps,
        inputs: state.inputs,
      };
      if (state.description.trim()) payload.description = state.description.trim();
      if (state.session) payload.session = state.session;
      if (state.outputs) payload.outputs = state.outputs;
      if (state.secrets) payload.secrets = state.secrets;

      if (mode === 'create') {
        await api.post<Recipe>('/api/recipes', payload);
      } else {
        await api.put<Recipe>(`/api/recipes/${id}`, payload);
      }
      router.push('/recipes');
    } catch (err) {
      setErrors({ api: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  const recipeData: RecipeFormData = {
    name: state.name,
    description: state.description,
    inputs: state.inputs,
    steps: state.steps,
    session: state.session,
    outputs: state.outputs,
    secrets: state.secrets,
  };

  if (loading) {
    return <div className="p-8 text-sm text-gray-400">Carregando...</div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/recipes" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Receitas
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {mode === 'create' ? 'Nova Receita' : 'Editar Receita'}
          </h1>
        </div>
        <JsonImportExport
          recipeData={recipeData}
          onImport={(data) => dispatch({ type: 'IMPORT_JSON', payload: data })}
        />
      </div>

      {/* API error */}
      {errors.api && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {errors.api}
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        {/* Name + Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => dispatch({ type: 'SET_NAME', payload: e.target.value })}
              placeholder="Ex: Consultar rastreamento TMS1"
              className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={state.description}
              onChange={(e) => dispatch({ type: 'SET_DESCRIPTION', payload: e.target.value })}
              placeholder="O que essa receita faz?"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Inputs */}
        <Section
          title="Inputs"
          description="Variáveis que serão preenchidas na execução"
        >
          <InputsList
            inputs={state.inputs}
            onChange={(inputs) => dispatch({ type: 'SET_INPUTS', payload: inputs })}
            secrets={state.secrets}
            onSecretsChange={(secrets) => dispatch({ type: 'SET_SECRETS', payload: secrets })}
          />
        </Section>

        {/* Steps */}
        <Section
          title="Passos"
          description="Ações que o robô executará em ordem"
        >
          <StepList
            steps={state.steps}
            onChange={(steps) => dispatch({ type: 'SET_STEPS', payload: steps })}
            secrets={state.secrets}
            onSecretsChange={(secrets) => dispatch({ type: 'SET_SECRETS', payload: secrets })}
          />
          {errors.steps && <p className="mt-2 text-xs text-red-600">{errors.steps}</p>}
        </Section>

        {/* Session */}
        <Section
          title="Sessão"
          description="Login automático antes da execução"
        >
          <SessionEditor
            session={state.session}
            onChange={(session) => dispatch({ type: 'SET_SESSION', payload: session })}
          />
        </Section>

        {/* Outputs */}
        <Section
          title="Outputs"
          description="Mapeamento dos resultados extraídos"
        >
          <OutputsEditor
            outputs={state.outputs}
            onChange={(outputs) => dispatch({ type: 'SET_OUTPUTS', payload: outputs })}
          />
        </Section>

        {/* Secrets */}
        <Section
          title="Secrets"
          description="Credenciais criptografadas"
        >
          <SecretsEditor
            secrets={state.secrets}
            onChange={(secrets) => dispatch({ type: 'SET_SECRETS', payload: secrets })}
          />
        </Section>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/recipes"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : mode === 'create' ? 'Salvar receita' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
