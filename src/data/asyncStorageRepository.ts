import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData } from '../domain/types';
import { migrateAppData } from './migrate';
import type { KindkrankRepository } from './repository';

export const STORAGE_KEY = 'kindkrank.v5';
const LEGACY_KEYS = ['kindkrank.v4', 'kindkrank.v3', 'kindkrank.v2'];

type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function createAsyncStorageRepository(storage: KeyValueStore = AsyncStorage): KindkrankRepository {
  return {
    async load() {
      for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
        const raw = await storage.getItem(key);
        if (!raw) continue;
        try {
          const migrated = migrateAppData(JSON.parse(raw) as unknown);
          if (!migrated) continue;
          if (key !== STORAGE_KEY) await storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        } catch {
          continue;
        }
      }
      return null;
    },
    async save(data) {
      await storage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
  };
}
