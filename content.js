(async () => {
  const response = await chrome.runtime.sendMessage({
    action: 'executeScripts',
    url: window.location.href
  });

  if (response && response.length > 0) {
    for (const script of response) {
      try {
        const scriptElement = document.createElement('script');
        scriptElement.textContent = script.content;
        scriptElement.type = 'text/javascript';
        (document.head || document.documentElement).appendChild(scriptElement);
        scriptElement.remove();
      } catch (error) {
        console.error(`Failed to execute script ${script.name}:`, error);
      }
    }
  }
})();
