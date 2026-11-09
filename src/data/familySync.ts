import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppData } from '../domain/types';

const LOCAL_INVITES = 'kindkrank.local-invites';

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL as string, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

function newToken(): string {
  return `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 8)}`;
}

export function buildInviteMessage(token: string, synced: boolean): string {
  const lines = ['Einladung zu Kindkrank', `kindkrank://invite/${token}`, `Code: ${token}`];
  const base = process.env.EXPO_PUBLIC_INVITE_WEB_BASE;
  if (base) lines.push(`${base.replace(/\/$/, '')}/invite/${token}`);
  else lines.push('Eine https-Seite ist noch nicht eingerichtet. In Kindkrank den Code unter Einstellungen einfügen.');
  if (synced) lines.push('Die Einträge werden über den gemeinsamen Ordner geteilt. Die Einladung gilt 7 Tage.');
  else lines.push('Synchronisation ist noch nicht aktiv. Es werden keine Einträge übertragen, bis Supabase eingerichtet ist.');
  return lines.join('\n');
}

async function ensureUser(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const existing = await supabase.auth.getSession();
  if (existing.data.session) return;
  const signed = await supabase.auth.signInAnonymously();
  if (signed.error) throw new Error(signed.error.message);
}

export async function pullFamilyDocument(familyId: string): Promise<AppData | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  await ensureUser();
  const result = await supabase.from('family_documents').select('payload').eq('family_id', familyId).maybeSingle();
  if (result.error || !result.data?.payload) return null;
  const payload = result.data.payload as AppData;
  if (!payload || payload.version !== 3) return null;
  return { ...payload, settings: { ...payload.settings, familyId } };
}

export async function pushFamilyDocument(familyId: string, data: AppData): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await ensureUser();
  const result = await supabase.from('family_documents').upsert({
    family_id: familyId,
    payload: data,
    updated_at: new Date().toISOString(),
  });
  if (result.error) throw new Error(result.error.message);
}

export async function createFamilyInvite(data: AppData): Promise<{ message: string; synced: boolean; data: AppData }> {
  if (!isSupabaseConfigured()) {
    const token = newToken();
    const raw = await AsyncStorage.getItem(LOCAL_INVITES);
    const list = raw ? (JSON.parse(raw) as { token: string; expiresAt: string }[]) : [];
    list.push({ token, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    await AsyncStorage.setItem(LOCAL_INVITES, JSON.stringify(list));
    return { message: buildInviteMessage(token, false), synced: false, data };
  }
  const supabase = getSupabase();
  if (!supabase) return { message: buildInviteMessage(newToken(), false), synced: false, data };
  await ensureUser();
  let familyId = data.settings.familyId;
  if (!familyId) {
    const created = await supabase.rpc('ensure_family');
    if (created.error || !created.data) throw new Error(created.error?.message ?? 'Familie konnte nicht angelegt werden.');
    familyId = created.data as string;
  }
  const next: AppData = { ...data, settings: { ...data.settings, familyId } };
  await pushFamilyDocument(familyId, next);
  const invite = await supabase.rpc('create_invite');
  if (invite.error || !invite.data) throw new Error(invite.error?.message ?? 'Einladung konnte nicht erstellt werden.');
  return { message: buildInviteMessage(invite.data as string, true), synced: true, data: next };
}

export function tokenFromInvite(input: string): string {
  const match = input.trim().match(/invite\/([A-Za-z0-9]+)/);
  return (match?.[1] ?? input.trim()).replace(/[^A-Za-z0-9]/g, '');
}

export async function acceptFamilyInvite(input: string, data: AppData): Promise<{ message: string; data: AppData | null }> {
  const token = tokenFromInvite(input);
  if (!token) return { message: 'Der Code fehlt.', data: null };
  if (!isSupabaseConfigured()) {
    return {
      message: 'Der Code wurde erkannt, aber Supabase ist nicht eingerichtet. Es wurden keine Einträge übernommen.',
      data: null,
    };
  }
  const supabase = getSupabase();
  if (!supabase) return { message: 'Supabase ist nicht erreichbar.', data: null };
  await ensureUser();
  const accepted = await supabase.rpc('accept_invite', { invite_token: token });
  if (accepted.error || !accepted.data) {
    return { message: accepted.error?.message ?? 'Einladung ungültig oder abgelaufen.', data: null };
  }
  const familyId = accepted.data as string;
  const remote = await pullFamilyDocument(familyId);
  if (!remote) {
    const joined = { ...data, settings: { ...data.settings, familyId } };
    return { message: 'Beigetreten. In diesem Ordner liegen noch keine Einträge.', data: joined };
  }
  return { message: 'Die gemeinsamen Einträge sind geladen.', data: remote };
}
