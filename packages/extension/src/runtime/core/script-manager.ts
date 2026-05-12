import type { Script } from '../types/script';
import type { ScriptMetadata } from '../types/metadata';
import { MetadataParser } from '../parsers/metadata-parser';
import { UrlMatcher } from '../parsers/url-matcher';
import type { RuntimeAdapter } from '../types/adapter';
import { ScriptSource } from '../../shared/constants';
import { generateUUID } from '../../shared/utils/uuid';

/**
 * 脚本管理器 - 管理所有用户脚本的生命周期
 */
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

  /**
   * 添加单个脚本
   */
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

  /**
   * 批量添加脚本
   */
  addScripts(scripts: Script[]): void {
    scripts.forEach(script => {
      this.scripts.set(script.id, script);
    });
  }

  /**
   * 根据 ID 获取脚本
   */
  getScript(id: string): Script | undefined {
    return this.scripts.get(id);
  }

  /**
   * 获取所有脚本
   */
  getAllScripts(): Script[] {
    return Array.from(this.scripts.values());
  }

  /**
   * 获取匹配指定 URL 的启用脚本
   */
  getMatchingScripts(url: string): Script[] {
    return this.getAllScripts()
      .filter(script => script.enabled)
      .filter(script => this.urlMatcher.matches(script.metadata.match, url));
  }

  /**
   * 切换脚本启用状态
   */
  toggleScript(id: string): boolean {
    const script = this.scripts.get(id);
    if (script) {
      script.enabled = !script.enabled;
      return true;
    }
    return false;
  }

  /**
   * 移除脚本
   */
  removeScript(id: string): boolean {
    return this.scripts.delete(id);
  }

  /**
   * 清空所有脚本
   */
  clear(): void {
    this.scripts.clear();
  }

  /**
   * 从存储加载脚本
   */
  async loadFromStorage(key: string = 'scripts'): Promise<void> {
    const storedScripts = await this.adapter.storage.get(key);
    if (Array.isArray(storedScripts)) {
      this.addScripts(storedScripts);
    }
  }

  /**
   * 保存脚本到存储
   */
  async saveToStorage(key: string = 'scripts'): Promise<void> {
    await this.adapter.storage.set(key, this.getAllScripts());
  }
}
