import { CheckCircle2, Lock, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface SyncAuthGuardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function SyncAuthGuard({ title, description, children }: SyncAuthGuardProps) {
  const { user, isOnline, isSupabaseConfigured } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <div className="flex items-start gap-3">
          <Lock size={20} aria-hidden="true" />
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 leading-6">{description}</p>
            <p className="mt-2 font-medium">
              Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente para ativar esta área.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <div className="flex items-start gap-3">
          <WifiOff size={20} className="text-slate-500" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-slate-950">{title}</h3>
            <p className="mt-1 leading-6">
              Sem internet agora. Os dados locais continuam disponíveis, e esta área online poderá ser usada
              quando a conexão voltar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lock size={20} className="text-field-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-950">{title}</h3>
              <p className="mt-1 leading-6">{description}</p>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700"
          >
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-field-100 bg-field-50 p-4 text-sm text-field-800">
      <div className="mb-3 flex items-start gap-3">
        <CheckCircle2 size={20} aria-hidden="true" />
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 leading-6">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
