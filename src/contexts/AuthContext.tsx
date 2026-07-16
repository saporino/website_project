import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  roles: string[];
  hasRole: (code: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        setProfile(null);
        return;
      }
      setProfile(data);
      // Papéis do RBAC (aditivo — não substitui os checks de is_admin existentes)
      await loadRoles(userId);
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role_code')
        .eq('user_id', userId)
        .eq('is_active', true);
      setRoles((data || []).map((r: { role_code: string }) => r.role_code));
    } catch {
      setRoles([]);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });

    if (!error && data?.user?.identities && data.user.identities.length === 0) {
      return { error: new Error('Este e-mail já está cadastrado. Por favor, faça login no botão ENTRAR no topo da página.') };
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('user_profiles')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, ...data });
    }

    return { error };
  };

  const resetPassword = async (email: string) => {
    // Envia via nossa Edge Function (Resend), não pelo e-mail padrão do Supabase.
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || r.error) return { error: new Error(r.error || 'Não foi possível enviar o e-mail agora.') };
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Falha de conexão.') };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        roles,
        hasRole: (code: string) => roles.includes(code),
        signIn,
        signUp,
        signOut,
        updateProfile,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
