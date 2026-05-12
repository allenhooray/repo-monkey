import type { ScriptMetadata } from '../types/metadata';

export class MetadataParser {
  parse(content: string): ScriptMetadata {
    const metadata: ScriptMetadata = {
      name: '',
      match: '*://*/*',
      description: '',
      version: '',
      author: '',
      grants: [],
      requires: [],
    };

    // 解析 @name
    const nameMatch = content.match(/@name\s+(.+)/);
    if (nameMatch) {
      metadata.name = nameMatch[1].trim();
    }

    // 解析 @match（支持多个）
    const matchMatches = content.match(/@match\s+(.+)/g);
    if (matchMatches && matchMatches.length > 0) {
      const matches = matchMatches.map(m => m.replace(/@match\s+/, '').trim());
      metadata.match = matches.length === 1 ? matches[0] : matches;
    }

    // 解析 @description
    const descMatch = content.match(/@description\s+(.+)/);
    if (descMatch) {
      metadata.description = descMatch[1].trim();
    }

    // 解析 @version
    const versionMatch = content.match(/@version\s+(.+)/);
    if (versionMatch) {
      metadata.version = versionMatch[1].trim();
    }

    // 解析 @author
    const authorMatch = content.match(/@author\s+(.+)/);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim();
    }

    // 解析 @grant
    const grantMatches = content.match(/@grant\s+(.+)/g);
    if (grantMatches) {
      metadata.grants = grantMatches.map(m => m.replace(/@grant\s+/, '').trim());
    }

    // 解析 @require
    const requireMatches = content.match(/@require\s+(.+)/g);
    if (requireMatches) {
      metadata.requires = requireMatches.map(m => m.replace(/@require\s+/, '').trim());
    }

    // 解析 @namespace
    const namespaceMatch = content.match(/@namespace\s+(.+)/);
    if (namespaceMatch) {
      metadata.namespace = namespaceMatch[1].trim();
    }

    // 解析 @icon
    const iconMatch = content.match(/@icon\s+(.+)/);
    if (iconMatch) {
      metadata.icon = iconMatch[1].trim();
    }

    // 解析 @run-at
  const runAtMatch = content.match(/@run-at\s+(.+)/);
  if (runAtMatch && runAtMatch[1]) {
    const runAtValue = runAtMatch[1].trim();
    if (['document-start', 'document-body', 'document-end', 'document-idle'].includes(runAtValue as any)) {
      metadata.runAt = runAtValue as any;
    }
  }

    return metadata;
  }
}
