import { NavLink } from 'react-router-dom';
import { appRoutes } from '../../routes/appRoutes';
import { cn } from '../../utils/cn';

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="mb-6 flex items-center gap-3 px-2">
        <img src="/icons/icon.svg" alt="" className="h-11 w-11 rounded-2xl" />
        <div>
          <p className="text-base font-semibold text-slate-950">Fazenda Cria</p>
          <p className="text-sm text-slate-500">Gestão de cria</p>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="space-y-1">
        {appRoutes.map((route) => {
          const Icon = route.icon;

          return (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-field-600 text-white shadow-soft'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>{route.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
