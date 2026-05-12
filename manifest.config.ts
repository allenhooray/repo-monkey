import { defineManifest } from '@crxjs/vite-plugin';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  version: pkg.version,
  description: '__MSG_extDescription__',
  default_locale: 'en',
  permissions: [
    'storage',
    'tabs',
    'activeTab',
    'scripting',
    'alarms',
    'notifications',
  ],
  host_permissions: [
    'https://github.com/*',
    'https://api.github.com/*',
    '<all_urls>',
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
    },
  ],
  action: {
    default_popup: 'src/popup/popup.html',
  },
  options_page: 'src/options/options.html',
});
