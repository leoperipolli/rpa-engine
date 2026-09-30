'use client';

import type { InputDefinition } from '@/lib/types';

interface Props {
  inputs: InputDefinition[];
  onChange: (inputs: InputDefinition[]) => void;
  secrets: Record<string, string> | null;
  onSecretsChange: (secrets: Record<string, string> | null) => void;
}

export function InputsList({ inputs, onChange, secrets, onSecretsChange }: Props) {
  const update = (i: number, patch: Partial<InputDefinition>) => {
    const next = [...inputs];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const remove = (i: number) => {
    const input = inputs[i];
    // Remove associated secret if sensitive
    if (input.sensitive && input.name && secrets) {
      const nextSecrets = { ...secrets };
      delete nextSecrets[input.name];
      onSecretsChange(Object.keys(nextSecrets).length > 0 ? nextSecrets : null);
    }
    onChange(inputs.filter((_, idx) => idx !== i));
  };

  const add = () => onChange([...inputs, { name: '', required: true, sensitive: false }]);

  const toggleSensitive = (i: number, checked: boolean) => {
    const input = inputs[i];
    update(i, { sensitive: checked, default: undefined });

    if (checked && input.name) {
      // Add empty secret entry
      onSecretsChange({ ...secrets, [input.name]: '' });
    } else if (!checked && input.name && secrets) {
      // Remove secret entry
      const nextSecrets = { ...secrets };
      delete nextSecrets[input.name];
      onSecretsChange(Object.keys(nextSecrets).length > 0 ? nextSecrets : null);
    }
  };

  const updateSecretValue = (name: string, value: string) => {
    onSecretsChange({ ...secrets, [name]: value });
  };

  // When input name changes, update the secret key too
  const updateName = (i: number, newName: string) => {
    const input = inputs[i];
    if (input.sensitive && input.name && secrets) {
      const oldValue = secrets[input.name] ?? '';
      const nextSecrets = { ...secrets };
      delete nextSecrets[input.name];
      if (newName) nextSecrets[newName] = oldValue;
      onSecretsChange(Object.keys(nextSecrets).length > 0 ? nextSecrets : null);
    }
    update(i, { name: newName });
  };

  return (
    <div>
      {inputs.length === 0 && (
        <p className="text-xs text-gray-400 italic py-2 text-center">
          Nenhum input definido. Inputs permitem parametrizar a receita na execução.
        </p>
      )}

      {inputs.length > 0 && (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_1fr_1fr_auto] gap-2 px-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase">Nome</span>
            <span className="text-[10px] font-medium text-gray-500 uppercase w-16 text-center">Obrig.</span>
            <span className="text-[10px] font-medium text-gray-500 uppercase w-16 text-center">Sensível</span>
            <span className="text-[10px] font-medium text-gray-500 uppercase">
              {/* Column header changes based on context */}
              Padrão / Valor
            </span>
            <span className="text-[10px] font-medium text-gray-500 uppercase">Descrição</span>
            <span className="w-6" />
          </div>

          {inputs.map((input, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_1fr_1fr_auto] gap-2 items-center">
              <input
                type="text"
                value={input.name}
                onChange={(e) => updateName(i, e.target.value)}
                placeholder="nome_variavel"
                className="border border-gray-300 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="w-16 flex justify-center">
                <input
                  type="checkbox"
                  checked={input.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="w-16 flex justify-center">
                <input
                  type="checkbox"
                  checked={input.sensitive ?? false}
                  onChange={(e) => toggleSensitive(i, e.target.checked)}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
              </div>
              {input.sensitive ? (
                <input
                  type="password"
                  value={(input.name && secrets?.[input.name]) ?? ''}
                  onChange={(e) => input.name && updateSecretValue(input.name, e.target.value)}
                  placeholder="valor sensível (criptografado)"
                  className="border border-amber-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-amber-50"
                />
              ) : (
                <input
                  type="text"
                  value={input.default ?? ''}
                  onChange={(e) => update(i, { default: e.target.value || undefined })}
                  placeholder="valor padrão"
                  className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
              <input
                type="text"
                value={input.description ?? ''}
                onChange={(e) => update(i, { description: e.target.value || undefined })}
                placeholder="descrição"
                className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1 text-red-400 hover:text-red-600"
                title="Remover"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
      >
        + Adicionar input
      </button>

      {inputs.some((inp) => inp.sensitive) && (
        <p className="mt-2 text-[10px] text-amber-600">
          Inputs sensíveis são salvos como secrets (criptografados). Use <code className="bg-amber-50 px-1 rounded">{'{{secrets.nome}}'}</code> nos steps.
        </p>
      )}
    </div>
  );
}
