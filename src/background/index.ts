import { setupAlarmHandler } from './handlers/alarm-handler';
import { setupMessageHandler } from './handlers/message-handler';
import { syncRegistrations } from './services/execution-service';
import { migrateScriptsIfNeeded } from './services/script-service';
import { SYNC_ALARM_NAME, SYNC_INTERVAL_MINUTES } from '../shared/constants';

async function initialize(): Promise<void> {
  try {
    await migrateScriptsIfNeeded();
    await syncRegistrations();
  } catch (error) {
    console.warn('[RepoMonkey] initialization failed:', error);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  console.log('RepoMonkey installed');
  await initialize();
});

chrome.runtime.onStartup.addListener(initialize);

setupAlarmHandler();
setupMessageHandler();

initialize();
