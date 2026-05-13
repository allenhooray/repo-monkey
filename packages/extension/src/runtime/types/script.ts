import type { ScriptMetadata } from './metadata';
import { ScriptSource } from '../../shared/constants';

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
  source: ScriptSource;
  remoteSha?: string;
  remotePath?: string;
  dirty: boolean;
  lastPushedAt?: string;
  orphan?: boolean;
  conflict?: boolean;
}
