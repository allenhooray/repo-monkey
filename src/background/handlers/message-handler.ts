import { syncScripts } from '../services/sync-service';
import { getScripts, toggleScript, createScript, updateScript, deleteScript, pullScript } from '../services/script-service';
import { getSettings, saveSettings, unbindRepo } from '../services/storage-service';
import { syncRegistrations, clearRegistrations } from '../services/execution-service';
import { handleGMBridgeRequest } from '../services/gm-bridge-service';
import { pushScriptToRepo, deleteFileFromRepo, fetchRemoteContent, fetchBranches } from '../services/github-service';
import type { MessageRequest, MessageResponse, BatchPushResult } from '../../shared/types';
import { ScriptSource, STORAGE_KEY_SCRIPTS } from '../../shared/constants';

const PUSH_MUTEX_KEY = 'pushMutex';

async function acquirePushLock(scriptId: string): Promise<boolean> {
  const result = await chrome.storage.session.get(PUSH_MUTEX_KEY);
  const currentLock = result[PUSH_MUTEX_KEY];
  if (currentLock) {
    return false;
  }
  await chrome.storage.session.set({ [PUSH_MUTEX_KEY]: scriptId });
  return true;
}

async function releasePushLock(): Promise<void> {
  await chrome.storage.session.remove(PUSH_MUTEX_KEY);
}

export function setupMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (request: MessageRequest, _sender, sendResponse: (response: any) => void) => {
      let handled = false;

      switch (request.action) {
        case 'syncScripts':
          syncScripts()
            .then(() => syncRegistrations())
            .then(() => sendResponse({ success: true }))
            .catch((error: Error) =>
              sendResponse({ success: false, error: error.message }),
            );
          handled = true;
          break;
        case 'getScripts':
          getScripts().then(scripts => sendResponse({ scripts }));
          handled = true;
          break;
        case 'toggleScript':
          if (request.scriptId) {
            toggleScript(request.scriptId)
              .then(async (scripts) => {
                await syncRegistrations();
                sendResponse({ scripts });
              })
              .catch((error: Error) =>
                sendResponse({ success: false, error: error.message }),
              );
          }
          handled = true;
          break;
        case 'createScript':
          if (request.script) {
            createScript(request.script)
              .then(async (scripts) => {
                await syncRegistrations();
                sendResponse({ scripts, success: true });
              })
              .catch((error: Error) =>
                sendResponse({ success: false, error: error.message }),
              );
          }
          handled = true;
          break;
        case 'updateScript':
          if (request.script) {
            updateScript(request.script)
              .then(async (scripts) => {
                await syncRegistrations();
                sendResponse({ scripts, success: true });
              })
              .catch((error: Error) =>
                sendResponse({ success: false, error: error.message }),
              );
          }
          handled = true;
          break;
        case 'deleteScript':
          if (request.scriptId) {
            deleteScript(request.scriptId)
              .then(async (scripts) => {
                await syncRegistrations();
                sendResponse({ scripts, success: true });
              })
              .catch((error: Error) =>
                sendResponse({ success: false, error: error.message }),
              );
          }
          handled = true;
          break;
        case 'getSettings':
          getSettings().then(settings => sendResponse({ settings }));
          handled = true;
          break;
        case 'saveSettings':
          if (request.settings) {
            saveSettings(request.settings).then(settings => sendResponse({ settings }));
          }
          handled = true;
          break;
        case 'unbindRepo':
          unbindRepo()
            .then(async (response) => {
              await clearRegistrations();
              sendResponse(response as MessageResponse);
            })
            .catch((error: Error) =>
              sendResponse({ success: false, error: error.message }),
            );
          handled = true;
          break;
        case 'gmBridge':
          if (request.request) {
            handleGMBridgeRequest(request.request).then(sendResponse);
          }
          handled = true;
          break;
        case 'pushScript':
          (async () => {
            if (!request.scriptId) {
              sendResponse({ success: false, error: 'Script ID required' });
              return;
            }

            const lockAcquired = await acquirePushLock(request.scriptId);
            if (!lockAcquired) {
              sendResponse({ success: false, error: 'Push already in progress' });
              return;
            }

            try {
              const [settings, scripts] = await Promise.all([
                getSettings(),
                getScripts(),
              ]);

              const script = scripts.find(s => s.id === request.scriptId);
              if (!script) {
                sendResponse({ success: false, error: 'Script not found' });
                return;
              }

              const commitMessage = request.commitMessage || (
                script.source === ScriptSource.LOCAL
                  ? `Add ${script.fileName}`
                  : `Update ${script.fileName}`
              );

              const result = await pushScriptToRepo(
                settings,
                script,
                commitMessage,
                request.forceOverwrite || false
              );

              if (result.success && result.sha) {
                const updatedScripts = scripts.map(s => {
                  if (s.id === script.id) {
                    return {
                      ...s,
                      remoteSha: result.sha,
                      remotePath: result.remotePath || s.remotePath || s.fileName,
                      source: ScriptSource.REMOTE,
                      dirty: false,
                      lastPushedAt: new Date().toISOString(),
                    };
                  }
                  return s;
                });

                await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: updatedScripts });
                await syncRegistrations();

                sendResponse({
                  success: true,
                  scripts: updatedScripts,
                });
              } else {
                sendResponse({
                  success: false,
                  error: result.error?.message || 'Push failed',
                  errorCode: result.error?.code,
                });
              }
            } catch (error) {
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Push failed',
              });
            } finally {
              await releasePushLock();
            }
          })();
          handled = true;
          break;

        case 'deleteFromRepo':
          (async () => {
            if (!request.scriptId) {
              sendResponse({ success: false, error: 'Script ID required' });
              return;
            }

            try {
              const [settings, scripts] = await Promise.all([
                getSettings(),
                getScripts(),
              ]);

              const script = scripts.find(s => s.id === request.scriptId);
              if (!script || !script.remotePath || !script.remoteSha) {
                sendResponse({ success: false, error: 'Script not eligible for deletion from repo' });
                return;
              }

              const commitMessage = request.commitMessage || `Delete ${script.fileName}`;
              const deleteResult = await deleteFileFromRepo(
                settings,
                script.remotePath,
                script.remoteSha,
                commitMessage
              );

              if (deleteResult.success) {
                const updatedScripts = await deleteScript(script.id);
                await syncRegistrations();

                sendResponse({
                  success: true,
                  scripts: updatedScripts,
                });
              } else {
                sendResponse({
                  success: false,
                  error: deleteResult.error?.message || 'Delete failed',
                  errorCode: deleteResult.error?.code,
                });
              }
            } catch (error) {
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Delete failed',
              });
            }
          })();
          handled = true;
          break;

        case 'batchPush':
          (async () => {
            const lockAcquired = await acquirePushLock('batch');
            if (!lockAcquired) {
              sendResponse({ success: false, error: 'Push already in progress' });
              return;
            }

            try {
              const [settings, scripts] = await Promise.all([
                getSettings(),
                getScripts(),
              ]);

              const dirtyScripts = scripts.filter(s => 
                s.source === ScriptSource.LOCAL || s.source === ScriptSource.MODIFIED || s.dirty
              );

              const results: BatchPushResult = {
                success: 0,
                failed: 0,
                conflict: 0,
                results: [],
              };

              let currentScripts = [...scripts];

              for (const script of dirtyScripts) {
                try {
                  const commitMessage = request.commitMessage || (
                    script.source === ScriptSource.LOCAL
                      ? `Add ${script.fileName}`
                      : `Update ${script.fileName}`
                  );

                  const result = await pushScriptToRepo(
                    settings,
                    script,
                    commitMessage,
                    request.forceOverwrite || false
                  );

                  if (result.success && result.sha) {
                    currentScripts = currentScripts.map(s => {
                      if (s.id === script.id) {
                        return {
                          ...s,
                          remoteSha: result.sha,
                          remotePath: result.remotePath || s.remotePath || s.fileName,
                          source: ScriptSource.REMOTE,
                          dirty: false,
                          lastPushedAt: new Date().toISOString(),
                        };
                      }
                      return s;
                    });
                    results.success++;
                    results.results.push({
                      scriptId: script.id,
                      fileName: script.fileName,
                      success: true,
                    });
                  } else {
                    if (result.error?.code === 'CONFLICT') {
                      results.conflict++;
                    } else {
                      results.failed++;
                    }
                    results.results.push({
                      scriptId: script.id,
                      fileName: script.fileName,
                      success: false,
                      errorCode: result.error?.code,
                      error: result.error?.message,
                    });
                  }
                } catch (error) {
                  results.failed++;
                  results.results.push({
                    scriptId: script.id,
                    fileName: script.fileName,
                    success: false,
                    error: error instanceof Error ? error.message : 'Push failed',
                  });
                }
              }

              await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: currentScripts });
              await syncRegistrations();

              sendResponse({
                success: true,
                scripts: currentScripts,
                batchResult: results,
              });
            } catch (error) {
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Batch push failed',
              });
            } finally {
              await releasePushLock();
            }
          })();
          handled = true;
          break;

        case 'pullScript':
          (async () => {
            if (!request.scriptId) {
              sendResponse({ success: false, error: 'Script ID required' });
              return;
            }

            try {
              const [settings, scripts] = await Promise.all([
                getSettings(),
                getScripts(),
              ]);

              const script = scripts.find(s => s.id === request.scriptId);
              if (!script || !script.remotePath) {
                sendResponse({ success: false, error: 'Script not eligible for pull' });
                return;
              }

              const contentResult = await fetchRemoteContent(settings, script.remotePath);

              if (contentResult.success && contentResult.content && contentResult.sha) {
                const updatedScripts = await pullScript(script.id, contentResult.content, contentResult.sha);
                await syncRegistrations();

                sendResponse({
                  success: true,
                  scripts: updatedScripts,
                });
              } else {
                sendResponse({
                  success: false,
                  error: contentResult.error?.message || 'Pull failed',
                  errorCode: contentResult.error?.code,
                });
              }
            } catch (error) {
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Pull failed',
              });
            }
          })();
          handled = true;
          break;

        case 'getRemoteContent':
          (async () => {
            if (!request.scriptId) {
              sendResponse({ success: false, error: 'Script ID required' });
              return;
            }

            try {
              const [settings, scripts] = await Promise.all([
                getSettings(),
                getScripts(),
              ]);

              const script = scripts.find(s => s.id === request.scriptId);
              if (!script || !script.remotePath) {
                sendResponse({ success: false, error: 'Script not eligible' });
                return;
              }

              const contentResult = await fetchRemoteContent(settings, script.remotePath);

              sendResponse(contentResult);
            } catch (error) {
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch remote content',
              });
            }
          })();
          handled = true;
          break;

        case 'getBranches':
          (async () => {
            try {
              const settings = await getSettings();
              const branchesResult = await fetchBranches(settings);
              sendResponse(branchesResult);
            } catch (error) {
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch branches',
              });
            }
          })();
          handled = true;
          break;
      }

      return handled;
    }
  );
}
