import type { BackgroundMessage, BackgroundResponse } from '../background.js';

const btnStart = document.getElementById('btn-start') as HTMLButtonElement;
const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
const btnPick = document.getElementById('btn-pick') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;

function sendMessage(message: BackgroundMessage): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage(message);
}

async function refreshUiState(): Promise<void> {
  const response = await sendMessage({ type: 'GET_STATE' });
  if (!response.success) return;

  const data = (response as { success: true; data: { isRecording: boolean; steps: unknown[] } }).data;
  const { isRecording, steps } = data;

  btnStart.disabled = isRecording;
  btnStop.disabled = !isRecording;
  btnPick.disabled = !isRecording;
  btnExport.disabled = isRecording || steps.length === 0;

  statusEl.textContent = isRecording
    ? `Gravando... (${steps.length} ações)`
    : steps.length > 0
    ? `${steps.length} ações gravadas`
    : 'Pronto';
}

btnStart.addEventListener('click', async () => {
  await sendMessage({ type: 'START_RECORDING' });
  await refreshUiState();
});

btnStop.addEventListener('click', async () => {
  await sendMessage({ type: 'STOP_RECORDING' });
  await refreshUiState();
});

btnPick.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: 'START_PICK' }).catch(() => {});
  }
  window.close();
});

btnExport.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('export.html') });
});

refreshUiState();
