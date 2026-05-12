import { syncScripts } from '../services/sync-service';
import { getScripts, toggleScript } from '../services/script-service';
import { getSettings, saveSettings, unbindRepo } from '../services/storage-service';
import { syncRegistrations, clearRegistrations } from '../services/execution-service';
import { handleGMBridgeRequest } from '../services/gm-bridge-service';
import type { MessageRequest, MessageResponse } from '../../shared/types';

export function setupMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (request: MessageRequest, _sender, sendResponse: (response: any) => void) => {
      let handled = false;

      switch (request.action) {
        case 'syncScripts':
          syncScripts()
            .then(() => syncRegistrations())
            .then(() => sendResponse({ success: true }))
            .catch((error: Error) =>
              sendResponse({ success: false, error: error.message }),
            );
          handled = true;
          break;
        case 'getScripts':
          getScripts().then(scripts => sendResponse({ scripts }));
          handled = true;
          break;
        case 'toggleScript':
          if (request.scriptId) {
            toggleScript(request.scriptId)
              .then(async (scripts) => {
                await syncRegistrations();
                sendResponse({ scripts });
              })
              .catch((error: Error) =>
                sendResponse({ success: false, error: error.message }),
              );
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
          unbindRepo()
            .then(async (response) => {
              await clearRegistrations();
              sendResponse(response as MessageResponse);
            })
            .catch((error: Error) =>
              sendResponse({ success: false, error: error.message }),
            );
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
