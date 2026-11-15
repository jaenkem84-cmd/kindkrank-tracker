export const REFERENCE_LINES = [
  { celsius: 37.6, id: 'raised', label: 'erhöhte Temperatur' },
  { celsius: 38.5, id: 'fever', label: 'Fieber' },
  { celsius: 39, id: 'high', label: 'hohes Fieber' },
  { celsius: 40, id: 'care', label: 'ärztlich abklären' },
] as const;

export type TemperatureBandId = 'below' | 'raised' | 'fever' | 'high' | 'care';

export function temperatureBand(celsius: number): { id: TemperatureBandId; label: string } {
  if (celsius >= 40) return { id: 'care', label: 'ärztlich abklären' };
  if (celsius >= 39) return { id: 'high', label: 'hohes Fieber' };
  if (celsius >= 38.5) return { id: 'fever', label: 'Fieber' };
  if (celsius >= 37.6) return { id: 'raised', label: 'erhöhte Temperatur' };
  return { id: 'below', label: 'unter 37,6 °C' };
}
