type SpeechModule = {
  speak: (text: string, options?: Record<string, unknown>) => void;
  stop: () => void;
};

function loadSpeech(): SpeechModule | null {
  try {
    const loaded = require('expo-speech') as SpeechModule;
    if (!loaded || typeof loaded.speak !== 'function') return null;
    return loaded;
  } catch {
    return null;
  }
}

/** Reads German text aloud. Resolves when speech ends, or after a few seconds if the device stays silent. */
export function speakGerman(text: string): Promise<void> {
  const spoken = text.trim();
  if (!spoken) return Promise.resolve();
  const speech = loadSpeech();
  if (!speech) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const cap = setTimeout(finish, 9000);
    try {
      speech.stop();
      speech.speak(spoken, {
        language: 'de-DE',
        rate: 0.96,
        onDone: () => {
          clearTimeout(cap);
          finish();
        },
        onStopped: () => {
          clearTimeout(cap);
          finish();
        },
        onError: () => {
          clearTimeout(cap);
          finish();
        },
      });
    } catch {
      clearTimeout(cap);
      finish();
    }
  });
}

export function stopSpeaking(): void {
  try {
    loadSpeech()?.stop();
  } catch {
    // Nothing is speaking.
  }
}
