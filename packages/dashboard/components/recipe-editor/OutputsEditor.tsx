'use client';

interface Props {
  outputs: Record<string, string> | null;
  onChange: (outputs: Record<string, string> | null) => void;
}

export function OutputsEditor({ outputs, onChange }: Props) {
  const entries = outputs ? Object.entries(outputs) : [];

  const update = (oldKey: string, newKey: string, value: string) => {
    const next = { ...outputs };
    if (oldKey !== newKey) delete next[oldKey];
    next[newKey] = value;
    onChange(next);
  };

  const remove = (key: string) => {
    const next = { ...outputs };
    delete next[key];
    onChange(Object.keys(next).length > 0 ? next : null);
  };

  const add = () => {
    onChange({ ...outputs, '': '' });
  };

  return (
    <div>
      {entries.length === 0 && (
        <p className="text-xs text-gray-400 italic py-2 text-center">
          Outputs mapeiam nomes de resultado para nomes de exibição.
        </p>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 px-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase">Chave (exibição)</span>
            <span className="text-[10px] text-gray-400">&rarr;</span>
            <span className="text-[10px] font-medium text-gray-500 uppercase">Nome do extract</span>
            <span className="w-6" />
          </div>
          {entries.map(([key, value], i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
              <input
                type="text"
                value={key}
                onChange={(e) => update(key, e.target.value, value)}
                placeholder="nome_exibicao"
                className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-400 text-xs">&rarr;</span>
              <input
                type="text"
                value={value}
                onChange={(e) => update(key, key, e.target.value)}
                placeholder="nome_extract"
                className="border border-gray-300 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => remove(key)}
                className="p-1 text-red-400 hover:text-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={add} className="mt-2 text-xs text-blue-600 hover:text-blue-800">
        + Adicionar output
      </button>
    </div>
  );
}
