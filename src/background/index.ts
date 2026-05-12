import { setupAlarmHandler } from './handlers/alarm-handler';
import { setupMessageHandler } from './handlers/message-handler';
import { syncRegistrations } from './services/execution-service';
import { migrateScriptsIfNeeded } from './services/script-service';
import { SYNC_ALARM_NAME, SYNC_INTERVAL_MINUTES } from '../shared/constants';

/**
 * 初始化扩展
 * 执行数据迁移和脚本注册同步
 */
async function initialize(): Promise<void> {
  try {
    await migrateScriptsIfNeeded();
    await syncRegistrations();
  } catch (error) {
    console.warn('[RepoMonkey] initialization failed:', error);
  }
}

// 扩展安装时触发
chrome.runtime.onInstalled.addListener(async () => {
  // 创建定时同步任务
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  console.log('RepoMonkey installed');
  await initialize();
});

// 浏览器启动时触发
chrome.runtime.onStartup.addListener(initialize);

// 设置各种处理器
setupAlarmHandler();
setupMessageHandler();

// 初始化
initialize();
