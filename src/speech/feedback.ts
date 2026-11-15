import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type Cue = 'heard' | 'saved' | 'cancel';

let heardPlayer: AudioPlayer | null = null;
let savedPlayer: AudioPlayer | null = null;
let cancelPlayer: AudioPlayer | null = null;

function player(cue: Cue): AudioPlayer | null {
  try {
    if (cue === 'saved') {
      savedPlayer ??= createAudioPlayer(require('../../assets/sounds/saved.wav'));
      return savedPlayer;
    }
    if (cue === 'cancel') {
      cancelPlayer ??= createAudioPlayer(require('../../assets/sounds/cancel.wav'));
      return cancelPlayer;
    }
    heardPlayer ??= createAudioPlayer(require('../../assets/sounds/heard.wav'));
    return heardPlayer;
  } catch {
    return null;
  }
}

export async function playCue(cue: Cue): Promise<void> {
  try {
    if (cue === 'saved') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (cue === 'cancel') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Haptics are absent on the web and on some desktops.
  }
  try {
    const current = player(cue);
    if (!current) return;
    await current.seekTo(0);
    current.play();
  } catch {
    // A missing sound must not block saving.
  }
}
