import { syncScripts } from '../services/sync-service';
import { getScripts, toggleScript } from '../services/script-service';
import { getSettings, saveSettings, unbindRepo } from '../services/storage-service';
import { executeScripts, injectScript } from '../services/execution-service';
import { handleGMBridgeRequest } from '../services/gm-bridge-service';
import type { MessageRequest, MessageResponse } from '../../shared/types';

export function setupMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (request: MessageRequest, sender, sendResponse: (response: any) => void) => {
      let handled = false;

      switch (request.action) {
        case 'syncScripts':
          syncScripts().then(() => sendResponse({ success: true }));
          handled = true;
          break;
        case 'getScripts':
          getScripts().then(scripts => sendResponse({ scripts }));
          handled = true;
          break;
        case 'toggleScript':
          if (request.scriptId) {
            toggleScript(request.scriptId).then(scripts => sendResponse({ scripts }));
          }
          handled = true;
          break;
        case 'getSettings':
          getSettings().then(settings => sendResponse({ settings }));
          handled = true;
          break;
        case 'saveSettings':
          if (request.settings) {
            saveSettings(request.settings).then(settings => sendResponse({ settings }));
          }
          handled = true;
          break;
        case 'unbindRepo':
          unbindRepo().then(response => sendResponse(response));
          handled = true;
          break;
        case 'executeScripts':
          if (request.url) {
            executeScripts(request.url).then(scripts => sendResponse({ scripts }));
          }
          handled = true;
          break;
        case 'injectScript':
          if (request.script && sender.tab?.id) {
            injectScript(request.script, sender.tab.id).then(response => sendResponse(response as MessageResponse));
          }
          handled = true;
          break;
        case 'gmBridge':
          if (request.request) {
            handleGMBridgeRequest(request.request).then(sendResponse);
          }
          handled = true;
          break;
      }

      return handled;
    }
  );
}
