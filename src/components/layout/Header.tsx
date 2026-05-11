import { Building2, LogIn, LogOut, UserCircle, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveFarmContext, subscribeActiveFarmChange } from '../../services/farmContextService';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user, isOnline, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [activeFarmName, setActiveFarmName] = useState(getActiveFarmContext().name);

  useEffect(() => {
    return subscribeActiveFarmChange((context) => {
      setActiveFarmName(context.name);
    });
  }, []);

  async function handleLogout() {
    setLogoutError(null);

    try {
      await signOut();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Não foi possível sair.');
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-field-700">
            Fazenda Cria
          </p>
          <h1 className="truncate text-xl font-semibold text-slate-950 md:text-2xl">{title}</h1>
          {activeFarmName ? (
            <p className="mt-1 flex items-center gap-1 truncate text-xs font-medium text-slate-500">
              <Building2 size={13} aria-hidden="true" />
              {activeFarmName}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-field-100 bg-field-50 px-3 py-2 text-sm font-medium text-field-700 sm:inline-flex">
            <WifiOff size={16} aria-hidden="true" />
            {isOnline ? 'Offline-first' : 'Sem internet'}
          </span>
          {user ? (
            <div className="flex items-center gap-2">
              <span
                className="hidden max-w-[14rem] items-center gap-2 truncate rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm md:inline-flex"
                title={user.email ?? 'Usuário logado'}
              >
                <UserCircle size={16} aria-hidden="true" />
                <span className="truncate">{user.email}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label="Sair da conta"
                title={logoutError ?? 'Sair da conta'}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-field-100 hover:text-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
              aria-label="Acessar login"
              title="Acessar login"
            >
              <LogIn size={18} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
