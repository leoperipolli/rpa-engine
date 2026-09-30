'use client';

import type { ReactNode } from 'react';

/* ─── TextInput ─────────────────────────────────────────── */
interface TextInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  interpolation?: boolean;
  mono?: boolean;
  required?: boolean;
  error?: string;
}

export function TextInput({ label, value, onChange, placeholder, interpolation, mono, required, error }: TextInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          mono ? 'font-mono text-xs' : ''
        } ${error ? 'border-red-400' : 'border-gray-300'}`}
      />
      {interpolation && (
        <p className="mt-0.5 text-[10px] text-gray-400">
          {'Suporta {{inputs.X}} e {{secrets.X}}'}
        </p>
      )}
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ─── NumberInput ────────────────────────────────────────── */
interface NumberInputProps {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  suffix?: string;
  min?: number;
}

export function NumberInput({ label, value, onChange, placeholder, suffix, min }: NumberInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={placeholder}
          min={min}
          className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {suffix && <span className="text-xs text-gray-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

/* ─── SelectDropdown ────────────────────────────────────── */
interface SelectOption { value: string; label: string; }

interface SelectDropdownProps {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function SelectDropdown({ label, value, onChange, options, placeholder }: SelectDropdownProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">{placeholder ?? '— Nenhum —'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Checkbox ──────────────────────────────────────────── */
interface CheckboxProps {
  label: string;
  checked: boolean | undefined;
  onChange: (v: boolean) => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked ?? false}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-xs text-gray-600">{label}</span>
    </label>
  );
}

/* ─── Section ───────────────────────────────────────────── */
interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Section({ title, description, children, actions }: SectionProps) {
  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ─── StringListInput (for upload files[]) ──────────────── */
interface StringListInputProps {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

export function StringListInput({ label, values, onChange, placeholder }: StringListInputProps) {
  const update = (i: number, v: string) => {
    const next = [...values];
    next[i] = v;
    onChange(next);
  };
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  const add = () => onChange([...values, '']);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="space-y-1.5">
        {values.map((v, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              type="text"
              value={v}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
            >
              X
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-1.5 text-xs text-blue-600 hover:text-blue-800"
      >
        + Adicionar arquivo
      </button>
    </div>
  );
}
