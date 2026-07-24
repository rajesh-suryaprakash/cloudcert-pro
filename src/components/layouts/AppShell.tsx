import React from 'react';
import { BrainCircuit, LogOut, ShieldCheck, Keyboard } from 'lucide-react';
import { useKeyboardShortcuts } from '../../contexts/KeyboardShortcutContext';

export function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  const firstLetter = (s: string) => (s.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
  if (parts.length === 1) return firstLetter(parts[0]) || '?';
  return (
    (firstLetter(parts[0]) + firstLetter(parts[parts.length - 1])).replace(/[^A-Z]/g, '') || '?'
  );
}

export function getAvatarColor(name: string): string {
  const colours = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colours[Math.abs(hash) % colours.length];
}

interface AppShellProps {
  children: React.ReactNode;
  user: { name: string } | null;
  role: string | null;
  isAdminView: boolean;
  onToggleAdmin: () => void;
  onReset: () => void;
  onLogout: () => void;
}

const AppShell: React.FC<AppShellProps> = ({
  children,
  user,
  role,
  isAdminView,
  onToggleAdmin,
  onReset,
  onLogout,
}) => {
  const { shortcutsEnabled, setShortcutsEnabled } = useKeyboardShortcuts();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden w-full">
      <header className="bg-white border-b border-slate-200 py-3 px-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onReset}>
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BrainCircuit className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">CloudCert Pro</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Toggle only shown for non-admin users who can switch between user/admin views */}
            {role === 'admin' && !isAdminView && (
              <button
                onClick={onToggleAdmin}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-slate-600 hover:bg-slate-50"
              >
                <ShieldCheck className="w-5 h-5" /> Admin Panel
              </button>
            )}

            {/* Keyboard Shortcuts Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-wider select-none">
              <input
                type="checkbox"
                checked={shortcutsEnabled}
                onChange={(e) => setShortcutsEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
              <Keyboard className="w-4 h-4" />
              <span className="hidden sm:inline">Shortcuts</span>
            </label>

            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500 capitalize">{role}</p>
              </div>
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                className="rounded-full border-2 border-indigo-100"
                aria-label={`Avatar for ${user?.name}`}
              >
                <circle cx="20" cy="20" r="20" fill={getAvatarColor(user?.name ?? '')} />
                <text
                  x="20"
                  y="20"
                  dominantBaseline="central"
                  textAnchor="middle"
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {getInitials(user?.name ?? '')}
                </text>
              </svg>
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 overflow-y-auto overflow-x-hidden overscroll-x-none">{children}</main>

      <footer className="bg-white border-t border-slate-200 py-4 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            © 2026 CloudCert Pro. All mock questions are for practice purposes.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AppShell;
