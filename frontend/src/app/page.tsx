'use client';

import React, { useState } from 'react';
import { Briefcase, Lock, User } from '@phosphor-icons/react';
import { useAuth } from '@/context/AuthContext';
import { useCapacitor } from '@/components/CapacitorProvider';

export default function LoginPage() {
  const { login, loading: authLoading } = useAuth();
  const { hapticImpact } = useCapacitor();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticImpact();
    setError('');
    setFormLoading(true);

    try {
      await login(email, password);
      // Redirection is handled by AuthProvider's useEffect
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      setFormLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <Briefcase size={48} className="text-blue-500 animate-pulse mx-auto" />
          <div className="text-slate-500 font-mono text-sm animate-pulse">Verifying...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 animate-in fade-in duration-500">
      <div className="w-full max-w-sm">
        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-8">
          <Briefcase size={56} weight="duotone" className="text-blue-400 mb-4" />
          <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider text-center">
            Placement Prep
          </h1>
          <p className="text-slate-400 text-sm mt-2">AI-Powered Preparation</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-6 rounded-xl border-slate-800/50 bg-slate-900/40 shadow-2xl">
          {error && (
            <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 mb-4 text-sm text-red-400 animate-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-base pl-10 pr-3 py-3.5 outline-none transition-all"
                  placeholder="Enter email"
                  disabled={formLoading}
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-base pl-10 pr-3 py-3.5 outline-none transition-all"
                  placeholder="••••••••"
                  disabled={formLoading}
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg font-medium tracking-wide uppercase text-sm px-4 py-4 shadow-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-ripple"
              style={{ minHeight: 'var(--touch-target)' }}
            >
              {formLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-6 p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Demo:</p>
            <div className="space-y-1 text-xs text-slate-400">
              <div>student@placementprep.com</div>
              <div className="text-slate-500">Password: Student@123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
