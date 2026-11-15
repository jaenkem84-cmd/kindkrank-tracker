export type Theme = {
  dark: boolean;
  bg: string;
  card: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  border: string;
  input: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  ok: string;
  okSoft: string;
  chart: string;
  grid: string;
};

export const lightTheme: Theme = {
  dark: false,
  bg: '#F3F0EA',
  card: '#FFFCF7',
  text: '#1C2430',
  muted: '#5C6773',
  accent: '#0E6B68',
  accentSoft: '#D5EFEB',
  onAccent: '#F4FFFE',
  border: '#E4DCD0',
  input: '#FFFFFF',
  danger: '#9C2F2F',
  dangerSoft: '#F8E6E2',
  warning: '#8A5A16',
  warningSoft: '#F8EDD8',
  ok: '#1D6B45',
  okSoft: '#DDEFE4',
  chart: '#245C6B',
  grid: '#E6DED2',
};

export const darkTheme: Theme = {
  dark: true,
  bg: '#101418',
  card: '#1B222C',
  text: '#F4F0E8',
  muted: '#A9B2BD',
  accent: '#8ED9D3',
  accentSoft: '#1A3332',
  onAccent: '#0E1C1B',
  border: '#2C3644',
  input: '#121820',
  danger: '#F0B4AE',
  dangerSoft: '#3A2224',
  warning: '#F0D0A0',
  warningSoft: '#332816',
  ok: '#A9D8BC',
  okSoft: '#173026',
  chart: '#B7D7E2',
  grid: '#2A3442',
};

export const guideColors = {
  raised: '#C4A15A',
  fever: '#D17A3A',
  high: '#D15A4A',
  care: '#C44868',
};
