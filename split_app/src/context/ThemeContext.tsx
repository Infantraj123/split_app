// @ts-ignore
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
// @ts-ignore
import { useColorScheme } from 'react-native';
// @ts-ignore
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeColors,
  ThemeShadow,
  lightColors,
  darkColors,
  SHADOW_LIGHT,
  SHADOW_DARK,
} from '../constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = '@splitapp/theme_preference';
const CYCLE_ORDER: ThemePreference[] = ['system', 'light', 'dark'];

interface ThemeContextType {
  colors: ThemeColors;
  shadow: ThemeShadow;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  cyclePreference: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved: string | null) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setPreferenceState(saved);
      }
    });
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  };

  const cyclePreference = () => {
    const nextIndex = (CYCLE_ORDER.indexOf(preference) + 1) % CYCLE_ORDER.length;
    setPreference(CYCLE_ORDER[nextIndex]);
  };

  const mode: ThemeMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = mode === 'dark' ? darkColors : lightColors;
  const shadow = mode === 'dark' ? SHADOW_DARK : SHADOW_LIGHT;

  return (
    <ThemeContext.Provider value={{ colors, shadow, mode, preference, setPreference, cyclePreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
