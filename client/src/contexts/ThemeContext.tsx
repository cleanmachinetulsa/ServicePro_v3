import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { dashboardThemes, DashboardTheme, getThemeById } from '@shared/themes';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
  dashboardTheme: DashboardTheme;
  setDashboardTheme: (themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    const stored = localStorage.getItem('theme');
    if (stored) {
      return stored === 'dark';
    }
    return true; // Default to dark mode for all customers
  });

  const [dashboardTheme, setDashboardThemeState] = useState<DashboardTheme>(() => {
    if (typeof window === 'undefined') {
      return dashboardThemes[0];
    }
    const saved = localStorage.getItem('dashboard-theme');
    return getThemeById(saved || 'modern-dark') || dashboardThemes[0];
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    Object.entries(dashboardTheme.cssVariables).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, [dashboardTheme]);

  const toggleTheme = () => setIsDark(prev => !prev);
  const setTheme = (dark: boolean) => setIsDark(dark);
  
  const setDashboardTheme = (themeId: string) => {
    const theme = getThemeById(themeId);
    if (theme) {
      setDashboardThemeState(theme);
      localStorage.setItem('dashboard-theme', themeId);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, setTheme, dashboardTheme, setDashboardTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
