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

async function openFile(filename: string, languageId = 'toml'): Promise<void> {
  const escaped = await workspace.nvim.call('fnameescape', [filename]);
  await workspace.nvim.command(`edit! ${escaped}`);
  const uri = Uri.file(filename).toString();
  // Wait for Coc to attach before changing filetype. Vim can emit FileType
  // before the asynchronous BufCreate handler has created the document.
  const attachEnd = Date.now() + 5000;
  let attached = await workspace.document;
  while (attached?.uri !== uri && Date.now() < attachEnd) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    attached = await workspace.document;
  }
  assert.equal(attached?.uri, uri, 'Coc should attach the opened file');
  await workspace.nvim.command(`setlocal filetype=${languageId}`);
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    const doc = await workspace.document;
    if (doc.uri === uri && doc.languageId === languageId) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Coc did not attach the ${languageId} document: ${filename}`);
}

async function statusUntil(
  check: (status: any) => boolean,
  uri = documentUri,
): Promise<any> {
  const end = Date.now() + 10000;
  let status: any;
  while (Date.now() < end) {
    status = await client.sendRequest('tombi/getStatus', { uri });
    if (check(status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Unexpected server status: ${JSON.stringify(status)}`);
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'coc-toml-integration-'));
  const filename = path.join(directory, 'sample.toml');
  await fs.writeFile(filename, 'name="sample"\n');
  await openFile(filename);
  documentUri = Uri.file(filename).toString();
  client = services.getService('tombi')?.client;
  assert.ok(client, 'extension should register a real Tombi client');
  await client.onReady();
  await statusUntil((status) => status.tomlVersion === 'v1.1.0');
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
  // Detach fixture buffers while the editor is alive. Configuration changes and
  // server shutdown can finish pending diagnostic pulls that otherwise race
  // the test runner closing Vim's RPC connection.
  const documents = workspace.documents.filter((doc) =>
    Uri.parse(doc.uri).fsPath.startsWith(`${directory}${path.sep}`),
  );
  for (const doc of documents) {
    await workspace.nvim.command(`bwipeout! ${doc.bufnr}`);
  }
  const isOpen = () =>
    documents.some(
      (doc) =>
        workspace.getDocument(doc.uri) ||
        window.visibleTextEditors.some(
          (editor) => editor.document.uri === doc.uri,
        ),
    );
  const closeEnd = Date.now() + 5000;
  while (isOpen() && Date.now() < closeEnd) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(
    !isOpen(),
    'Coc should detach fixture documents before shutting down',
  );
  await workspace
    .getConfiguration()
    .update('tombi.schemas', undefined, ConfigurationTarget.Global);
  await workspace
    .getConfiguration()
    .update('tombi.tomlVersion', undefined, ConfigurationTarget.Global);
  await client?.stop();
  // Round-trip after shutdown so Vim finishes RPCs already queued by a
  // diagnostic refresh before coc-test closes the transport.
  await workspace.nvim.eval('1');
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
  window.showQuickpick = async (items: string[]) => {
    const index = items.indexOf('Local test schema');
    assert.notEqual(index, -1, 'registered schema should be available');
    return index;
  };
  try {
    await selectSchema(client)();
    await statusUntil((status) => status.schema?.uri === schemaUri);
  } finally {
    window.showQuickpick = original;
  }
});

test('keeps the original document when the active buffer changes during schema selection', async () => {
  const otherFile = path.join(directory, 'other.toml');
  await fs.writeFile(otherFile, 'name="other"\n');
  const original = window.showQuickpick;
  const sendNotification = client.sendNotification;
  let association: any;
  client.sendNotification = function (method: string, params: any) {
    if (method === 'tombi/associateSchema') association = params;
    return sendNotification.call(this, method, params);
  };
  window.showQuickpick = async (items: string[]) => {
    await openFile(otherFile);
    assert.equal(
      (await workspace.document).uri,
      Uri.file(otherFile).toString(),
    );
    const index = items.indexOf('Local test schema');
    assert.notEqual(index, -1, 'registered schema should be available');
    return index;
  };
  try {
    await selectSchema(client)();
    assert.equal(association?.fileMatch?.length, 1);
    assert.equal(association.fileMatch[0], Uri.parse(documentUri).fsPath);
    assert.equal(association.uri, schemaUri);
    const otherStatus = await client.sendRequest('tombi/getStatus', {
      uri: Uri.file(otherFile).toString(),
    });
    assert.notEqual(otherStatus.schema?.uri, schemaUri);
  } finally {
    window.showQuickpick = original;
    client.sendNotification = sendNotification;
    await openFile(Uri.parse(documentUri).fsPath);
  }
});

test('replays Coc settings and user schemas after restarting the real server', async () => {
  // Query an unassociated file, so a schema's tomlVersion cannot mask a lost
  // configuration notification. Tombi 1.7.1 defaults to v1.0.0.
  const versionFile = path.join(directory, 'version.toml');
  await fs.writeFile(versionFile, 'name="version"\n');
  const versionUri = Uri.file(versionFile).toString();
  await openFile(versionFile);
  await workspace
    .getConfiguration()
    .update('tombi.tomlVersion', 'v1.1.0', ConfigurationTarget.Global);
  await statusUntil((status) => status.tomlVersion === 'v1.1.0', versionUri);
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
      status.tomlVersion === 'v1.1.0' && status.schema?.uri === schemaUri,
  );
  await statusUntil((status) => status.tomlVersion === 'v1.1.0', versionUri);

  // Preserve the supported Coc 0.0.82 contract: start() returns a Disposable,
  // and notifications sent before onReady() throw instead of waiting.
  const start = client.start;
  const onReady = client.onReady;
  const sendNotification = client.sendNotification;
  let ready = false;
  const earlyNotifications: string[] = [];
  client.start = function () {
    void Promise.resolve(start.call(this)).catch(() => {});
    return { dispose() {} };
  };
  client.onReady = async function () {
    await onReady.call(this);
    ready = true;
  };
  client.sendNotification = function (method: string, params: any) {
    if (!ready && typeof method === 'string') {
      earlyNotifications.push(method);
      throw new Error('Language client is not ready yet');
    }
    return sendNotification.call(this, method, params);
  };
  try {
    await commands.executeCommand('tombi.restartLanguageServer');
    assert.deepEqual(earlyNotifications, []);
    await statusUntil((status) => status.tomlVersion === 'v1.1.0', versionUri);
    await statusUntil((status) => status.schema?.uri === schemaUri);
  } finally {
    client.start = start;
    client.onReady = onReady;
    client.sendNotification = sendNotification;
  }
});

test('does not ask for a schema when the active document is not TOML', async () => {
  const filename = Uri.parse((await workspace.document).uri).fsPath;
  await openFile(filename, 'text');
  const original = window.showQuickpick;
  let prompted = false;
  window.showQuickpick = async () => {
    prompted = true;
    return -1;
  };
  try {
    await selectSchema(client)();
    assert.equal(
      prompted,
      false,
      'Should reject non-TOML documents before selection',
    );
  } finally {
    window.showQuickpick = original;
    await openFile(filename);
  }
});
