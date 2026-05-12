import type { ScriptMetadata } from './metadata';

export interface Script {
  id: string;
  name: string;
  metadata: ScriptMetadata;
  content: string;
  fileName: string;
  sha?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
}
