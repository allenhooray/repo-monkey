import type { Script } from './types';

(async () => {
  const response = await chrome.runtime.sendMessage({
    action: 'executeScripts',
    url: window.location.href
  });

  if (response && response.scripts && response.scripts.length > 0) {
    for (const script of response.scripts) {
      try {
        await chrome.runtime.sendMessage({
          action: 'injectScript',
          script: script
        });
      } catch (error) {
        console.error(`Failed to execute script ${script.name}:`, error);
      }
    }
  }
})();
