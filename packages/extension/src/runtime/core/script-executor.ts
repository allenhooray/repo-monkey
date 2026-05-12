import type { Script } from '../types/script';
import type { RuntimeAdapter, RegisteredUserScriptEntry } from '../types/adapter';
import { wrapScript } from './script-wrapper';

/**
 * 标准化匹配规则
 */
function normalizeMatches(match: string | string[] | undefined): string[] {
  if (!match) return [];
  const list = Array.isArray(match) ? match : [match];
  return list.filter((pattern) => typeof pattern === 'string' && pattern.length > 0);
}

/**
 * 标准化运行时机
 */
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

/**
 * 构建脚本注册条目
 */
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

/**
 * 脚本注册器 - 负责将脚本注册到浏览器运行时
 */
export class ScriptRegistrar {
  private adapter: RuntimeAdapter;

  constructor(adapter: RuntimeAdapter) {
    this.adapter = adapter;
  }

  /**
   * 同步脚本注册
   */
  async sync(scripts: Script[]): Promise<void> {
    const entries = buildRegistrationEntries(scripts);
    await this.adapter.registerScripts(entries);
  }

  /**
   * 清除所有脚本注册
   */
  async clear(): Promise<void> {
    await this.adapter.unregisterAll();
  }
}
