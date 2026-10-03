import { ExtensionContext, services, window, commands } from 'coc.nvim';

import config from './config';
import { findTombiBinary, checkUpdate } from './bootstrap';
import { createClient } from './client';
import { registerCommand } from './commands';
import { refreshCache } from './commands/cache';
import { showVersion } from './commands/version';
import { selectSchema } from './commands/selectSchema';
import { registerUserSchemas } from './userSchemas';
import { syncConfigToServer, pushSettings } from './syncConfig';

export async function activate(context: ExtensionContext): Promise<void> {
  if (!config.enabled) {
    window.showWarningMessage('tombi is disabled (tombi.enabled is false)');
    return;
  }

  const tombiBin = await findTombiBinary(context);
  if (!tombiBin) {
    return;
  }

  const client = createClient(tombiBin, context);
  context.subscriptions.push(services.registLanguageClient(client));

  registerCommand(context, client, 'refreshCache', refreshCache);
  registerCommand(context, client, 'selectSchema', selectSchema);

  context.subscriptions.push(
    commands.registerCommand(
      'tombi.showLanguageServerVersion',
      showVersion(tombiBin),
    ),
  );
  context.subscriptions.push(
    commands.registerCommand('tombi.restartLanguageServer', async () => {
      await client.stop();
      await client.start();
      await pushSettings(client);
      await registerUserSchemas(client, config.schemas);
      window.showInformationMessage('Tombi Language Server restarted.');
    }),
  );

  // Push tombi.tomlVersion to the server and keep it in sync (non-blocking)
  syncConfigToServer(client)
    .then((disposable) => context.subscriptions.push(disposable))
    .catch((e) => {
      window.showWarningMessage(`tombi config sync failed: ${e}`);
    });

  // Register user-defined schemas from tombi.schemas (non-blocking)
  registerUserSchemas(client, config.schemas).catch((e) => {
    window.showWarningMessage(`tombi.schemas registration failed: ${e}`);
  });

  // Background update check (non-blocking)
  if (tombiBin.source === 'stored') {
    checkUpdate(context);
  }
}
