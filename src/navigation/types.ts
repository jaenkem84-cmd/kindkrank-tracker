export type TabName = 'home' | 'fever' | 'meds' | 'growth' | 'settings';

export type Route =
  | { name: 'voice'; autoStart?: boolean }
  | { name: 'child-form'; childId?: string }
  | { name: 'temp-form'; entryId?: string }
  | { name: 'med-form'; medicationId?: string; prefillName?: string }
  | { name: 'dose-form'; medicationId?: string; entryId?: string }
  | { name: 'growth-form'; entryId?: string };
