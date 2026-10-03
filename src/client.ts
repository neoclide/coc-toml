import {
  ExtensionContext,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  window,
  workspace,
} from 'coc.nvim';
import { TombiBin } from './bootstrap';
import config from './config';

export function createClient(
  tombiBin: TombiBin,
  context: ExtensionContext,
): LanguageClient {
  const args = [...tombiBin.args, 'lsp', ...config.args];

  const serverOpts: ServerOptions = {
    command: tombiBin.command,
    args,
    options: {
      env: {
        ...process.env,
        NO_COLOR: '1',
        ...config.env,
      },
    },
  };

  const outputChannel = window.createOutputChannel('Tombi Language Server');

  const watchers = [
    'tombi.toml',
    '.tombi.toml',
    'pyproject.toml',
    'tombi/config.toml',
  ].map((filename) => workspace.createFileSystemWatcher(`**/${filename}`));
  context.subscriptions.push(outputChannel, ...watchers);

  const clientOpts: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'toml' },
      { scheme: 'file', language: 'cargoLock' },
      { scheme: 'untitled', language: 'toml' },
      { scheme: 'untitled', language: 'cargoLock' },
    ],
    synchronize: {
      fileEvents: watchers,
    },
    outputChannel,
  };

  return new LanguageClient(
    'tombi',
    'Tombi Language Server',
    serverOpts,
    clientOpts,
  );
}
