import { setupAlarmHandler } from './handlers/alarm-handler';
import { setupMessageHandler } from './handlers/message-handler';
import { SYNC_ALARM_NAME, SYNC_INTERVAL_MINUTES } from '../shared/constants';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  console.log('RepoMonkey installed');
});

setupAlarmHandler();
setupMessageHandler();
