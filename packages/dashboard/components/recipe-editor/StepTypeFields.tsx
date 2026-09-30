'use client';

import type { Step } from '@/lib/types';
import { TextInput, NumberInput, SelectDropdown, Checkbox, StringListInput } from './FieldHelpers';

// ─── Secret helpers ──────────────────────────────────────────────────────────

const SECRET_REF_RE = /^\{\{secrets\.([^}]+)\}\}$/;

function secretKeyFromRef(value: string): string | null {
  const m = value.match(SECRET_REF_RE);
  return m ? m[1] : null;
}

function makeSecretKey(stepIndex: number): string {
  return `step_${stepIndex}_value`;
}

// ─── Sensitive value field ───────────────────────────────────────────────────

interface SensitiveFieldProps {
  step: Step & { value: string };
  stepIndex: number;
  secrets: Record<string, string> | null;
  onSecretsChange: (secrets: Record<string, string> | null) => void;
  onChange: (step: Step) => void;
  label: string;
  placeholder: string;
  interpolation?: boolean;
}

function SensitiveValueField({
  step, stepIndex, secrets, onSecretsChange, onChange,
  label, placeholder, interpolation,
}: SensitiveFieldProps) {
  const secretKey = secretKeyFromRef(step.value);
  const isSensitive = secretKey !== null;

  const toggleSensitive = (checked: boolean) => {
    if (checked) {
      const key = makeSecretKey(stepIndex);
      const currentValue = step.value;
      onSecretsChange({ ...secrets, [key]: currentValue });
      onChange({ ...step, value: `{{secrets.${key}}}` } as Step);
    } else if (secretKey) {
      const restoredValue = secrets?.[secretKey] ?? '';
      const nextSecrets = { ...secrets };
      delete nextSecrets[secretKey];
      onSecretsChange(Object.keys(nextSecrets).length > 0 ? nextSecrets : null);
      onChange({ ...step, value: restoredValue } as Step);
    }
  };

  const updateSecretValue = (value: string) => {
    if (secretKey) {
      onSecretsChange({ ...secrets, [secretKey]: value });
    }
  };

  return (
    <>
      {isSensitive ? (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {label} <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={secrets?.[secretKey!] ?? ''}
            onChange={(e) => updateSecretValue(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-amber-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-amber-50"
          />
          <p className="mt-0.5 text-[10px] text-amber-600">
            Salvo como secret criptografado: <code className="bg-amber-50 px-1 rounded">{step.value}</code>
          </p>
        </div>
      ) : (
        <TextInput
          label={label}
          value={step.value}
          onChange={(value) => onChange({ ...step, value } as Step)}
          placeholder={placeholder}
          interpolation={interpolation}
          required
        />
      )}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isSensitive}
          onChange={(e) => toggleSensitive(e.target.checked)}
          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-xs text-gray-600">Sensível (criptografar como secret)</span>
      </label>
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  step: Step;
  onChange: (step: Step) => void;
  stepIndex?: number;
  secrets?: Record<string, string> | null;
  onSecretsChange?: (secrets: Record<string, string> | null) => void;
}

export function StepTypeFields({ step, onChange, stepIndex, secrets, onSecretsChange }: Props) {
  switch (step.type) {
    case 'navigate':
      return (
        <div className="space-y-3">
          <TextInput
            label="URL"
            value={step.url}
            onChange={(url) => onChange({ ...step, url })}
            placeholder="https://exemplo.com/pagina"
            interpolation
            mono
            required
          />
          <SelectDropdown
            label="Aguardar até"
            value={step.waitUntil}
            onChange={(v) => onChange({ ...step, waitUntil: v as 'load' | 'domcontentloaded' | 'networkidle' | undefined })}
            options={[
              { value: 'load', label: 'Página carregada (load)' },
              { value: 'domcontentloaded', label: 'DOM pronto (domcontentloaded)' },
              { value: 'networkidle', label: 'Rede ociosa (networkidle)' },
            ]}
          />
        </div>
      );

    case 'click':
      return (
        <div className="space-y-3">
          <TextInput
            label="Seletor CSS"
            value={step.selector}
            onChange={(selector) => onChange({ ...step, selector })}
            placeholder="#btn-submit, .action-button"
            mono
            required
          />
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="30000"
            suffix="ms"
          />
        </div>
      );

    case 'hover':
      return (
        <div className="space-y-3">
          <TextInput
            label="Seletor CSS"
            value={step.selector}
            onChange={(selector) => onChange({ ...step, selector })}
            placeholder=".visual-container, div[aria-label='meu visual']"
            mono
            required
          />
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="30000"
            suffix="ms"
          />
        </div>
      );

    case 'fill':
      return (
        <div className="space-y-3">
          <TextInput
            label="Seletor CSS"
            value={step.selector}
            onChange={(selector) => onChange({ ...step, selector })}
            placeholder="#campo-email, input[name='usuario']"
            mono
            required
          />
          {stepIndex != null && onSecretsChange ? (
            <SensitiveValueField
              step={step}
              stepIndex={stepIndex}
              secrets={secrets ?? null}
              onSecretsChange={onSecretsChange}
              onChange={onChange}
              label="Valor"
              placeholder="{{inputs.usuario}} ou texto fixo"
              interpolation
            />
          ) : (
            <TextInput
              label="Valor"
              value={step.value}
              onChange={(value) => onChange({ ...step, value })}
              placeholder="{{inputs.usuario}} ou texto fixo"
              interpolation
              required
            />
          )}
          <Checkbox
            label="Limpar campo antes de preencher"
            checked={step.clearFirst}
            onChange={(clearFirst) => onChange({ ...step, clearFirst })}
          />
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="30000"
            suffix="ms"
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-3">
          <TextInput
            label="Seletor CSS"
            value={step.selector}
            onChange={(selector) => onChange({ ...step, selector })}
            placeholder="select#tipo, select[name='opcao']"
            mono
            required
          />
          {stepIndex != null && onSecretsChange ? (
            <SensitiveValueField
              step={step}
              stepIndex={stepIndex}
              secrets={secrets ?? null}
              onSecretsChange={onSecretsChange}
              onChange={onChange}
              label="Valor da opção"
              placeholder="{{inputs.opcao}} ou valor fixo"
              interpolation
            />
          ) : (
            <TextInput
              label="Valor da opção"
              value={step.value}
              onChange={(value) => onChange({ ...step, value })}
              placeholder="{{inputs.opcao}} ou valor fixo"
              interpolation
              required
            />
          )}
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="30000"
            suffix="ms"
          />
        </div>
      );

    case 'wait':
      return (
        <div className="space-y-3">
          <TextInput
            label="Seletor CSS (opcional se usar ms)"
            value={step.selector ?? ''}
            onChange={(selector) => onChange({ ...step, selector: selector || undefined })}
            placeholder="#loading-indicator"
            mono
          />
          <NumberInput
            label="Tempo fixo (opcional se usar seletor)"
            value={step.ms}
            onChange={(ms) => onChange({ ...step, ms })}
            placeholder="2000"
            suffix="ms"
          />
          <Checkbox
            label="Aguardar desaparecer (hidden)"
            checked={step.hidden}
            onChange={(hidden) => onChange({ ...step, hidden })}
          />
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="30000"
            suffix="ms"
          />
        </div>
      );

    case 'extract':
      return (
        <div className="space-y-3">
          <TextInput
            label="Nome do resultado"
            value={step.name}
            onChange={(name) => onChange({ ...step, name })}
            placeholder="titulo, preco, status"
            required
          />
          <TextInput
            label="Seletor CSS"
            value={step.selector}
            onChange={(selector) => onChange({ ...step, selector })}
            placeholder="h1.titulo, .valor-total"
            mono
            required
          />
          <TextInput
            label="Atributo HTML (vazio = texto)"
            value={step.attribute ?? ''}
            onChange={(attribute) => onChange({ ...step, attribute: attribute || undefined })}
            placeholder="href, src, data-value"
          />
          <Checkbox
            label="Extrair múltiplos elementos"
            checked={step.multiple}
            onChange={(multiple) => onChange({ ...step, multiple })}
          />
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="30000"
            suffix="ms"
          />
        </div>
      );

    case 'screenshot':
      return (
        <div className="space-y-3">
          <TextInput
            label="Nome"
            value={step.name ?? ''}
            onChange={(name) => onChange({ ...step, name: name || undefined })}
            placeholder="screenshot"
          />
          <Checkbox
            label="Página inteira (fullPage)"
            checked={step.fullPage}
            onChange={(fullPage) => onChange({ ...step, fullPage })}
          />
        </div>
      );

    case 'download':
      return (
        <div className="space-y-3">
          <TextInput
            label="Seletor CSS (elemento que dispara o download)"
            value={step.selector}
            onChange={(selector) => onChange({ ...step, selector })}
            placeholder="a.download-link, #btn-export"
            mono
            required
          />
          <TextInput
            label="Nome do resultado"
            value={step.name ?? ''}
            onChange={(name) => onChange({ ...step, name: name || undefined })}
            placeholder="relatorio"
          />
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="30000"
            suffix="ms"
          />
        </div>
      );

    case 'upload':
      return (
        <div className="space-y-3">
          <TextInput
            label="Seletor CSS (input type=file)"
            value={step.selector}
            onChange={(selector) => onChange({ ...step, selector })}
            placeholder="input[type='file']"
            mono
            required
          />
          <StringListInput
            label="Arquivos"
            values={step.files}
            onChange={(files) => onChange({ ...step, files })}
            placeholder="caminho/do/arquivo.pdf ou base64:..."
          />
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="30000"
            suffix="ms"
          />
        </div>
      );

    case 'pbi_export':
      return (
        <div className="space-y-3">
          <TextInput
            label="URL do endpoint de export"
            value={step.url}
            onChange={(url) => onChange({ ...step, url })}
            placeholder="https://wabi-....analysis.windows.net/export/xlsx"
            mono
            required
          />
          <TextInput
            label="Body (JSON)"
            value={step.body}
            onChange={(body) => onChange({ ...step, body })}
            placeholder='{"exportDataType":2,...}'
            mono
            required
          />
          <TextInput
            label="Nome do resultado"
            value={step.name ?? ''}
            onChange={(name) => onChange({ ...step, name: name || undefined })}
            placeholder="pbi_export"
          />
          <NumberInput
            label="Timeout"
            value={step.timeout}
            onChange={(timeout) => onChange({ ...step, timeout })}
            placeholder="120000"
            suffix="ms"
          />
        </div>
      );
  }
}
