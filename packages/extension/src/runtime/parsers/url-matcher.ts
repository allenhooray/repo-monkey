/**
 * URL 匹配器 - 匹配脚本与 URL
 */
export class UrlMatcher {
  /**
   * 检查 URL 是否匹配任一模式
   */
  matches(pattern: string | string[], url: string): boolean {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    return patterns.some(p => this.matchSingle(p, url));
  }

  /**
   * 检查 URL 是否匹配单个模式
   */
  private matchSingle(pattern: string, url: string): boolean {
    if (pattern === '<all_urls>' || pattern === '*://*/*') {
      return true;
    }

    // 将通配符模式转换为正则表达式
    const patternRegex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${patternRegex}$`).test(url);
  }
}
