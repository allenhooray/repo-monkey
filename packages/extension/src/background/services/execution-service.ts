import { ChromeAdapter, ScriptRegistrar } from '../../runtime';
import { getScripts } from './script-service';

// 创建 Chrome 适配器实例
const adapter = new ChromeAdapter();
const registrar = new ScriptRegistrar(adapter);

/**
 * 同步脚本注册
 */
export async function syncRegistrations(): Promise<void> {
  const scripts = await getScripts();
  await registrar.sync(scripts);
}

/**
 * 清除所有脚本注册
 */
export async function clearRegistrations(): Promise<void> {
  await registrar.clear();
}

/**
 * 获取适配器实例
 * @returns ChromeAdapter 实例
 */
export function getAdapter(): ChromeAdapter {
  return adapter;
}
