import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData } from '../domain/types';
import type { KindkrankRepository } from './repository';

export const STORAGE_KEY = 'kindkrank.v2';

type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const data = value as AppData;
  return data.version === 2 && Array.isArray(data.children) && Array.isArray(data.temperatures) && Array.isArray(data.caregivers);
}

export function createAsyncStorageRepository(storage: KeyValueStore = AsyncStorage): KindkrankRepository {
  return {
    async load() {
      const raw = await storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        return isAppData(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    async save(data) {
      await storage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
  };
}
