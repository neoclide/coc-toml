import { ExtensionContext, workspace, window } from 'coc.nvim';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import {
  getLatestRelease,
  downloadServer,
  getStoredBinaryPath,
} from './downloader';

export interface TombiBin {
  command: string;
  args: string[];
  source: 'settings' | 'stored' | 'path' | 'downloaded';
}

export async function findTombiBinary(
  context: ExtensionContext,
): Promise<TombiBin | null> {
  const config = workspace.getConfiguration('tombi');

  // 1. User-configured path
  const configPath = config.get<string | null>('path', null);
  if (configPath) {
    const resolved = configPath.startsWith('~')
      ? path.join(os.homedir(), configPath.slice(1))
      : configPath;
    if (fs.existsSync(resolved)) {
      return { command: resolved, args: [], source: 'settings' };
    }
    window.showErrorMessage(`tombi binary not found at: ${resolved}`);
    return null;
  }

  // 2. Previously downloaded binary
  const storedPath = getStoredBinaryPath(context.storagePath);
  if (storedPath) {
    return { command: storedPath, args: [], source: 'stored' };
  }

  // 3. System PATH
  try {
    const cmd = process.platform === 'win32' ? 'where tombi' : 'which tombi';
    const result = execSync(cmd, { encoding: 'utf-8' }).trim().split('\n')[0];
    if (result) {
      return { command: result, args: [], source: 'path' };
    }
  } catch {
    // not found in PATH
  }

  // 4. Auto-download
  const choice = await window.showQuickpick(
    ['Download', 'Cancel'],
    'tombi binary not found. Download from GitHub?',
  );
  if (choice !== 0) {
    return null;
  }

  try {
    const release = await getLatestRelease();
    if (!release) return null;

    const binPath = await downloadServer(release, context.storagePath);
    await context.globalState.update('tombi-release', release.tag);
    window.showInformationMessage(`tombi ${release.version} downloaded.`);
    return { command: binPath, args: [], source: 'downloaded' };
  } catch (e) {
    window.showErrorMessage(
      `Failed to download tombi: ${e}. Install manually with \`npm install -g @tombi-toml/cli\` or set \`tombi.path\`.`,
    );
    return null;
  }
}

export async function checkUpdate(context: ExtensionContext): Promise<void> {
  const config = workspace.getConfiguration('tombi');
  if (!config.get<boolean>('updates.checkOnStartup', true)) return;
  if (config.get<string | null>('path', null)) return;

  try {
    const release = await getLatestRelease();
    if (!release) return;

    const stored = context.globalState.get<string>('tombi-release');
    if (stored === release.tag) return;

    const prompt = config.get<boolean>('updates.prompt', true);
    if (prompt) {
      const choice = await window.showQuickpick(
        ['Update', 'Skip'],
        `tombi ${release.version} is available. Update?`,
      );
      if (choice !== 0) return;
    }

    await downloadServer(release, context.storagePath);
    await context.globalState.update('tombi-release', release.tag);
    window.showInformationMessage(
      `tombi updated to ${release.version}. Restart the language server to apply.`,
    );
  } catch (e) {
    // Update check failure is non-fatal
    console.error('tombi update check failed:', e);
  }
}
