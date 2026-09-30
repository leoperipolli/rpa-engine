import type { RecordedStep, RecordingState } from './types.js';

const DEFAULT_STATE: RecordingState = {
  isRecording: false,
  steps: [],
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set(DEFAULT_STATE);
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true;
  }
);

async function broadcastToTabs(message: { type: string }): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id == null) continue;
    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
  }
}

async function handleMessage(
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: BackgroundResponse) => void
): Promise<void> {
  switch (message.type) {
    case 'START_RECORDING': {
      // Determine the active tab to restrict recording to it
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const recordingTabId = activeTab?.id ?? null;
      await chrome.storage.local.set({ isRecording: true, steps: [], recordingTabId });
      // Only notify the recording tab
      if (recordingTabId != null) {
        chrome.tabs.sendMessage(recordingTabId, { type: 'RECORDING_STARTED' }).catch(() => {});
      }
      sendResponse({ success: true });
      break;
    }
    case 'STOP_RECORDING': {
      await chrome.storage.local.set({ isRecording: false, recordingTabId: null });
      await broadcastToTabs({ type: 'RECORDING_STOPPED' });
      sendResponse({ success: true });
      break;
    }
    case 'GET_STATE': {
      const state = await chrome.storage.local.get(['isRecording', 'steps']);
      sendResponse({ success: true, data: state });
      break;
    }
    case 'ADD_STEP': {
      // Only accept steps from the recording tab
      const stored = await chrome.storage.local.get(['steps', 'recordingTabId']);
      const recordingTab = stored.recordingTabId as number | null;
      if (recordingTab != null && sender.tab?.id !== recordingTab) {
        sendResponse({ success: true }); // silently ignore
        break;
      }
      const steps: RecordedStep[] = Array.isArray(stored.steps) ? stored.steps : [];
      steps.push(message.step);
      await chrome.storage.local.set({ steps });
      sendResponse({ success: true });
      break;
    }
    default: {
      sendResponse({ success: false, error: 'Unknown message type' });
    }
  }
}

export type BackgroundMessage =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'GET_STATE' }
  | { type: 'ADD_STEP'; step: RecordedStep };

export type BackgroundResponse =
  | { success: true; data?: unknown }
  | { success: false; error: string };
