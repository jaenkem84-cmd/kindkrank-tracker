import type { AppData } from '../domain/types';
import { createAsyncStorageRepository } from './asyncStorageRepository';
import { isSupabaseConfigured, pullFamilyDocument, pushFamilyDocument } from './familySync';
import { migrateAppData } from './migrate';
import type { KindkrankRepository } from './repository';

/** Local storage, plus a family document when Supabase is configured and this device has joined. */
export function createSyncingRepository(): KindkrankRepository {
  const local = createAsyncStorageRepository();
  return {
    async load() {
      const stored = await local.load();
      if (!stored || !isSupabaseConfigured() || !stored.settings.familyId) return stored;
      try {
        const remote = migrateAppData(await pullFamilyDocument(stored.settings.familyId));
        if (!remote) return stored;
        await local.save(remote);
        return remote;
      } catch {
        return stored;
      }
    },
    async save(data: AppData) {
      await local.save(data);
      if (!isSupabaseConfigured() || !data.settings.familyId) return;
      await pushFamilyDocument(data.settings.familyId, data);
    },
  };
}
