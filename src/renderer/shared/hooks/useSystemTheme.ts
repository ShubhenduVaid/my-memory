import { useState, useEffect } from 'react';
import { api } from '../api';

export function useSystemTheme(): { isDark: boolean; toggle: () => void } {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Get initial theme
    api.getSystemTheme?.().then(setIsDark);

    // Listen for theme changes
    const unsubscribe = api.onThemeChange?.((dark) => setIsDark(dark));
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return { isDark, toggle };
}
