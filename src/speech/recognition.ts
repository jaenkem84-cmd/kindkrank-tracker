export type SpeechSupport = 'web' | 'native' | 'none';

export type SpeechCallbacks = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

export type SpeechSession = { stop: () => void };

type WebResult = { isFinal: boolean; 0?: { transcript?: string } };

type WebRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<WebResult> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type NativeEvent = { isFinal?: boolean; results?: Array<{ transcript?: string }> };

type NativeModule = {
  isRecognitionAvailable?: () => boolean;
  requestPermissionsAsync?: () => Promise<{ granted?: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort?: () => void;
  addListener?: (event: string, listener: (payload: NativeEvent) => void) => { remove: () => void };
};

function webConstructor(): (new () => WebRecognition) | null {
  const host = globalThis as typeof globalThis & {
    SpeechRecognition?: new () => WebRecognition;
    webkitSpeechRecognition?: new () => WebRecognition;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function loadNativeModule(): NativeModule | null {
  try {
    const dynamicRequire = Function(
      'return typeof require === "function" ? require : null;',
    )() as ((id: string) => Record<string, unknown>) | null;
    if (!dynamicRequire) return null;
    const loaded = dynamicRequire('expo-speech-recognition');
    const candidate = (loaded.ExpoSpeechRecognitionModule ?? loaded) as NativeModule;
    if (!candidate || typeof candidate.start !== 'function' || typeof candidate.stop !== 'function') return null;
    if (candidate.isRecognitionAvailable && !candidate.isRecognitionAvailable()) return null;
    return candidate;
  } catch {
    return null;
  }
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
      return 'Das Mikrofon ist nicht freigegeben.';
    case 'no-speech':
      return 'Ich habe nichts gehört. Du kannst den Satz auch eintippen.';
    case 'network':
      return 'Die Spracherkennung braucht gerade eine Verbindung. Tippen geht auch ohne.';
    case 'audio-capture':
      return 'Kein Mikrofon gefunden.';
    default:
      return 'Spracherkennung gerade nicht möglich. Der Text unten funktioniert weiter.';
  }
}

function startWeb(callbacks: SpeechCallbacks): SpeechSession | null {
  const Ctor = webConstructor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = 'de-DE';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
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
  recognition.onerror = (event) => callbacks.onError(germanSpeechError(event.error));
  recognition.onend = () => callbacks.onEnd();
  recognition.start();
  return { stop: () => recognition.stop() };
}

async function startNative(callbacks: SpeechCallbacks): Promise<SpeechSession | null> {
  const native = loadNativeModule();
  if (!native) return null;
  try {
    if (native.requestPermissionsAsync) {
      const permission = await native.requestPermissionsAsync();
      if (permission.granted === false) {
        callbacks.onError('Das Mikrofon ist nicht freigegeben.');
        callbacks.onEnd();
        return null;
      }
    }
    const subscriptions = ['result', 'error', 'end', 'speechend'].map((eventName) => {
      if (!native.addListener) return null;
      return native.addListener(eventName, (payload) => {
        if (eventName === 'error') {
          callbacks.onError(germanSpeechError(undefined));
          return;
        }
        if (eventName === 'end' || eventName === 'speechend') {
          callbacks.onEnd();
          return;
        }
        const transcript = payload.results?.[0]?.transcript?.trim() ?? '';
        if (!transcript) return;
        if (payload.isFinal) callbacks.onFinal(transcript);
        else callbacks.onPartial(transcript);
      });
    });
    native.start({ lang: 'de-DE', interimResults: true, continuous: false });
    return {
      stop: () => {
        native.stop();
        for (const subscription of subscriptions) subscription?.remove();
      },
    };
  } catch {
    callbacks.onError('Die Geräte-Spracherkennung ist nicht eingebunden. Bitte den Satz eintippen.');
    callbacks.onEnd();
    return null;
  }
}

export async function startSpeech(callbacks: SpeechCallbacks): Promise<SpeechSession | null> {
  const web = startWeb(callbacks);
  if (web) return web;
  return startNative(callbacks);
}
