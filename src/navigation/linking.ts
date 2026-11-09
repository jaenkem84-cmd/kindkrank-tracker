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
