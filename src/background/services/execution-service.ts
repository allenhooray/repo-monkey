import { ScriptManager, ChromeAdapter, UrlMatcher, ScriptExecutor } from '../../runtime';
import { getScripts } from './script-service';
import type { Script } from '../../runtime';
import type { MessageResponse } from '../../shared/types';

const adapter = new ChromeAdapter();
const urlMatcher = new UrlMatcher();
const scriptExecutor = new ScriptExecutor(adapter);

export async function executeScripts(url: string): Promise<Script[]> {
  const scripts = await getScripts();
  return scripts.filter(script => {
    if (!script.enabled) return false;
    const matchPattern = Array.isArray(script.metadata.match)
      ? script.metadata.match
      : [script.metadata.match];
    return matchPattern.some(pattern => urlMatcher.matches(pattern, url));
  });
}

export async function injectScript(script: Script, tabId: number): Promise<MessageResponse> {
  try {
    const tabAdapter = new ChromeAdapter(tabId);
    const executor = new ScriptExecutor(tabAdapter);
    await executor.execute(script);
    return { success: true };
  } catch (error) {
    console.error(`Failed to inject script ${script.name}:`, error);
    return { success: false, error: (error as Error).message };
  }
}
