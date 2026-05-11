(async () => {
  const response = await chrome.runtime.sendMessage({
    action: 'executeScripts',
    url: window.location.href
  });

  if (response && response.length > 0) {
    for (const script of response) {
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
