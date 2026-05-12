import type { Script } from '../types/script';
import type { RuntimeAdapter } from '../types/adapter';
import { wrapScript } from './script-wrapper';

export class ScriptExecutor {
  private adapter: RuntimeAdapter;

  constructor(adapter: RuntimeAdapter) {
    this.adapter = adapter;
  }

  async execute(script: Script): Promise<void> {
    try {
      const wrapped = wrapScript({ script });
      await this.adapter.injectScript(wrapped, script.name);
    } catch (error) {
      console.error(`[ScriptExecutor] Failed to execute ${script.name}:`, error);
      throw error;
    }
  }

  async executeMany(scripts: Script[]): Promise<void> {
    for (const script of scripts) {
      await this.execute(script);
    }
  }
}
