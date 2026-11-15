export function parseDecimal(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCelsius(value: number): string {
  return `${formatDecimal(value, 1)} °C`;
}

export function formatHours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = formatDecimal(rounded, Number.isInteger(rounded) ? 0 : 1);
  return rounded === 1 ? '1 Stunde' : `${text} Stunden`;
}

export function formatSince(hours: number): string {
  if (hours < 1 / 60) return 'gerade eben';
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return minutes === 1 ? 'vor 1 Min' : `vor ${minutes} Min`;
  }
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes === 60) return `vor ${whole + 1} Std`;
  if (minutes === 0) return whole === 1 ? 'vor 1 Std' : `vor ${whole} Std`;
  return `vor ${whole} Std ${minutes} Min`;
}
