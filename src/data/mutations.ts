import type {
  AppData,
  Caregiver,
  Child,
  CustomSymptom,
  DoseEntry,
  GrowthEntry,
  Medication,
  Reminder,
  Settings,
  SymptomEntry,
  TemperatureEntry,
  VaccinationEntry,
} from '../domain/types';

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

export function setActivePerson(data: AppData, personId: string): AppData {
  if (!data.children.some((person) => person.id === personId)) return data;
  return { ...data, settings: { ...data.settings, activeChildId: personId } };
}

export function markInvited(data: AppData, personId: string): AppData {
  return {
    ...data,
    children: data.children.map((person) =>
      person.id === personId && !person.isAdmin ? { ...person, joinStatus: 'eingeladen' } : person,
    ),
  };
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
    vaccinations: data.vaccinations.filter((entry) => entry.childId !== childId),
    symptoms: data.symptoms.filter((entry) => entry.childId !== childId),
    reminders: data.reminders.filter((entry) => entry.childId !== childId),
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
    reminders: data.reminders.filter((entry) => entry.medicationId !== id),
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

export function saveCaregiver(data: AppData, caregiver: Caregiver): AppData {
  return { ...data, caregivers: replaceById(data.caregivers, caregiver) };
}

export function removeCaregiver(data: AppData, id: string): AppData {
  return { ...data, caregivers: data.caregivers.filter((entry) => entry.isOwner || entry.id !== id) };
}

export function saveVaccination(data: AppData, entry: VaccinationEntry): AppData {
  return { ...data, vaccinations: replaceById(data.vaccinations, entry) };
}

export function removeVaccination(data: AppData, id: string): AppData {
  return { ...data, vaccinations: data.vaccinations.filter((entry) => entry.id !== id) };
}

export function saveSymptom(data: AppData, entry: SymptomEntry): AppData {
  return { ...data, symptoms: replaceById(data.symptoms, entry) };
}

export function removeSymptom(data: AppData, id: string): AppData {
  return { ...data, symptoms: data.symptoms.filter((entry) => entry.id !== id) };
}

export function saveCustomSymptom(data: AppData, symptom: CustomSymptom): AppData {
  return { ...data, customSymptoms: replaceById(data.customSymptoms ?? [], symptom) };
}

export function removeCustomSymptom(data: AppData, id: string): AppData {
  return { ...data, customSymptoms: (data.customSymptoms ?? []).filter((entry) => entry.id !== id) };
}

export function saveReminder(data: AppData, reminder: Reminder): AppData {
  return { ...data, reminders: replaceById(data.reminders, reminder) };
}

export function removeReminder(data: AppData, id: string): AppData {
  return { ...data, reminders: data.reminders.filter((entry) => entry.id !== id) };
}
