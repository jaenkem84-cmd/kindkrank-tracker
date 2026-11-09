import type { AppData } from '../domain/types';

/**
 * All reads and writes go through this port.
 * The prototype ships a local AsyncStorage implementation.
 * A later Supabase or Firebase repository can replace it without changing the screens.
 */
export interface KindkrankRepository {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

export type InviteResult = { ok: true; url: string } | { ok: false; reason: string };

/** Future family directory. Invite links are not issued while the app is local-only. */
export interface FamilyDirectory {
  createInvite(): Promise<InviteResult>;
  acceptInvite(url: string): Promise<InviteResult>;
}
