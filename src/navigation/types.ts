import type { GrowthMetric } from '../domain/who/who';

export type CategoryName = 'temperature' | 'medication' | 'vaccination' | 'symptom' | 'weight' | 'height' | 'head';

export type Route =
  | { name: 'voice'; autoStart?: boolean }
  | { name: 'profile'; childId?: string }
  | { name: 'settings' }
  | { name: 'family' }
  | { name: 'export' }
  | { name: CategoryName }
  | { name: 'temp-form'; entryId?: string }
  | { name: 'med-form'; medicationId?: string; prefillName?: string }
  | { name: 'dose-form'; medicationId?: string; entryId?: string }
  | { name: 'growth-form'; entryId?: string; metric?: GrowthMetric }
  | { name: 'vaccination-form'; productId?: string }
  | { name: 'invite'; token: string };
