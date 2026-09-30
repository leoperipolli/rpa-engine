'use client';

import type { Step, StepType } from '@/lib/types';
import { STEP_TYPE_LABELS, ALL_STEP_TYPES, changeStepType, getStepPreview } from '@/lib/step-defaults';
import { StepTypeFields } from './StepTypeFields';

interface Props {
  step: Step;
  index: number;
  total: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onChange: (step: Step) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  secrets?: Record<string, string> | null;
  onSecretsChange?: (secrets: Record<string, string> | null) => void;
}

export function StepCard({
  step, index, total, collapsed, onToggleCollapse,
  onChange, onRemove, onDuplicate, onMoveUp, onMoveDown,
  secrets, onSecretsChange,
}: Props) {
  const preview = getStepPreview(step);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 rounded-t-lg"
        onClick={onToggleCollapse}
      >
        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Step number */}
        <span className="text-xs font-mono text-gray-400 w-5">#{index + 1}</span>

        {/* Type badge */}
        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
          {STEP_TYPE_LABELS[step.type]}
        </span>

        {/* Preview */}
        <span className="text-xs text-gray-500 truncate flex-1 font-mono">{preview}</span>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Mover para cima"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Mover para baixo"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Duplicar"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-400 hover:text-red-600"
            title="Remover"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-3">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo da ação</label>
            <select
              value={step.type}
              onChange={(e) => onChange(changeStepType(step, e.target.value as StepType))}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ALL_STEP_TYPES.map((t) => (
                <option key={t} value={t}>{STEP_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Type-specific fields */}
          <StepTypeFields step={step} onChange={onChange} stepIndex={index} secrets={secrets} onSecretsChange={onSecretsChange} />
        </div>
      )}
    </div>
  );
}
