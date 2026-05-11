import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface SignUpResult {
  needsEmailConfirmation: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isOnline: boolean;
  isSupabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function authUnavailableMessage(isOnline: boolean) {
  if (!isSupabaseConfigured) {
    return 'Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar login online.';
  }

  if (!isOnline) {
    return 'Sem internet no momento. O login online fica indisponível, mas o app local continua funcionando.';
  }

  return 'Autenticação online indisponível no momento.';
}

function friendlyAuthError(error: unknown, isOnline: boolean) {
  if (!isOnline) {
    return authUnavailableMessage(false);
  }

  if (error instanceof Error) {
    if (/invalid login credentials/i.test(error.message)) {
      return 'E-mail ou senha inválidos.';
    }

    if (/email not confirmed/i.test(error.message)) {
      return 'Confirme seu e-mail antes de entrar.';
    }

    if (/failed to fetch|network/i.test(error.message)) {
      return 'Não foi possível conectar ao Supabase. Verifique a internet e tente novamente.';
    }

    return error.message;
  }

  return 'Não foi possível concluir a autenticação.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(getOnlineStatus);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
        }
      })
      .catch(() => {
        if (active) {
          setSession(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase || !isOnline) {
        throw new Error(authUnavailableMessage(isOnline));
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw new Error(friendlyAuthError(error, isOnline));
      }
    },
    [isOnline],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase || !isOnline) {
        throw new Error(authUnavailableMessage(isOnline));
      }

      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        throw new Error(friendlyAuthError(error, isOnline));
      }

      return {
        needsEmailConfirmation: Boolean(data.user && !data.session),
      };
    },
    [isOnline],
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      setSession(null);
      return;
    }

    const { error } = await supabase.auth.signOut({ scope: isOnline ? 'global' : 'local' });

    if (error) {
      throw new Error(friendlyAuthError(error, isOnline));
    }

    setSession(null);
  }, [isOnline]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isOnline,
      isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
    }),
    [isOnline, loading, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
