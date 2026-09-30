'use client';

import { useState } from 'react';
import type { Step, StepType } from '@/lib/types';
import { createDefaultStep, STEP_TYPE_LABELS, ALL_STEP_TYPES, STEP_TYPE_DESCRIPTIONS } from '@/lib/step-defaults';
import { StepCard } from './StepCard';

interface Props {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  label?: string;
  secrets?: Record<string, string> | null;
  onSecretsChange?: (secrets: Record<string, string> | null) => void;
}

export function StepList({ steps, onChange, label = 'Passos', secrets, onSecretsChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);

  const toggleCollapse = (i: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const updateStep = (i: number, step: Step) => {
    const next = [...steps];
    next[i] = step;
    onChange(next);
  };

  const removeStep = (i: number) => {
    onChange(steps.filter((_, idx) => idx !== i));
    // Adjust collapsed indices
    setCollapsed((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
  };

  const duplicateStep = (i: number) => {
    const next = [...steps];
    next.splice(i + 1, 0, structuredClone(steps[i]));
    onChange(next);
    // New step starts expanded
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...steps];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
    // Swap collapsed state too
    setCollapsed((prev) => {
      const next = new Set(prev);
      const hadI = prev.has(i);
      const hadPrev = prev.has(i - 1);
      if (hadI) next.add(i - 1); else next.delete(i - 1);
      if (hadPrev) next.add(i); else next.delete(i);
      return next;
    });
  };

  const moveDown = (i: number) => {
    if (i === steps.length - 1) return;
    const next = [...steps];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
    setCollapsed((prev) => {
      const next = new Set(prev);
      const hadI = prev.has(i);
      const hadNext = prev.has(i + 1);
      if (hadI) next.add(i + 1); else next.delete(i + 1);
      if (hadNext) next.add(i); else next.delete(i);
      return next;
    });
  };

  const addStep = (type: StepType) => {
    onChange([...steps, createDefaultStep(type)]);
    setShowAddMenu(false);
    // New step is expanded by default (not in collapsed set)
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
        {steps.length > 1 && (
          <button
            type="button"
            onClick={() => {
              if (collapsed.size === steps.length) {
                setCollapsed(new Set());
              } else {
                setCollapsed(new Set(steps.map((_, i) => i)));
              }
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {collapsed.size === steps.length ? 'Expandir todos' : 'Colapsar todos'}
          </button>
        )}
      </div>

      {steps.length === 0 && (
        <p className="text-xs text-gray-400 italic py-4 text-center">
          Nenhum passo adicionado. Clique em &quot;Adicionar passo&quot; abaixo.
        </p>
      )}

      <div className="space-y-2">
        {steps.map((step, i) => (
          <StepCard
            key={i}
            step={step}
            index={i}
            total={steps.length}
            collapsed={collapsed.has(i)}
            onToggleCollapse={() => toggleCollapse(i)}
            onChange={(s) => updateStep(i, s)}
            onRemove={() => removeStep(i)}
            onDuplicate={() => duplicateStep(i)}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
            secrets={secrets}
            onSecretsChange={onSecretsChange}
          />
        ))}
      </div>

      {/* Add step button */}
      <div className="mt-3 relative">
        <button
          type="button"
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md border border-dashed border-blue-300 w-full"
        >
          + Adicionar passo
        </button>

        {showAddMenu && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
            {/* Menu */}
            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 max-h-72 overflow-y-auto">
              {ALL_STEP_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addStep(type)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-3"
                >
                  <span className="text-sm font-medium text-gray-800 w-28">{STEP_TYPE_LABELS[type]}</span>
                  <span className="text-xs text-gray-500">{STEP_TYPE_DESCRIPTIONS[type]}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
