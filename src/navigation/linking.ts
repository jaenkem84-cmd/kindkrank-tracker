/** Token from kindkrank://invite/<token> or a pasted code. */
export function inviteTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/invite\/([A-Za-z0-9]+)/i);
  return match?.[1] ?? null;
}

export type VoicePreview = 'listening' | 'confirm';

/** Screenshot and review states. Not used by the assistant deep link. */
export function voicePreviewFromUrl(url: string | null | undefined): VoicePreview | null {
  if (!url) return null;
  const match = url.match(/[?&]voicePreview=(listening|confirm)\b/);
  if (match?.[1] === 'listening' || match?.[1] === 'confirm') return match[1];
  return null;
}

/** True when a deep link should open the voice screen. Supports kindkrank://voice and Expo path /voice. */
export function isVoiceLink(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (/^kindkrank:\/\/voice\b/i.test(value)) return true;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    if (host === 'voice' || path === '/voice' || path.endsWith('/voice')) return true;
  } catch {
    // Some Android intents are not absolute URLs.
  }
  return /(?:^|[/:])voice(?:$|[/?#])/i.test(value);
}
