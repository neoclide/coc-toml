import { LanguageClient, window, workspace, Uri } from 'coc.nvim';
import { Methods } from '../requestExt';

export function selectSchema(client: LanguageClient): any {
  return async () => {
    try {
      const doc = await workspace.document;
      if (
        !['toml', 'cargoLock'].includes(doc.languageId) ||
        Uri.parse(doc.uri).scheme !== 'file'
      ) {
        window.showWarningMessage('Please open a saved TOML file first.');
        return;
      }
      const res = await client.sendRequest<Methods.ListSchemas.Response>(
        Methods.ListSchemas.METHOD,
        {},
      );

      if (!res.schemas || res.schemas.length === 0) {
        window.showInformationMessage('No schemas available.');
        return;
      }

      const items = res.schemas.map((s) => s.title || s.uri);
      const idx = await window.showQuickpick(items, 'Select a schema');
      if (idx === -1) return;

      const selected = res.schemas[idx];
      await client.sendNotification(Methods.AssociateSchema.METHOD, {
        uri: selected.uri,
        fileMatch: [Uri.parse(doc.uri).fsPath],
        title: selected.title,
        description: selected.description,
        tomlVersion: selected.tomlVersion,
        force: true,
      } as Methods.AssociateSchema.Params);

      window.showInformationMessage(
        `Schema "${selected.title || selected.uri}" associated.`,
      );
    } catch (e) {
      window.showErrorMessage(`Failed to select schema: ${e}`);
    }
  };
}
