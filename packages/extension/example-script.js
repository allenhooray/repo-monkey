// ==UserScript==
// @name         Example Script
// @match        *://*/*
// @description  A simple example userscript
// ==/UserScript==

console.log('RepoMonkey is working! This script runs on all pages.');

// Add a small indicator in the corner to show the script is active
(function() {
    const indicator = document.createElement('div');
    indicator.textContent = '🐒';
    indicator.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        font-size: 24px;
        z-index: 999999;
        opacity: 0.5;
        cursor: pointer;
    `;
    indicator.title = 'RepoMonkey is active!';
    document.body.appendChild(indicator);
})();
