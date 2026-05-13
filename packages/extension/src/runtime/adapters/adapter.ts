import type { RuntimeAdapter, Platform } from '../types/adapter';
import { ChromeAdapter } from './chrome-adapter';

export function createAdapter(platform: Platform): RuntimeAdapter {
  switch (platform) {
    case 'chrome':
      return new ChromeAdapter();
    case 'firefox':
      throw new Error('Firefox adapter not implemented yet');
    case 'web':
      throw new Error('Web adapter not implemented yet');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export type { RuntimeAdapter };
