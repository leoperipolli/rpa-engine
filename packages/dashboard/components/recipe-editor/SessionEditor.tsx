'use client';

import type { SessionConfig, Step } from '@/lib/types';
import { TextInput, NumberInput } from './FieldHelpers';
import { StepList } from './StepList';

interface Props {
  session: SessionConfig | null;
  onChange: (session: SessionConfig | null) => void;
}

export function SessionEditor({ session, onChange }: Props) {
  const enabled = session !== null;

  const toggle = () => {
    if (enabled) {
      onChange(null);
    } else {
      onChange({ check: { selector: '' }, login_steps: [] });
    }
  };

  const updateCheck = (patch: Partial<SessionConfig['check']>) => {
    if (!session) return;
    onChange({ ...session, check: { ...session.check, ...patch } });
  };

  const updateLoginSteps = (login_steps: Step[]) => {
    if (!session) return;
    onChange({ ...session, login_steps });
  };

  return (
    <div>
      {/* Toggle */}
      <label className="flex items-center gap-2 cursor-pointer mb-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggle}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Configurar sessão (login automático)</span>
      </label>

      {enabled && session && (
        <div className="space-y-4 pl-4 border-l-2 border-blue-100">
          <p className="text-xs text-gray-500">
            O runner verifica se a sessão está ativa antes de cada execução. Se não estiver, executa os passos de login.
          </p>

          {/* Check config */}
          <div className="space-y-3">
            <TextInput
              label="Seletor de sessão ativa"
              value={session.check.selector}
              onChange={(selector) => updateCheck({ selector })}
              placeholder="#user-menu, .logged-in-indicator"
              mono
              required
            />
            <NumberInput
              label="Timeout da verificação"
              value={session.check.timeout}
              onChange={(timeout) => updateCheck({ timeout })}
              placeholder="5000"
              suffix="ms"
            />
          </div>

          {/* Login steps */}
          <div className="mt-4">
            <StepList
              steps={session.login_steps}
              onChange={updateLoginSteps}
              label="Passos de login"
            />
          </div>
        </div>
      )}
    </div>
  );
}
