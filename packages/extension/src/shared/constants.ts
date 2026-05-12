export const SYNC_ALARM_NAME = 'repo-monkey-sync';
export const SYNC_INTERVAL_MINUTES = 30;
export const STORAGE_KEY_SCRIPTS = 'scripts';
export const STORAGE_KEY_SETTINGS = 'settings';
export const STORAGE_KEY_DATA_VERSION = 'dataVersion';
export const CURRENT_DATA_VERSION = 1;

export enum ScriptSource {
  REMOTE = 'remote',
  LOCAL = 'local',
  MODIFIED = 'modified'
}

export const i18nKeys = {
  scriptSourceRemote: 'scriptSourceRemote',
  scriptSourceLocal: 'scriptSourceLocal',
  scriptSourceModified: 'scriptSourceModified',
  scriptDirty: 'scriptDirty',
  scriptOrphan: 'scriptOrphan',
  scriptConflict: 'scriptConflict'
} as const;
