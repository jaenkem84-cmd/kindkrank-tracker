import type { AppData, Child } from './types';

export function activeChildOf(data: AppData): Child | null {
  return data.children.find((child) => child.id === data.settings.activeChildId) ?? data.children[0] ?? null;
}

export function forChild<T extends { childId: string }>(items: T[], childId: string): T[] {
  return items.filter((item) => item.childId === childId);
}
