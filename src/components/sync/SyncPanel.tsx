import {
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  createRemoteFarm,
  getLastSyncAt,
  getPendingSyncCount,
  getSelectedFarmId,
  listRemoteFarms,
  runSync,
  setSelectedFarmId,
  type RemoteFarm,
  type SyncConnectionStatus,
  type SyncMode,
  type SyncSummary,
} from '../../services/syncService';
import { formatDatePtBr } from '../../utils/format';

const statusLabels: Record<SyncConnectionStatus, string> = {
  offline: 'Offline',
  online: 'Online',
  syncing: 'Sincronizando',
  synced: 'Sincronizado',
  error: 'Erro',
};

const statusStyles: Record<SyncConnectionStatus, string> = {
  offline: 'border-slate-200 bg-slate-100 text-slate-700',
  online: 'border-sky-100 bg-sky-50 text-sky-700',
  syncing: 'border-amber-100 bg-amber-50 text-amber-700',
  synced: 'border-field-100 bg-field-50 text-field-700',
  error: 'border-red-100 bg-red-50 text-red-700',
};

function summarizeSync(summary: SyncSummary) {
  const base = `${summary.pushed} enviado(s), ${summary.pulled} baixado(s), ${summary.conflictsResolved} conflito(s) resolvido(s), ${summary.skipped} ignorado(s).`;

  if (summary.errors.length > 0) {
    return `${base} ${summary.errors.length} erro(s) encontrado(s).`;
  }

  return base;
}

export function SyncPanel() {
  const { user, isOnline, isSupabaseConfigured } = useAuth();
  const [status, setStatus] = useState<SyncConnectionStatus>(isOnline ? 'online' : 'offline');
  const [farms, setFarms] = useState<RemoteFarm[]>([]);
  const [selectedFarmId, setSelectedFarmIdState] = useState('');
  const [newFarmName, setNewFarmName] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [loadingFarms, setLoadingFarms] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFarm = useMemo(
    () => farms.find((farm) => farm.id === selectedFarmId),
    [farms, selectedFarmId],
  );

  const canSync = Boolean(isSupabaseConfigured && isOnline && user && selectedFarmId);

  async function refreshLocalStatus() {
    setPendingCount(await getPendingSyncCount());
    setLastSyncAt(getLastSyncAt());
  }

  async function loadFarms() {
    if (!isSupabaseConfigured || !isOnline || !user) {
      await refreshLocalStatus();
      return;
    }

    setLoadingFarms(true);
    setError(null);

    try {
      const remoteFarms = await listRemoteFarms();
      const storedFarmId = getSelectedFarmId();
      const nextSelectedFarmId =
        storedFarmId && remoteFarms.some((farm) => farm.id === storedFarmId)
          ? storedFarmId
          : remoteFarms[0]?.id ?? '';

      setFarms(remoteFarms);
      setSelectedFarmIdState(nextSelectedFarmId);

      if (nextSelectedFarmId) {
        const nextFarm = remoteFarms.find((farm) => farm.id === nextSelectedFarmId);
        setSelectedFarmId(nextSelectedFarmId, nextFarm?.name);
      }

      setStatus('online');
    } catch (loadError) {
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar fazendas.');
    } finally {
      setLoadingFarms(false);
      await refreshLocalStatus();
    }
  }

  useEffect(() => {
    setStatus((currentStatus) => {
      if (currentStatus === 'syncing') {
        return currentStatus;
      }

      return isOnline ? 'online' : 'offline';
    });
  }, [isOnline]);

  useEffect(() => {
    void loadFarms();
  }, [isOnline, isSupabaseConfigured, user?.id]);

  async function handleCreateFarm() {
    if (!user) {
      setError('Entre com sua conta para criar uma fazenda online.');
      return;
    }

    setNotice(null);
    setError(null);
    setLoadingFarms(true);

    try {
      const farm = await createRemoteFarm(newFarmName, user.id);
      setFarms((currentFarms) => [...currentFarms, farm].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setSelectedFarmIdState(farm.id);
      setNewFarmName('');
      setNotice('Fazenda online criada e selecionada.');
      setStatus('online');
    } catch (createError) {
      setStatus('error');
      setError(createError instanceof Error ? createError.message : 'Não foi possível criar a fazenda.');
    } finally {
      setLoadingFarms(false);
      await refreshLocalStatus();
    }
  }

  function handleSelectFarm(farmId: string) {
    const farm = farms.find((item) => item.id === farmId);

    setSelectedFarmIdState(farmId);
    setSelectedFarmId(farmId, farm?.name);
    setNotice('Fazenda selecionada para sincronização.');
  }

  async function handleSync(mode: SyncMode) {
    if (!user) {
      setError('Entre com sua conta para sincronizar.');
      return;
    }

    if (!selectedFarmId) {
      setError('Selecione ou crie uma fazenda antes de sincronizar.');
      return;
    }

    if (
      (mode === 'pull' || mode === 'two_way') &&
      !window.confirm(
        'A nuvem pode atualizar registros locais mais antigos e aplicar exclusões lógicas por deleted_at. Deseja continuar?',
      )
    ) {
      return;
    }

    setStatus('syncing');
    setNotice(null);
    setError(null);

    try {
      const summary = await runSync({ farmId: selectedFarmId, mode, userId: user.id });

      if (summary.errors.length > 0) {
        setStatus('error');
        setError(summary.errors.slice(0, 3).join(' | '));
      } else {
        setStatus('synced');
        setNotice(summarizeSync(summary));
      }
    } catch (syncError) {
      setStatus('error');
      setError(syncError instanceof Error ? syncError.message : 'Não foi possível sincronizar.');
    } finally {
      await refreshLocalStatus();
    }
  }

  function handleShowLastSync() {
    setNotice(
      lastSyncAt
        ? `Última sincronização concluída em ${formatDatePtBr(lastSyncAt)}.`
        : 'Ainda não há sincronização concluída neste dispositivo.',
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Sincronização Supabase</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            O IndexedDB continua sendo a base principal. A nuvem serve para backup e uso em vários
            dispositivos.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${statusStyles[status]}`}
        >
          {status === 'syncing' ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : status === 'offline' ? (
            <WifiOff size={16} aria-hidden="true" />
          ) : status === 'synced' ? (
            <CheckCircle2 size={16} aria-hidden="true" />
          ) : (
            <Wifi size={16} aria-hidden="true" />
          )}
          {statusLabels[status]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Registros pendentes</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
          <p className="text-xs font-medium text-slate-500">Última sincronização</p>
          <p className="mt-1 font-semibold text-slate-950">
            {lastSyncAt ? formatDatePtBr(lastSyncAt) : 'Nenhuma sincronização concluída'}
          </p>
        </div>
      </div>

      {!isSupabaseConfigured ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para habilitar sincronização.
        </div>
      ) : !user ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p>Entre com sua conta para selecionar uma fazenda e sincronizar com a nuvem.</p>
          <Link
            to="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700"
          >
            Entrar
          </Link>
        </div>
      ) : !isOnline ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Sem internet no momento. Novos dados continuam salvos localmente com status pendente.
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Fazenda online</span>
              <select
                value={selectedFarmId}
                onChange={(event) => handleSelectFarm(event.target.value)}
                disabled={loadingFarms || farms.length === 0}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {farms.length === 0 ? (
                  <option value="">Nenhuma fazenda online</option>
                ) : (
                  farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Criar fazenda online</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={newFarmName}
                  onChange={(event) => setNewFarmName(event.target.value)}
                  placeholder="Nome da fazenda"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
                />
                <button
                  type="button"
                  onClick={handleCreateFarm}
                  disabled={loadingFarms || !newFarmName.trim()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LinkIcon size={17} aria-hidden="true" />
                  Criar
                </button>
              </div>
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-2 xl:flex-row">
            <button
              type="button"
              onClick={() => void handleSync('two_way')}
              disabled={!canSync || status === 'syncing'}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={18} aria-hidden="true" />
              Sincronizar agora
            </button>
            <button
              type="button"
              onClick={() => void handleSync('push')}
              disabled={!canSync || status === 'syncing'}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CloudUpload size={18} aria-hidden="true" />
              Enviar dados locais para nuvem
            </button>
            <button
              type="button"
              onClick={() => void handleSync('pull')}
              disabled={!canSync || status === 'syncing'}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CloudDownload size={18} aria-hidden="true" />
              Baixar dados da nuvem
            </button>
            <button
              type="button"
              onClick={handleShowLastSync}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Ver última sincronização
            </button>
          </div>
        </>
      )}

      {selectedFarm ? (
        <p className="mt-3 text-xs font-medium text-slate-500">
          Fazenda selecionada: {selectedFarm.name}
        </p>
      ) : null}

      {notice ? (
        <div className="mt-4 rounded-lg border border-field-100 bg-field-50 px-3 py-2 text-sm font-medium text-field-700">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}
