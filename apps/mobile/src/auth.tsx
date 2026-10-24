import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  clearSession,
  login as loginRequest,
  refreshSession,
  register as registerRequest,
  type Session,
} from './api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthValue {
  status: AuthStatus;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    stateCode: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

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

  const register = useCallback<AuthValue['register']>(async (input) => {
    const payload = await registerRequest(input);
    setSession(payload);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setSession(null);
    setStatus('anonymous');
  }, []);

  const reload = useCallback(async () => {
    try {
      const payload = await refreshSession();
      setSession(payload);
      setStatus('authenticated');
    } catch {
      setSession(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, session, login, register, logout, reload }),
    [status, session, login, register, logout, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
