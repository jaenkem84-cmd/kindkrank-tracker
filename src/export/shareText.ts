import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export async function sharePlainText(filename: string, text: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const nav = globalThis.navigator;
    const webFile = new globalThis.File([blob], filename, { type: 'text/plain' });
    if (nav && typeof nav.share === 'function') {
      try {
        const canShare = typeof nav.canShare !== 'function' || nav.canShare({ files: [webFile] });
        if (canShare) {
          await nav.share({ files: [webFile], title: filename, text });
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title: filename, text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new ExpoFile(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Teilen ist hier nicht verfügbar.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Für den Arzt', UTI: 'public.plain-text' });
}
