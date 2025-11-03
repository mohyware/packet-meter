type ThemeName = 'light' | 'dark';

type Listener = (theme: ThemeName) => void;

let currentTheme: ThemeName | null = null;
const listeners = new Set<Listener>();

export function getTheme(): ThemeName | null {
    return currentTheme;
}

export function setTheme(theme: ThemeName): void {
    currentTheme = theme;
    listeners.forEach((l) => l(theme));
}

export function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
