import { syncScripts } from '../services/sync-service';
import { SYNC_ALARM_NAME } from '../../shared/constants';

export function setupAlarmHandler(): void {
  chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
    if (alarm.name === SYNC_ALARM_NAME) {
      syncScripts();
    }
  });
}
