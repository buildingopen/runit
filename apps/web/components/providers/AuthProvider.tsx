'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface AuthState {
  user: null;
  session: null;
  loading: false;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: false,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: null, session: null, loading: false, signOut: async () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}
