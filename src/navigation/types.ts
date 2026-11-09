import type { GrowthMetric } from '../domain/who/who';

export type CategoryName = 'temperature' | 'medication' | 'weight' | 'height' | 'head';

export type Route =
  | { name: 'voice'; autoStart?: boolean }
  | { name: 'profile'; childId?: string }
  | { name: 'settings' }
  | { name: 'member'; memberId?: string }
  | { name: CategoryName }
  | { name: 'temp-form'; entryId?: string }
  | { name: 'med-form'; medicationId?: string; prefillName?: string }
  | { name: 'dose-form'; medicationId?: string; entryId?: string }
  | { name: 'growth-form'; entryId?: string; metric?: GrowthMetric };
