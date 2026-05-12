export interface ScriptMetadata {
  name: string;
  match: string | string[];
  description?: string;
  version?: string;
  author?: string;
  grants?: string[];
  requires?: string[];
  namespace?: string;
  icon?: string;
  homepageURL?: string;
  supportURL?: string;
  updateURL?: string;
  downloadURL?: string;
  license?: string;
  noframes?: boolean;
  unwrap?: boolean;
  runAt?: 'document-start' | 'document-body' | 'document-end' | 'document-idle';
}
