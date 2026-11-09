import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strToU8, zipSync } from 'fflate';
import { Platform } from 'react-native';
import { buildExportFiles } from '../domain/csv';
import { formatDate } from '../domain/dates';
import type { AppData } from '../domain/types';

function exportName(now: Date): string {
  return `kindkrank-${formatDate(now).split('.').join('-')}.zip`;
}

async function shareOnWeb(filename: string, bytes: Uint8Array): Promise<void> {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy], { type: 'application/zip' });
  const nav = globalThis.navigator;
  const webFile = new globalThis.File([blob], filename, { type: 'application/zip' });
  if (nav && typeof nav.share === 'function') {
    const canShareFiles = typeof nav.canShare !== 'function' || nav.canShare({ files: [webFile] });
    if (canShareFiles) {
      try {
        await nav.share({ files: [webFile], title: 'Kindkrank-Export' });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
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
}

/** Shares every table as one ZIP. There is no week filter. */
export async function shareAllData(data: AppData, now = new Date()): Promise<void> {
  const files = buildExportFiles(data);
  const zipped = zipSync(Object.fromEntries(files.map((file) => [file.name, strToU8(file.contents)])));
  const filename = exportName(now);
  if (Platform.OS === 'web') {
    await shareOnWeb(filename, zipped);
    return;
  }
  const destination = new ExpoFile(Paths.cache, filename);
  destination.create({ overwrite: true });
  await destination.write(zipped);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Das Teilen-Menü ist hier nicht verfügbar.');
  }
  await Sharing.shareAsync(destination.uri, {
    mimeType: 'application/zip',
    dialogTitle: 'Kindkrank-Daten exportieren',
    UTI: 'public.zip-archive',
  });
}
