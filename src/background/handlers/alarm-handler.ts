import { syncScripts } from '../services/sync-service';
import { syncRegistrations } from '../services/execution-service';
import { SYNC_ALARM_NAME } from '../../shared/constants';

export function setupAlarmHandler(): void {
  chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === SYNC_ALARM_NAME) {
      try {
        await syncScripts();
        await syncRegistrations();
      } catch (error) {
        console.warn('[RepoMonkey] alarm sync failed:', error);
      }
    }
  });
}
