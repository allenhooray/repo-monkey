import type { Script } from '../types/script';

const GM_RUNTIME_SOURCE = `
(function initGMRuntime(scriptId, scriptName, scriptMetaStr, metadata, grants) {
  function callBridge(type, payload) {
    return new Promise(function (resolve, reject) {
      try {
        chrome.runtime.sendMessage({
          action: 'gmBridge',
          request: {
            channel: 'gm-bridge',
            direction: 'request',
            id: 'gm_' + scriptId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            scriptId: scriptId,
            type: type,
            payload: payload,
          },
        }, function (response) {
          var lastError = chrome.runtime && chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!response) {
            reject(new Error('no response'));
            return;
          }
          if (response.ok) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || 'GM bridge error'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  var grantSet = new Set(grants || []);
  function isGranted(name) {
    return grantSet.size === 0 || grantSet.has(name);
  }

  var GM_info = {
    script: Object.assign({}, metadata, {
      name: scriptName,
      grant: grants || [],
    }),
    scriptHandler: 'RepoMonkey',
    version: '1.0.0',
    scriptMetaStr: scriptMetaStr,
  };

  function GM_setValue(key, value) {
    if (!isGranted('GM_setValue')) return;
    return callBridge('GM_setValue', { scriptId: scriptId, key: key, value: value });
  }

  function GM_getValue(key, defaultValue) {
    if (!isGranted('GM_getValue')) return defaultValue;
    return callBridge('GM_getValue', { scriptId: scriptId, key: key }).then(function (v) {
      return v === undefined || v === null ? defaultValue : v;
    });
  }

  function GM_deleteValue(key) {
    if (!isGranted('GM_deleteValue')) return;
    return callBridge('GM_deleteValue', { scriptId: scriptId, key: key });
  }

  function GM_listValues() {
    if (!isGranted('GM_listValues')) return Promise.resolve([]);
    return callBridge('GM_listValues', { scriptId: scriptId });
  }

  function GM_addStyle(css) {
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  function GM_log() {
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console, ['[' + scriptName + ']'].concat(args));
  }

  function GM_openInTab(url, options) {
    if (!isGranted('GM_openInTab')) return;
    var opts = typeof options === 'boolean' ? { active: !options } : (options || {});
    return callBridge('GM_openInTab', { url: url, options: opts });
  }

  function GM_setClipboard(text) {
    if (!isGranted('GM_setClipboard')) return;
    var value = String(text);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(value);
      }
    } catch (_e) {
      // fall through to textarea fallback
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch (e) {
      console.error('[' + scriptName + '] GM_setClipboard failed:', e);
    }
  }

  function GM_notification(detailsOrText, title) {
    if (!isGranted('GM_notification')) return;
    var details = typeof detailsOrText === 'string'
      ? { text: detailsOrText, title: title || scriptName }
      : (detailsOrText || {});
    var onclick = details.onclick;
    return callBridge('GM_notification', {
      text: details.text || '',
      title: details.title || scriptName,
      image: details.image,
    }).then(function (res) {
      if (res && res.clicked && typeof onclick === 'function') {
        try { onclick(); } catch (e) { console.error(e); }
      }
      return res;
    });
  }

  function GM_xmlhttpRequest(details) {
    if (!isGranted('GM_xmlhttpRequest')) {
      if (details && typeof details.onerror === 'function') {
        details.onerror({ status: 0, statusText: 'not granted', responseHeaders: '', response: null, finalUrl: details.url });
      }
      return;
    }
    var payload = {
      url: details.url,
      method: details.method || 'GET',
      headers: details.headers || {},
      data: details.data,
      responseType: details.responseType || 'text',
      timeout: details.timeout,
    };
    var aborted = false;
    callBridge('GM_xmlhttpRequest', payload).then(function (res) {
      if (aborted) return;
      if (res && res.timedOut && typeof details.ontimeout === 'function') {
        details.ontimeout(res);
      } else if (res && res.error && typeof details.onerror === 'function') {
        details.onerror(res);
      } else if (typeof details.onload === 'function') {
        details.onload(res);
      }
    }, function (err) {
      if (typeof details.onerror === 'function') {
        details.onerror({ status: 0, statusText: err.message, responseHeaders: '', response: null, finalUrl: details.url });
      }
    });
    return {
      abort: function () {
        aborted = true;
        if (typeof details.onabort === 'function') {
          details.onabort({ status: 0, statusText: 'aborted', responseHeaders: '', response: null, finalUrl: details.url });
        }
      },
    };
  }

  return {
    GM_info: GM_info,
    GM_setValue: GM_setValue,
    GM_getValue: GM_getValue,
    GM_deleteValue: GM_deleteValue,
    GM_listValues: GM_listValues,
    GM_addStyle: GM_addStyle,
    GM_log: GM_log,
    GM_openInTab: GM_openInTab,
    GM_setClipboard: GM_setClipboard,
    GM_notification: GM_notification,
    GM_xmlhttpRequest: GM_xmlhttpRequest,
    unsafeWindow: window,
  };
})
`;

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function extractMetaBlock(source: string): string {
  const match = source.match(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/);
  return match ? match[0] : '';
}

export interface WrapOptions {
  script: Script;
}

export function wrapScript({ script }: WrapOptions): string {
  const scriptId = safeJson(script.id);
  const scriptName = safeJson(script.name);
  const metaStr = safeJson(extractMetaBlock(script.content));
  const metadata = safeJson(script.metadata);
  const grants = safeJson(script.metadata.grants || []);
  const sourceUrl = `repo-monkey://script/${encodeURIComponent(script.name)}-${encodeURIComponent(script.id)}.user.js`;

  const body = `
;(function __repoMonkeyScript__() {
  'use strict';
  var __gm__ = (${GM_RUNTIME_SOURCE})(${scriptId}, ${scriptName}, ${metaStr}, ${metadata}, ${grants});
  var GM_info = __gm__.GM_info;
  var GM_setValue = __gm__.GM_setValue;
  var GM_getValue = __gm__.GM_getValue;
  var GM_deleteValue = __gm__.GM_deleteValue;
  var GM_listValues = __gm__.GM_listValues;
  var GM_addStyle = __gm__.GM_addStyle;
  var GM_log = __gm__.GM_log;
  var GM_openInTab = __gm__.GM_openInTab;
  var GM_setClipboard = __gm__.GM_setClipboard;
  var GM_notification = __gm__.GM_notification;
  var GM_xmlhttpRequest = __gm__.GM_xmlhttpRequest;
  var unsafeWindow = __gm__.unsafeWindow;
  var GM = {
    info: GM_info,
    setValue: GM_setValue,
    getValue: GM_getValue,
    deleteValue: GM_deleteValue,
    listValues: GM_listValues,
    xmlHttpRequest: GM_xmlhttpRequest,
    openInTab: GM_openInTab,
    setClipboard: GM_setClipboard,
    notification: GM_notification,
  };
  try {
${script.content}
  } catch (e) {
    console.error('[RepoMonkey] Script ' + ${scriptName} + ' failed:', e);
  }
})();
//# sourceURL=${sourceUrl}
`;
  return body;
}
