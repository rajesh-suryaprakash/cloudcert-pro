import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BrainCircuit } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface AuthFormProps {
  onSuccess: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const { login, register, forgotPassword, resetPassword } = useAuth();

  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setIsSubmitting(true);
    try {
      if (authView === 'register') {
        await register(email, password, displayName);
        onSuccess();
      } else if (authView === 'login') {
        await login(email, password);
        onSuccess();
      } else if (authView === 'forgot') {
        await forgotPassword(email);
        setAuthMessage('Check your email for a reset link.');
        setAuthView('reset');
      } else if (authView === 'reset') {
        await resetPassword(email, resetCode, password);
        setAuthMessage('Password reset successful! Please sign in.');
        setAuthView('login');
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-10 space-y-8"
      >
        <div className="bg-indigo-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
          <BrainCircuit className="text-white w-10 h-10" />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-black text-slate-900">CloudCert Pro</h1>
          <p className="text-slate-500">
            {authView === 'register'
              ? 'Create your account to start practicing.'
              : authView === 'forgot'
                ? 'Enter your email to reset your password.'
                : authView === 'reset'
                  ? 'Enter the code sent to your email.'
                  : 'Sign in to master your cloud certifications.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {authView === 'register' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Full Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-100 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
                placeholder="John Doe"
                required
              />
            </div>
          )}

          {authView !== 'reset' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-100 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
                placeholder="alex@example.com"
                required
              />
            </div>
          )}

          {authView === 'reset' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Reset Code
              </label>
              <input
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-100 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
                placeholder="123456"
                required
              />
            </div>
          )}

          {authView !== 'forgot' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                {authView === 'reset' ? 'New Password' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-100 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {authError && <p className="text-xs font-bold text-rose-600 px-1">{authError}</p>}
          {authMessage && <p className="text-xs font-bold text-emerald-600 px-1">{authMessage}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
          >
            {isSubmitting
              ? 'Processing...'
              : authView === 'register'
                ? 'Create Account'
                : authView === 'forgot'
                  ? 'Send Reset Code'
                  : authView === 'reset'
                    ? 'Reset Password'
                    : 'Sign In'}
          </button>
        </form>

        <div className="text-center space-y-2">
          {authView === 'login' && (
            <>
              <button
                onClick={() => setAuthView('register')}
                className="block w-full text-sm font-bold text-indigo-600 hover:underline"
              >
                Don't have an account? Sign Up
              </button>
              <button
                onClick={() => setAuthView('forgot')}
                className="block w-full text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
              >
                Forgot Password?
              </button>
            </>
          )}
          {(authView === 'register' || authView === 'forgot' || authView === 'reset') && (
            <button
              onClick={() => setAuthView('login')}
              className="text-sm font-bold text-indigo-600 hover:underline"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

