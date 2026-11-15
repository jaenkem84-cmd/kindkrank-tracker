export type SpeechSupport = 'web' | 'native' | 'none';

export type SpeechCallbacks = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string, code?: string) => void;
  onEnd: () => void;
};

export type SpeechSession = { stop: () => void };

export type SpeechStartOptions = { hints?: string[] };

type WebResult = { isFinal: boolean; 0?: { transcript?: string } };

type WebRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<WebResult> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type NativeResult = { isFinal?: boolean; results?: Array<{ transcript?: string }> };
type NativeError = { error?: string; message?: string };

type NativeModule = {
  isRecognitionAvailable?: () => boolean;
  requestPermissionsAsync?: () => Promise<{ granted?: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort?: () => void;
  addListener?: (event: string, listener: (payload: NativeResult & NativeError) => void) => { remove: () => void };
};

function webConstructor(): (new () => WebRecognition) | null {
  const host = globalThis as typeof globalThis & {
    SpeechRecognition?: new () => WebRecognition;
    webkitSpeechRecognition?: new () => WebRecognition;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

let nativeModule: NativeModule | null | undefined;

function loadNativeModule(): NativeModule | null {
  if (nativeModule !== undefined) return nativeModule;
  try {
    // Static require so the EAS bundle contains the module. Expo Go has no native
    // part; the package throws while loading and we fall back to typing.
    const loaded = require('expo-speech-recognition') as { ExpoSpeechRecognitionModule?: NativeModule };
    const candidate = loaded.ExpoSpeechRecognitionModule ?? null;
    if (!candidate || typeof candidate.start !== 'function' || typeof candidate.stop !== 'function') {
      nativeModule = null;
    } else if (candidate.isRecognitionAvailable && !candidate.isRecognitionAvailable()) {
      nativeModule = null;
    } else {
      nativeModule = candidate;
    }
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

export function speechSupport(): SpeechSupport {
  if (webConstructor()) return 'web';
  if (loadNativeModule()) return 'native';
  return 'none';
}

function germanSpeechError(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Das Mikrofon ist nicht freigegeben. Einmal erlauben, danach geht es ohne Tippen.';
    case 'no-speech':
    case 'speech-timeout':
      return 'Ich habe nichts gehört.';
    case 'network':
      return 'Die Spracherkennung braucht gerade eine Verbindung. Tippen geht auch ohne.';
    case 'audio-capture':
      return 'Kein Mikrofon gefunden.';
    default:
      return 'Spracherkennung gerade nicht möglich. Der Text unten funktioniert weiter.';
  }
}

function startWeb(callbacks: SpeechCallbacks, hints: string[]): SpeechSession | null {
  const Ctor = webConstructor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = 'de-DE';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  const withHints = recognition as WebRecognition & { contextualStrings?: string[] };
  if (hints.length > 0) withHints.contextualStrings = hints;
  recognition.onresult = (event) => {
    let text = '';
    let isFinal = false;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      text += result?.[0]?.transcript ?? '';
      if (result?.isFinal) isFinal = true;
    }
    const spoken = text.trim();
    if (!spoken) return;
    if (isFinal) callbacks.onFinal(spoken);
    else callbacks.onPartial(spoken);
  };
  let failed = false;
  recognition.onerror = (event) => {
    failed = true;
    callbacks.onError(germanSpeechError(event.error), event.error);
  };
  recognition.onend = () => callbacks.onEnd();
  try {
    recognition.start();
  } catch {
    callbacks.onError(germanSpeechError(undefined));
    callbacks.onEnd();
    return null;
  }
  if (failed) return null;
  return {
    stop: () => {
      try {
        recognition.abort?.();
        recognition.stop();
      } catch {
        // The recognizer may already be stopped.
      }
    },
  };
}

async function startNative(callbacks: SpeechCallbacks, hints: string[]): Promise<SpeechSession | null> {
  const native = loadNativeModule();
  if (!native) return null;
  try {
    if (native.requestPermissionsAsync) {
      const permission = await native.requestPermissionsAsync();
      if (permission.granted === false) {
        callbacks.onError(germanSpeechError('not-allowed'), 'not-allowed');
        callbacks.onEnd();
        return null;
      }
    }
    const subscriptions = ['result', 'error', 'end'].map((eventName) => {
      if (!native.addListener) return null;
      return native.addListener(eventName, (payload) => {
        if (eventName === 'error') {
          const code = payload.error;
          callbacks.onError(germanSpeechError(code), code);
          return;
        }
        if (eventName === 'end') {
          callbacks.onEnd();
          return;
        }
        const transcript = payload.results?.[0]?.transcript?.trim() ?? '';
        if (!transcript) return;
        if (payload.isFinal) callbacks.onFinal(transcript);
        else callbacks.onPartial(transcript);
      });
    });
    native.start({
      lang: 'de-DE',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      addsPunctuation: false,
      contextualStrings: hints,
      androidIntent: 'android.speech.action.RECOGNIZE_SPEECH',
      androidIntentOptions: {
        EXTRA_LANGUAGE_MODEL: 'free_form',
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1400,
        EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 400,
      },
    });
    return {
      stop: () => {
        try {
          native.abort?.();
          native.stop();
        } catch {
          // Already stopped.
        }
        for (const subscription of subscriptions) subscription?.remove();
      },
    };
  } catch {
    callbacks.onError('Die Geräte-Spracherkennung ist nicht eingebunden. Bitte den Satz eintippen.');
    callbacks.onEnd();
    return null;
  }
}

export async function startSpeech(callbacks: SpeechCallbacks, options: SpeechStartOptions = {}): Promise<SpeechSession | null> {
  const hints = options.hints ?? [];
  const web = startWeb(callbacks, hints);
  if (web) return web;
  return startNative(callbacks, hints);
}
