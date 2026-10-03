import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import {
  commands,
  ConfigurationTarget,
  services,
  Uri,
  window,
  workspace,
} from 'coc.nvim';
import { selectSchema } from '../src/commands/selectSchema';
import { registerUserSchemas } from '../src/userSchemas';

let directory: string;
let documentUri: string;
let client: any;
let schemaUri: string;

async function statusUntil(check: (status: any) => boolean): Promise<any> {
  const end = Date.now() + 10000;
  let status: any;
  while (Date.now() < end) {
    status = await client.sendRequest('tombi/getStatus', { uri: documentUri });
    if (check(status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Unexpected server status: ${JSON.stringify(status)}`);
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'coc-toml-integration-'));
  const filename = path.join(directory, 'sample.toml');
  await fs.writeFile(filename, 'name="sample"\n');
  const escaped = await workspace.nvim.call('fnameescape', [filename]);
  await workspace.nvim.command(`edit ${escaped}`);
  await workspace.nvim.command('setfiletype toml');
  documentUri = Uri.file(filename).toString();
  client = services.getService('tombi')?.client;
  assert.ok(client, 'extension should register a real Tombi client');
  await client.start();
  await statusUntil((status) => !!status.tomlVersion);
  const schemaFile = path.join(directory, 'schema.json');
  await fs.writeFile(
    schemaFile,
    JSON.stringify({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { name: { type: 'string' } },
    }),
  );
  schemaUri = Uri.file(schemaFile).toString();
});

after(async () => {
  await workspace
    .getConfiguration()
    .update('tombi.schemas', undefined, ConfigurationTarget.Global);
  await workspace
    .getConfiguration()
    .update('tombi.tomlVersion', undefined, ConfigurationTarget.Global);
  await client?.stop();
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test('activates commands and formats a real TOML document', async () => {
  for (const id of [
    'refreshCache',
    'selectSchema',
    'showLanguageServerVersion',
    'restartLanguageServer',
  ]) {
    assert.equal(commands.has(`tombi.${id}`), true);
  }
  const edits = await client.sendRequest('textDocument/formatting', {
    textDocument: { uri: documentUri },
    options: { tabSize: 2, insertSpaces: true },
  });
  assert.ok(edits.length > 0, 'real server should return formatting edits');
  await workspace.applyEdit({ changes: { [documentUri]: edits } });
  assert.match(workspace.getDocument(documentUri).content, /name = "sample"/);
});

test('synchronizes Coc TOML version settings to the real server', async () => {
  await workspace
    .getConfiguration()
    .update('tombi.tomlVersion', 'v1.0.0', ConfigurationTarget.Global);
  await statusUntil((status) => status.tomlVersion === 'v1.0.0');
});

test('associates selected schemas using filesystem paths instead of file URIs', async () => {
  await registerUserSchemas(client, [
    { uri: schemaUri, fileMatch: ['unused.toml'], title: 'Local test schema' },
  ]);
  const original = window.showQuickpick;
  window.showQuickpick = async (items: string[]) =>
    items.indexOf('Local test schema');
  try {
    await selectSchema(client)();
    await statusUntil((status) => status.schema?.uri === schemaUri);
  } finally {
    window.showQuickpick = original;
  }
});

test('replays Coc settings and user schemas after restarting the real server', async () => {
  await workspace.getConfiguration().update(
    'tombi.schemas',
    [
      {
        uri: schemaUri,
        fileMatch: [Uri.parse(documentUri).fsPath],
        title: 'Restart schema',
      },
    ],
    ConfigurationTarget.Global,
  );
  await commands.executeCommand('tombi.restartLanguageServer');
  await statusUntil(
    (status) =>
      status.tomlVersion === 'v1.0.0' && status.schema?.uri === schemaUri,
  );
});

test('does not ask for a schema when the active document is not TOML', async () => {
  await workspace.nvim.command('setfiletype text');
  const original = window.showQuickpick;
  window.showQuickpick = async () => {
    assert.fail('Should reject non-TOML documents before selection');
  };
  try {
    await selectSchema(client)();
  } finally {
    window.showQuickpick = original;
    await workspace.nvim.command('setfiletype toml');
  }
});
