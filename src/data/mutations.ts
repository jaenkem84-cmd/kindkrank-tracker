import type { AppData, Child, DoseEntry, GrowthEntry, Medication, Settings, TemperatureEntry } from '../domain/types';

function replaceById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index < 0) return [...items, item];
  const next = items.slice();
  next[index] = item;
  return next;
}

function activeAfter(data: AppData, children: Child[]): string | null {
  if (children.some((child) => child.id === data.settings.activeChildId)) return data.settings.activeChildId;
  return children[0]?.id ?? null;
}

export function saveChild(data: AppData, child: Child): AppData {
  const children = replaceById(data.children, child);
  const activeChildId = data.settings.activeChildId ?? child.id;
  return { ...data, children, settings: { ...data.settings, activeChildId } };
}

export function removeChild(data: AppData, childId: string): AppData {
  const children = data.children.filter((child) => child.id !== childId);
  const medicationIds = new Set(data.medications.filter((med) => med.childId === childId).map((med) => med.id));
  return {
    ...data,
    children,
    temperatures: data.temperatures.filter((entry) => entry.childId !== childId),
    medications: data.medications.filter((entry) => entry.childId !== childId),
    doses: data.doses.filter((entry) => entry.childId !== childId && !medicationIds.has(entry.medicationId)),
    growth: data.growth.filter((entry) => entry.childId !== childId),
    settings: { ...data.settings, activeChildId: activeAfter(data, children) },
  };
}

export function saveTemperature(data: AppData, entry: TemperatureEntry): AppData {
  return { ...data, temperatures: replaceById(data.temperatures, entry) };
}

export function removeTemperature(data: AppData, id: string): AppData {
  return { ...data, temperatures: data.temperatures.filter((entry) => entry.id !== id) };
}

export function saveMedication(data: AppData, entry: Medication): AppData {
  return { ...data, medications: replaceById(data.medications, entry) };
}

export function removeMedication(data: AppData, id: string): AppData {
  return {
    ...data,
    medications: data.medications.filter((entry) => entry.id !== id),
    doses: data.doses.filter((entry) => entry.medicationId !== id),
  };
}

export function saveDose(data: AppData, entry: DoseEntry): AppData {
  return { ...data, doses: replaceById(data.doses, entry) };
}

export function removeDose(data: AppData, id: string): AppData {
  return { ...data, doses: data.doses.filter((entry) => entry.id !== id) };
}

export function saveGrowth(data: AppData, entry: GrowthEntry): AppData {
  return { ...data, growth: replaceById(data.growth, entry) };
}

export function removeGrowth(data: AppData, id: string): AppData {
  return { ...data, growth: data.growth.filter((entry) => entry.id !== id) };
}

export function saveSettings(data: AppData, settings: Settings): AppData {
  return { ...data, settings };
}
