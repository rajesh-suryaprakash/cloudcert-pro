import React, { createContext, useContext, useState } from 'react';

interface KeyboardShortcutContextType {
  shortcutsEnabled: boolean;
  setShortcutsEnabled: (enabled: boolean) => void;
}

const KeyboardShortcutContext = createContext<KeyboardShortcutContextType | undefined>(undefined);

export const KeyboardShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shortcutsEnabled, setShortcutsEnabled] = useState(() => {
    const saved = localStorage.getItem('keyboard_shortcuts_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleShortcuts = (enabled: boolean) => {
    setShortcutsEnabled(enabled);
    localStorage.setItem('keyboard_shortcuts_enabled', String(enabled));
  };

  return (
    <KeyboardShortcutContext.Provider value={{ shortcutsEnabled, setShortcutsEnabled: toggleShortcuts }}>
      {children}
    </KeyboardShortcutContext.Provider>
  );
};

export const useKeyboardShortcuts = () => {
  const context = useContext(KeyboardShortcutContext);
  if (context === undefined) {
    // Fail-safe default fallback when rendered outside a provider (e.g., in unit tests)
    return {
      shortcutsEnabled: true,
      setShortcutsEnabled: () => {},
    };
  }
  return context;
};
