export class UrlMatcher {
  matches(pattern: string | string[], url: string): boolean {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    return patterns.some(p => this.matchSingle(p, url));
  }

  private matchSingle(pattern: string, url: string): boolean {
    if (pattern === '<all_urls>' || pattern === '*://*/*') {
      return true;
    }

    const patternRegex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${patternRegex}$`).test(url);
  }
}
