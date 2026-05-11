import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-field-700">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Página não encontrada</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">O endereço acessado não existe neste app.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          <Home size={18} aria-hidden="true" />
          Ir para o Dashboard
        </Link>
      </section>
    </main>
  );
}
