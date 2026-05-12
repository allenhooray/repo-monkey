import type { Script } from '../types/script';
import type { ScriptMetadata } from '../types/metadata';
import { MetadataParser } from '../parsers/metadata-parser';
import { UrlMatcher } from '../parsers/url-matcher';
import type { RuntimeAdapter } from '../types/adapter';
import { ScriptSource } from '../../shared/constants';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ScriptManager {
  private scripts: Map<string, Script> = new Map();
  private adapter: RuntimeAdapter;
  private metadataParser: MetadataParser;
  private urlMatcher: UrlMatcher;

  constructor(adapter: RuntimeAdapter) {
    this.adapter = adapter;
    this.metadataParser = new MetadataParser();
    this.urlMatcher = new UrlMatcher();
  }

  addScript(content: string, fileName: string, sha?: string): Script {
    const metadata = this.metadataParser.parse(content);
    const script: Script = {
      id: generateUUID(),
      name: metadata.name || fileName.replace('.js', ''),
      metadata,
      content,
      fileName,
      sha,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: ScriptSource.LOCAL,
      dirty: true,
    };
    this.scripts.set(script.id, script);
    return script;
  }

  addScripts(scripts: Script[]): void {
    scripts.forEach(script => {
      this.scripts.set(script.id, script);
    });
  }

  getScript(id: string): Script | undefined {
    return this.scripts.get(id);
  }

  getAllScripts(): Script[] {
    return Array.from(this.scripts.values());
  }

  getMatchingScripts(url: string): Script[] {
    return this.getAllScripts()
      .filter(script => script.enabled)
      .filter(script => this.urlMatcher.matches(script.metadata.match, url));
  }

  toggleScript(id: string): boolean {
    const script = this.scripts.get(id);
    if (script) {
      script.enabled = !script.enabled;
      return true;
    }
    return false;
  }

  removeScript(id: string): boolean {
    return this.scripts.delete(id);
  }

  clear(): void {
    this.scripts.clear();
  }

  async loadFromStorage(key: string = 'scripts'): Promise<void> {
    const storedScripts = await this.adapter.storage.get(key);
    if (Array.isArray(storedScripts)) {
      this.addScripts(storedScripts);
    }
  }

  async saveToStorage(key: string = 'scripts'): Promise<void> {
    await this.adapter.storage.set(key, this.getAllScripts());
  }

  private generateId(fileName: string): string {
    return `${fileName}-${Date.now()}`;
  }
}
