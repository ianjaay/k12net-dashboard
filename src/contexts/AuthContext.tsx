import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  onAuthChange,
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  loginWithMicrosoft,
  loginAsGuest as firebaseLoginAsGuest,
  loginAsDemo as firebaseLoginAsDemo,
  logout as firebaseLogout,
} from '../lib/auth';
import { db } from '../lib/firebase';
import type { AppRole, UserStatus } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  appRole: AppRole;
  userStatus: UserStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  loginMicrosoft: () => Promise<void>;
  loginGuest: () => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [appRole, setAppRole] = useState<AppRole>('user');
  const [userStatus, setUserStatus] = useState<UserStatus>('active');

  useEffect(() => {
    return onAuthChange((u) => {
      setUser(u);
      setAuthResolved(true);
      if (!u || u.isAnonymous) {
        setAppRole('user');
        setUserStatus('active');
        setProfileLoading(false);
      } else {
        setProfileLoading(true);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user || user.isAnonymous) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        const data = snap.data() as { role?: AppRole; status?: UserStatus } | undefined;
        setAppRole(data?.role ?? 'user');
        setUserStatus(data?.status ?? 'active');
      } catch {
        if (!cancelled) {
          setAppRole('user');
          setUserStatus('active');
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    void loadProfile();
    return () => { cancelled = true; };
  }, [user]);

  const loading = !authResolved || profileLoading;

  const isGuest = !!user?.isAnonymous;

  const login = async (email: string, password: string) => {
    await loginWithEmail(email, password);
  };
  const register = async (email: string, password: string, name: string) => {
    await registerWithEmail(email, password, name);
  };
  const loginGoogleFn = async () => {
    await loginWithGoogle();
  };
  const loginMicrosoftFn = async () => {
    await loginWithMicrosoft();
  };
  const loginGuestFn = async () => {
    await firebaseLoginAsGuest();
  };
  const loginDemoFn = async () => {
    await firebaseLoginAsDemo();
  };
  const logout = async () => {
    await firebaseLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f9fd' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#8392a5' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user, loading, isGuest, appRole, userStatus,
      login, register,
      loginGoogle: loginGoogleFn,
      loginMicrosoft: loginMicrosoftFn,
      loginGuest: loginGuestFn,
      loginDemo: loginDemoFn,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
