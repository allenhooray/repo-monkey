import type { Script } from '../types/script';
import type { RuntimeAdapter, RegisteredUserScriptEntry } from '../types/adapter';
import { wrapScript } from './script-wrapper';

function normalizeMatches(match: string | string[] | undefined): string[] {
  if (!match) return [];
  const list = Array.isArray(match) ? match : [match];
  return list.filter((pattern) => typeof pattern === 'string' && pattern.length > 0);
}

function normalizeRunAt(runAt: Script['metadata']['runAt']): RegisteredUserScriptEntry['runAt'] {
  switch (runAt) {
    case 'document-start':
      return 'document_start';
    case 'document-end':
      return 'document_end';
    case 'document-body':
    case 'document-idle':
    default:
      return 'document_idle';
  }
}

export function buildRegistrationEntries(scripts: Script[]): RegisteredUserScriptEntry[] {
  const entries: RegisteredUserScriptEntry[] = [];
  for (const script of scripts) {
    if (!script.enabled) continue;
    const matches = normalizeMatches(script.metadata.match);
    if (matches.length === 0) continue;
    entries.push({
      scriptId: script.id,
      matches,
      code: wrapScript({ script }),
      runAt: normalizeRunAt(script.metadata.runAt),
    });
  }
  return entries;
}

export class ScriptRegistrar {
  private adapter: RuntimeAdapter;

  constructor(adapter: RuntimeAdapter) {
    this.adapter = adapter;
  }

  async sync(scripts: Script[]): Promise<void> {
    const entries = buildRegistrationEntries(scripts);
    await this.adapter.registerScripts(entries);
  }

  async clear(): Promise<void> {
    await this.adapter.unregisterAll();
  }
}
