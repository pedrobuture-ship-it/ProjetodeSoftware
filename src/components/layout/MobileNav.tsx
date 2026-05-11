import { MoreHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { appRoutes } from '../../routes/appRoutes';
import { cn } from '../../utils/cn';

const primaryMobileRouteIds = ['dashboard', 'animais', 'matrizes', 'inseminacoes'];

export function MobileNav() {
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const primaryRoutes = appRoutes.filter((route) => primaryMobileRouteIds.includes(route.id));
  const secondaryRoutes = appRoutes.filter((route) => !primaryMobileRouteIds.includes(route.id));
  const hasActiveSecondaryRoute = secondaryRoutes.some((route) => location.pathname.startsWith(route.path));

  return (
    <>
      {isMoreOpen ? (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-x-0 top-0 bottom-20 z-20 bg-slate-950/10 backdrop-blur-[1px] lg:hidden"
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="fixed inset-x-3 bottom-[5.75rem] z-40 rounded-lg border border-slate-200 bg-white p-2 shadow-strong lg:hidden">
            <div className="grid grid-cols-2 gap-1">
              {secondaryRoutes.map((route) => {
                const Icon = route.icon;

                return (
                  <NavLink
                    key={route.path}
                    to={route.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition',
                        isActive
                          ? 'bg-field-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                      )
                    }
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span className="min-w-0 truncate">{route.shortLabel}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <nav
        aria-label="Navegação mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-12px_30px_-24px_rgba(15,23,42,0.55)] backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-5 gap-1">
          {primaryRoutes.map((route) => {
            const Icon = route.icon;

            return (
              <NavLink
                key={route.path}
                to={route.path}
                onClick={() => setIsMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.68rem] font-semibold leading-none transition',
                    isActive
                      ? 'bg-field-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                <Icon size={18} aria-hidden="true" />
                <span className="max-w-full truncate">{route.shortLabel}</span>
              </NavLink>
            );
          })}

          <button
            type="button"
            aria-label={isMoreOpen ? 'Fechar mais opções' : 'Abrir mais opções'}
            aria-expanded={isMoreOpen}
            className={cn(
              'flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.68rem] font-semibold leading-none transition',
              hasActiveSecondaryRoute || isMoreOpen
                ? 'bg-field-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            )}
            onClick={() => setIsMoreOpen((current) => !current)}
          >
            {isMoreOpen ? <X size={18} aria-hidden="true" /> : <MoreHorizontal size={18} aria-hidden="true" />}
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
