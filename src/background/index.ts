import { setupAlarmHandler } from './handlers/alarm-handler';
import { setupMessageHandler } from './handlers/message-handler';
import { syncRegistrations } from './services/execution-service';
import { SYNC_ALARM_NAME, SYNC_INTERVAL_MINUTES } from '../shared/constants';

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  console.log('RepoMonkey installed');
  try {
    await syncRegistrations();
  } catch (error) {
    console.warn('[RepoMonkey] initial registration on install failed:', error);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    await syncRegistrations();
  } catch (error) {
    console.warn('[RepoMonkey] initial registration on startup failed:', error);
  }
});

setupAlarmHandler();
setupMessageHandler();

(async () => {
  try {
    await syncRegistrations();
  } catch (error) {
    console.warn('[RepoMonkey] background bootstrap registration failed:', error);
  }
})();
