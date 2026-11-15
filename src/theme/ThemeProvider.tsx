import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { Appearance } from '../domain/types';
import { darkTheme, lightTheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ appearance, children }: { appearance: Appearance; children: ReactNode }) {
  const scheme = useColorScheme();
  const dark = appearance === 'dark' || (appearance !== 'light' && scheme === 'dark');
  return <ThemeContext.Provider value={dark ? darkTheme : lightTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
