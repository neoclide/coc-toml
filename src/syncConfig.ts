import { LanguageClient, workspace, Disposable } from 'coc.nvim';
import config from './config';

const DID_CHANGE_CONFIGURATION = 'workspace/didChangeConfiguration';

function buildTombiSettings(): Record<string, unknown> {
  return {
    tombi: {
      'toml-version': config.tomlVersion,
    },
  };
}

export async function pushSettings(client: LanguageClient): Promise<void> {
  try {
    await client.sendNotification(DID_CHANGE_CONFIGURATION, {
      settings: buildTombiSettings(),
    });
  } catch (e) {
    console.error('tombi config sync failed:', e);
  }
}

export async function syncConfigToServer(
  client: LanguageClient,
): Promise<Disposable> {
  await client.onReady();
  await pushSettings(client);

  return workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('tombi.tomlVersion')) {
      pushSettings(client);
    }
  });
}
