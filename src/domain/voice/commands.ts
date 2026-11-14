import { foldSpeech } from './parser';

export type VoiceCommand = 'save' | 'cancel' | 'undo' | 'stop' | 'anyway';

const PHRASES: [string, VoiceCommand][] = [
  ['rueckgaengig machen', 'undo'],
  ['mach rueckgaengig', 'undo'],
  ['rueckgaengig', 'undo'],
  ['nicht speichern', 'cancel'],
  ['doch nicht', 'cancel'],
  ['doch speichern', 'anyway'],
  ['trotzdem speichern', 'anyway'],
  ['trotzdem', 'anyway'],
  ['abbrechen', 'cancel'],
  ['abbruch', 'cancel'],
  ['speichern', 'save'],
  ['speichere', 'save'],
  ['beenden', 'stop'],
  ['schluss', 'stop'],
  ['tschuess', 'stop'],
  ['fertig', 'stop'],
  ['jawohl', 'save'],
  ['genau', 'save'],
  ['richtig', 'save'],
  ['passt', 'save'],
  ['okay', 'save'],
  ['nein', 'cancel'],
  ['nee', 'cancel'],
  ['noe', 'cancel'],
  ['stopp', 'cancel'],
  ['stop', 'cancel'],
  ['falsch', 'cancel'],
  ['jaa', 'save'],
  ['oke', 'save'],
  ['ja', 'save'],
  ['ok', 'save'],
];

/**
 * A command is only the whole utterance, so "Anna 38,5" and "ja 38,5" stay entries.
 * Digits never count as ja / nein / rückgängig.
 */
export function matchVoiceCommand(text: string): VoiceCommand | null {
  const folded = foldSpeech(text);
  if (!folded || /\d/.test(folded)) return null;
  const match = PHRASES.find(([phrase]) => folded === phrase || folded === `${phrase} bitte` || folded === `bitte ${phrase}`);
  return match?.[1] ?? null;
}
