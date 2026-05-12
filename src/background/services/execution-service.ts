import { ChromeAdapter, ScriptRegistrar } from '../../runtime';
import { getScripts } from './script-service';

const adapter = new ChromeAdapter();
const registrar = new ScriptRegistrar(adapter);

export async function syncRegistrations(): Promise<void> {
  const scripts = await getScripts();
  await registrar.sync(scripts);
}

export async function clearRegistrations(): Promise<void> {
  await registrar.clear();
}

export function getAdapter(): ChromeAdapter {
  return adapter;
}
