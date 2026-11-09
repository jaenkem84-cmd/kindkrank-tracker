import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { activeChildOf } from '../domain/select';
import type { AppData, Child } from '../domain/types';
import { createAsyncStorageRepository } from '../data/asyncStorageRepository';
import { createSeedData } from '../data/seed';

type StoreValue = {
  ready: boolean;
  loadError: string | null;
  data: AppData | null;
  activeChild: Child | null;
  update: (recipe: (current: AppData) => AppData) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dataRef = useRef<AppData | null>(null);
  const repository = useRef(createAsyncStorageRepository());

  useEffect(() => {
    let cancel = false;
    repository.current
      .load()
      .then(async (loaded) => {
        const next = loaded ?? createSeedData(new Date());
        if (!loaded) await repository.current.save(next);
        if (cancel) return;
        dataRef.current = next;
        setData(next);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancel) return;
        setLoadError(error instanceof Error ? error.message : 'Die Daten konnten nicht geladen werden.');
        setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const update = useCallback((recipe: (current: AppData) => AppData) => {
    const current = dataRef.current;
    if (!current) return;
    const next = recipe(current);
    dataRef.current = next;
    setData(next);
    setLoadError(null);
    void repository.current.save(next).catch(() => {
      setLoadError('Speichern ist fehlgeschlagen.');
    });
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      loadError,
      data,
      activeChild: data ? activeChildOf(data) : null,
      update,
    }),
    [ready, loadError, data, update],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('Store fehlt');
  return value;
}
