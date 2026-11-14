import type { FamilyDirectory } from './repository';

const REASON =
  'Einladungslinks brauchen ein Backend (Supabase oder Firebase, jeweils im kostenlosen Kontingent). In diesem Prototyp bleiben alle Daten auf diesem Gerät. Es wird kein Konto und kein API-Schlüssel verlangt.';

export const localFamilyDirectory: FamilyDirectory = {
  async createInvite() {
    return { ok: false, reason: REASON };
  },
  async acceptInvite() {
    return { ok: false, reason: REASON };
  },
};
