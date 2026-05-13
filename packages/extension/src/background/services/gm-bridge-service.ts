import type {
  GMBridgeRequest,
  GMBridgeResponse,
  GMNotificationDetails,
  GMXHRDetails,
} from '../../runtime/types/gm';
import { buildResponse, GM_BRIDGE_CHANNEL } from '../../runtime/core/gm-bridge';

// GM 存储键前缀
const GM_VALUE_PREFIX = 'gm:value:';

/**
 * 构建脚本存储键
 * @param scriptId - 脚本 ID
 * @returns 存储键
 */
function valueKey(scriptId: string): string {
  return `${GM_VALUE_PREFIX}${scriptId}`;
}

/**
 * 读取脚本的值存储
 * @param scriptId - 脚本 ID
 * @returns 键值对对象
 */
async function readValueBag(scriptId: string): Promise<Record<string, unknown>> {
  const key = valueKey(scriptId);
  const result = await chrome.storage.local.get(key);
  const bag = result[key];
  return bag && typeof bag === 'object' ? (bag as Record<string, unknown>) : {};
}

/**
 * 写入脚本的值存储
 * @param scriptId - 脚本 ID
 * @param bag - 键值对对象
 */
async function writeValueBag(scriptId: string, bag: Record<string, unknown>): Promise<void> {
  const key = valueKey(scriptId);
  await chrome.storage.local.set({ [key]: bag });
}

/**
 * GM_getValue - 获取存储值
 * @param scriptId - 脚本 ID
 * @param key - 键
 * @returns 值
 */
async function gmGetValue(scriptId: string, key: string): Promise<unknown> {
  const bag = await readValueBag(scriptId);
  return bag[key];
}

/**
 * GM_setValue - 设置存储值
 * @param scriptId - 脚本 ID
 * @param key - 键
 * @param value - 值
 */
async function gmSetValue(scriptId: string, key: string, value: unknown): Promise<void> {
  const bag = await readValueBag(scriptId);
  bag[key] = value;
  await writeValueBag(scriptId, bag);
}

/**
 * GM_deleteValue - 删除存储值
 * @param scriptId - 脚本 ID
 * @param key - 键
 */
async function gmDeleteValue(scriptId: string, key: string): Promise<void> {
  const bag = await readValueBag(scriptId);
  delete bag[key];
  await writeValueBag(scriptId, bag);
}

/**
 * GM_listValues - 列出所有存储键
 * @param scriptId - 脚本 ID
 * @returns 键数组
 */
async function gmListValues(scriptId: string): Promise<string[]> {
  const bag = await readValueBag(scriptId);
  return Object.keys(bag);
}

/**
 * 将 Headers 转换为字符串
 * @param headers - Headers 对象
 * @returns 格式化的字符串
 */
function headersToString(headers: Headers): string {
  const lines: string[] = [];
  headers.forEach((value, key) => {
    lines.push(`${key}: ${value}`);
  });
  return lines.join('\r\n');
}

/**
 * GM_xmlhttpRequest - 网络请求
 * @param payload - 请求参数
 * @returns 响应结果
 */
async function gmXmlhttpRequest(payload: GMXHRDetails): Promise<unknown> {
  const controller = new AbortController();
  // 设置超时
  const timeoutId = payload.timeout
    ? setTimeout(() => controller.abort(), payload.timeout)
    : null;

  try {
    const init: RequestInit = {
      method: payload.method || 'GET',
      headers: payload.headers,
      body: payload.data,
      signal: controller.signal,
      credentials: 'include',
    };
    const res = await fetch(payload.url, init);
    let response: any;
    let responseText: string | undefined;

    // 根据响应类型解析结果
    switch (payload.responseType) {
      case 'json':
        response = await res.json();
        break;
      case 'arraybuffer': {
        const buf = await res.arrayBuffer();
        response = Array.from(new Uint8Array(buf));
        break;
      }
      case 'blob': {
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        response = { type: blob.type, data: Array.from(new Uint8Array(buf)) };
        break;
      }
      default:
        responseText = await res.text();
        response = responseText;
    }

    return {
      status: res.status,
      statusText: res.statusText,
      responseHeaders: headersToString(res.headers),
      response,
      responseText,
      finalUrl: res.url,
    };
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError';
    return {
      status: 0,
      statusText: (err as Error).message,
      responseHeaders: '',
      response: null,
      finalUrl: payload.url,
      error: !aborted,
      timedOut: aborted && !!payload.timeout,
    };
  } finally {
    // 清除超时定时器
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * GM_openInTab - 打开新标签页
 * @param url - URL
 * @param options - 选项
 * @returns 标签页 ID
 */
async function gmOpenInTab(url: string, options: { active?: boolean }): Promise<{ tabId?: number }> {
  const tab = await chrome.tabs.create({ url, active: options?.active !== false });
  return { tabId: tab.id };
}

/**
 * GM_setClipboard - 设置剪贴板（兼容性占位）
 * @param _text - 文本
 */
async function gmSetClipboard(_text: string): Promise<void> {
  // Clipboard writes are performed directly in the user script world now.
  // This handler is kept only as a no-op fallback for compatibility.
}

/**
 * GM_notification - 显示通知
 * @param details - 通知详情
 * @returns 用户是否点击通知
 */
async function gmNotification(details: GMNotificationDetails): Promise<{ clicked: boolean }> {
  if (!chrome.notifications) {
    console.warn('[RepoMonkey] notifications permission not granted');
    return { clicked: false };
  }
  return new Promise((resolve) => {
    chrome.notifications.create(
      {
        type: 'basic',
        iconUrl: details.image || chrome.runtime.getURL('icon.png'),
        title: details.title || 'RepoMonkey',
        message: details.text || '',
      },
      (id) => {
        // 监听通知点击
        const onClicked = (clickedId: string) => {
          if (clickedId !== id) return;
          chrome.notifications.onClicked.removeListener(onClicked);
          chrome.notifications.clear(id);
          resolve({ clicked: true });
        };
        chrome.notifications.onClicked.addListener(onClicked);
        // 15 秒后超时
        setTimeout(() => {
          chrome.notifications.onClicked.removeListener(onClicked);
          resolve({ clicked: false });
        }, 15000);
      }
    );
  });
}

/**
 * 处理 GM 桥接请求
 * @param request - 请求对象
 * @returns 响应对象
 */
export async function handleGMBridgeRequest(request: GMBridgeRequest): Promise<GMBridgeResponse> {
  if (!request || request.channel !== GM_BRIDGE_CHANNEL) {
    return buildResponse(request?.id || 'unknown', false, undefined, 'invalid request');
  }

  try {
    const { type, payload, scriptId, id } = request;
    switch (type) {
      case 'GM_getValue': {
        const v = await gmGetValue(payload.scriptId || scriptId, payload.key);
        return buildResponse(id, true, v);
      }
      case 'GM_setValue': {
        await gmSetValue(payload.scriptId || scriptId, payload.key, payload.value);
        return buildResponse(id, true);
      }
      case 'GM_deleteValue': {
        await gmDeleteValue(payload.scriptId || scriptId, payload.key);
        return buildResponse(id, true);
      }
      case 'GM_listValues': {
        const keys = await gmListValues(payload.scriptId || scriptId);
        return buildResponse(id, true, keys);
      }
      case 'GM_xmlhttpRequest': {
        const result = await gmXmlhttpRequest(payload);
        return buildResponse(id, true, result);
      }
      case 'GM_openInTab': {
        const result = await gmOpenInTab(payload.url, payload.options || {});
        return buildResponse(id, true, result);
      }
      case 'GM_setClipboard': {
        await gmSetClipboard(payload.text);
        return buildResponse(id, true);
      }
      case 'GM_notification': {
        const result = await gmNotification(payload);
        return buildResponse(id, true, result);
      }
      default:
        return buildResponse(id, false, undefined, `unsupported GM type: ${type}`);
    }
  } catch (error) {
    return buildResponse(request.id, false, undefined, (error as Error).message);
  }
}
