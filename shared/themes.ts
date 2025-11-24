export interface DashboardTheme {
  id: string;
  name: string;
  description: string;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  cssVariables: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
  };
}

export const dashboardThemes: DashboardTheme[] = [
  {
    id: 'modern-dark',
    name: 'Modern Dark',
    description: 'Sleek dark theme with purple accents',
    preview: {
      primary: '#8b5cf6',
      secondary: '#6366f1',
      accent: '#a78bfa',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f1f5f9',
    },
    cssVariables: {
      background: '222.2 84% 4.9%',
      foreground: '210 40% 98%',
      card: '222.2 84% 4.9%',
      cardForeground: '210 40% 98%',
      popover: '222.2 84% 4.9%',
      popoverForeground: '210 40% 98%',
      primary: '263.4 70% 50.4%',
      primaryForeground: '210 40% 98%',
      secondary: '217.2 91.2% 59.8%',
      secondaryForeground: '222.2 47.4% 11.2%',
      muted: '217.2 32.6% 17.5%',
      mutedForeground: '215 20.2% 65.1%',
      accent: '262.1 83.3% 57.8%',
      accentForeground: '210 40% 98%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '210 40% 98%',
      border: '217.2 32.6% 17.5%',
      input: '217.2 32.6% 17.5%',
      ring: '263.4 70% 50.4%',
    },
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    description: 'Cool, calming blue tones',
    preview: {
      primary: '#0ea5e9',
      secondary: '#06b6d4',
      accent: '#22d3ee',
      background: '#0c4a6e',
      surface: '#075985',
      text: '#f0f9ff',
    },
    cssVariables: {
      background: '201 90% 27.5%',
      foreground: '199 89% 48%',
      card: '201 96% 32%',
      cardForeground: '199 89% 48%',
      popover: '201 90% 27.5%',
      popoverForeground: '199 89% 48%',
      primary: '199 89% 48%',
      primaryForeground: '201 96% 32%',
      secondary: '188 94% 43%',
      secondaryForeground: '201 96% 32%',
      muted: '201 60% 20%',
      mutedForeground: '199 50% 70%',
      accent: '186 94% 53%',
      accentForeground: '201 96% 32%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
      border: '201 60% 20%',
      input: '201 60% 20%',
      ring: '199 89% 48%',
    },
  },
  {
    id: 'sunset-warm',
    name: 'Sunset Warm',
    description: 'Warm sunset-inspired colors',
    preview: {
      primary: '#f59e0b',
      secondary: '#f97316',
      accent: '#fb923c',
      background: '#7c2d12',
      surface: '#9a3412',
      text: '#fff7ed',
    },
    cssVariables: {
      background: '24 74% 28%',
      foreground: '33 100% 96.5%',
      card: '20 87% 33%',
      cardForeground: '33 100% 96.5%',
      popover: '24 74% 28%',
      popoverForeground: '33 100% 96.5%',
      primary: '38 92% 50%',
      primaryForeground: '24 74% 28%',
      secondary: '25 95% 53%',
      secondaryForeground: '24 74% 28%',
      muted: '24 50% 20%',
      mutedForeground: '33 80% 75%',
      accent: '27 96% 61%',
      accentForeground: '24 74% 28%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
      border: '24 50% 20%',
      input: '24 50% 20%',
      ring: '38 92% 50%',
    },
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Natural, earthy green palette',
    preview: {
      primary: '#10b981',
      secondary: '#14b8a6',
      accent: '#34d399',
      background: '#064e3b',
      surface: '#065f46',
      text: '#ecfdf5',
    },
    cssVariables: {
      background: '164 88% 17%',
      foreground: '151 81% 95.9%',
      card: '162 88% 20%',
      cardForeground: '151 81% 95.9%',
      popover: '164 88% 17%',
      popoverForeground: '151 81% 95.9%',
      primary: '160 84% 39%',
      primaryForeground: '164 88% 17%',
      secondary: '172 66% 50%',
      secondaryForeground: '164 88% 17%',
      muted: '164 60% 13%',
      mutedForeground: '151 60% 70%',
      accent: '158 64% 52%',
      accentForeground: '164 88% 17%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
      border: '164 60% 13%',
      input: '164 60% 13%',
      ring: '160 84% 39%',
    },
  },
  {
    id: 'professional-slate',
    name: 'Professional Slate',
    description: 'Sophisticated slate gray',
    preview: {
      primary: '#64748b',
      secondary: '#475569',
      accent: '#94a3b8',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f1f5f9',
    },
    cssVariables: {
      background: '222.2 47.4% 11.2%',
      foreground: '210 40% 98%',
      card: '217.2 32.6% 17.5%',
      cardForeground: '210 40% 98%',
      popover: '222.2 47.4% 11.2%',
      popoverForeground: '210 40% 98%',
      primary: '215.4 16.3% 46.9%',
      primaryForeground: '210 40% 98%',
      secondary: '215 19% 35%',
      secondaryForeground: '210 40% 98%',
      muted: '217.2 32.6% 17.5%',
      mutedForeground: '215 20.2% 65.1%',
      accent: '215 20% 65%',
      accentForeground: '222.2 47.4% 11.2%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '210 40% 98%',
      border: '217.2 32.6% 17.5%',
      input: '217.2 32.6% 17.5%',
      ring: '215.4 16.3% 46.9%',
    },
  },
  {
    id: 'clean-light',
    name: 'Clean Light',
    description: 'Bright, minimalist light theme',
    preview: {
      primary: '#3b82f6',
      secondary: '#6366f1',
      accent: '#8b5cf6',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
    },
    cssVariables: {
      background: '0 0% 100%',
      foreground: '222.2 84% 4.9%',
      card: '0 0% 100%',
      cardForeground: '222.2 84% 4.9%',
      popover: '0 0% 100%',
      popoverForeground: '222.2 84% 4.9%',
      primary: '217.2 91.2% 59.8%',
      primaryForeground: '0 0% 100%',
      secondary: '243.8 75.4% 58.6%',
      secondaryForeground: '0 0% 100%',
      muted: '210 40% 96.1%',
      mutedForeground: '215.4 16.3% 46.9%',
      accent: '263.4 70% 50.4%',
      accentForeground: '0 0% 100%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
      border: '214.3 31.8% 91.4%',
      input: '214.3 31.8% 91.4%',
      ring: '217.2 91.2% 59.8%',
    },
  },
];

export function getThemeById(id: string): DashboardTheme | undefined {
  return dashboardThemes.find(theme => theme.id === id);
}

export function getDefaultTheme(): DashboardTheme {
  return dashboardThemes[0]; // modern-dark
}
