import type { Script } from '../types/script';
import type { RuntimeAdapter } from '../types/adapter';

export class ScriptExecutor {
  private adapter: RuntimeAdapter;

  constructor(adapter: RuntimeAdapter) {
    this.adapter = adapter;
  }

  async execute(script: Script): Promise<void> {
    try {
      await this.adapter.injectScript(script.content, script.name);
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
