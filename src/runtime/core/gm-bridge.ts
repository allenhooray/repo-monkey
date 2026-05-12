import type { GMBridgeRequest, GMBridgeResponse } from '../types/gm';

export const GM_BRIDGE_CHANNEL = 'gm-bridge';
export const GM_BRIDGE_MESSAGE_ACTION = 'gmBridge';

/**
 * 检查是否为 GM Bridge 请求
 */
export function isBridgeRequest(data: unknown): data is GMBridgeRequest {
  if (!data || typeof data !== 'object') return false;
  const d = data as any;
  return d.channel === GM_BRIDGE_CHANNEL && d.direction === 'request' && typeof d.id === 'string' && typeof d.type === 'string';
}

/**
 * 检查是否为 GM Bridge 响应
 */
export function isBridgeResponse(data: unknown): data is GMBridgeResponse {
  if (!data || typeof data !== 'object') return false;
  const d = data as any;
  return d.channel === GM_BRIDGE_CHANNEL && d.direction === 'response' && typeof d.id === 'string';
}

/**
 * 构建 GM Bridge 响应
 */
export function buildResponse(id: string, ok: boolean, result?: any, error?: string): GMBridgeResponse {
  return {
    channel: GM_BRIDGE_CHANNEL,
    direction: 'response',
    id,
    ok,
    result,
    error,
  };
}
