import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { MobileNav } from '../components/layout/MobileNav';
import { Sidebar } from '../components/layout/Sidebar';
import { appRoutes } from '../routes/appRoutes';

export function AppLayout() {
  const location = useLocation();
  const activeRoute = appRoutes.find((route) => location.pathname.startsWith(route.path));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
          <Header title={activeRoute?.label ?? 'Fazenda Cria'} />
          <main className="flex flex-1">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
