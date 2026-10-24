import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  loginRequest,
  logoutRequest,
  refreshSession,
  registerRequest,
  setAccessToken,
  type SessionPayload,
} from './api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  session: SessionPayload | null;
  role: SessionPayload['role'] | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    stateCode: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the session after a settings change, without a reload. */
  reloadSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<SessionPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    refreshSession()
      .then((payload) => {
        if (cancelled) return;
        setSession(payload);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setSession(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await loginRequest(email, password);
    setSession(payload);
    setStatus('authenticated');
  }, []);

  const register = useCallback<AuthContextValue['register']>(async (input) => {
    const payload = await registerRequest(input);
    setSession(payload);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setSession(null);
    setStatus('anonymous');
  }, []);

  const reloadSession = useCallback(async () => {
    try {
      const payload = await refreshSession();
      setSession(payload);
      setStatus('authenticated');
    } catch {
      setAccessToken(null);
      setSession(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      role: session?.role ?? null,
      login,
      register,
      logout,
      reloadSession,
    }),
    [status, session, login, register, logout, reloadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

/** Owner and admin only actions, mirroring the server role guard. */
export function useCanManage(): boolean {
  const { role } = useAuth();

  return role === 'owner' || role === 'admin';
}
