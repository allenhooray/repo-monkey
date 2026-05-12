const GM_BRIDGE_CHANNEL = 'gm-bridge';
const GM_BRIDGE_MESSAGE_ACTION = 'gmBridge';

interface BridgeRequest {
  channel: string;
  direction: string;
  id: string;
  scriptId: string;
  type: string;
  payload: any;
}

function isBridgeRequest(data: unknown): data is BridgeRequest {
  if (!data || typeof data !== 'object') return false;
  const d = data as any;
  return d.channel === GM_BRIDGE_CHANNEL && d.direction === 'request' && typeof d.id === 'string' && typeof d.type === 'string';
}

(function installGMBridgeRelay() {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!isBridgeRequest(data)) return;

    chrome.runtime.sendMessage(
      { action: GM_BRIDGE_MESSAGE_ACTION, request: data },
      (response: any) => {
        const lastError = chrome.runtime.lastError;
        const reply = response ?? {
          channel: GM_BRIDGE_CHANNEL,
          direction: 'response',
          id: data.id,
          ok: false,
          error: lastError?.message || 'no response',
        };
        window.postMessage(reply, '*');
      }
    );
  });
})();

(async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'executeScripts',
      url: window.location.href,
    });

    if (response && response.scripts && response.scripts.length > 0) {
      for (const script of response.scripts) {
        try {
          await chrome.runtime.sendMessage({
            action: 'injectScript',
            script: script,
          });
        } catch (error) {
          console.error(`[RepoMonkey] Failed to execute script ${script.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[RepoMonkey] content bootstrap failed:', error);
  }
})();
