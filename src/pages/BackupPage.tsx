import { AlertTriangle, Download, FileJson, Upload } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { SyncPanel } from '../components/sync/SyncPanel';
import {
  exportLocalDatabaseToJson,
  importBackupJson,
  validateBackupJson,
  type BackupSummary,
} from '../services/backupService';
import type { LocalTableName } from '../types';
import { downloadTextFile, timestampForFilename } from '../utils/download';
import { formatDatePtBr } from '../utils/format';

type ImportMode = 'replace' | 'merge';

const LAST_BACKUP_KEY = 'fazenda-cria:last-backup-at';

const tableLabels: Record<LocalTableName, string> = {
  animals: 'Animais',
  inseminations: 'Inseminações',
  pregnancyDiagnoses: 'Diagnósticos',
  births: 'Partos',
  semen: 'Sêmen',
  sanitaryManagement: 'Manejo sanitário',
  lots: 'Lotes',
  farmSettings: 'Configurações',
  syncQueue: 'Fila de sincronização',
};

function readLastBackupAt() {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

function saveLastBackupAt(value: string) {
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, value);
  } catch {
    // O backup continua funcionando mesmo que o navegador bloqueie localStorage.
  }
}

export function BackupPage() {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [backupJson, setBackupJson] = useState<string | null>(null);
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLastBackupAt(readLastBackupAt());
  }, []);

  const summaryEntries = useMemo(() => {
    if (!backupSummary) {
      return [];
    }

    return (Object.entries(backupSummary.counts) as Array<[LocalTableName, number]>).map(
      ([tableName, count]) => ({
        label: tableLabels[tableName],
        count,
      }),
    );
  }, [backupSummary]);

  async function handleExport() {
    setBusy(true);
    setNotice(null);
    setError(null);

    try {
      const json = await exportLocalDatabaseToJson();
      downloadTextFile(
        json,
        `fazenda-cria-backup-${timestampForFilename()}.json`,
        'application/json;charset=utf-8',
      );
      const now = new Date().toISOString();
      saveLastBackupAt(now);
      setLastBackupAt(now);
      setNotice('Backup JSON gerado com sucesso neste dispositivo.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Não foi possível exportar o backup.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setNotice(null);
    setError(null);
    setBackupJson(null);
    setBackupSummary(null);

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const summary = validateBackupJson(content);
      setBackupJson(content);
      setBackupSummary(summary);
      setNotice('Arquivo validado. Revise as informações antes de importar.');
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Não foi possível validar o arquivo de backup.',
      );
    } finally {
      event.target.value = '';
    }
  }

  async function handleImport() {
    if (!backupJson || !backupSummary) {
      setError('Selecione e valide um arquivo JSON antes de importar.');
      return;
    }

    const confirmationMessage =
      importMode === 'replace'
        ? 'Isso vai apagar os dados locais atuais e substituir pelo conteúdo do backup. Deseja continuar?'
        : 'Isso vai mesclar o backup com os dados locais atuais. Registros com o mesmo id serão atualizados. Deseja continuar?';

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setBusy(true);
    setNotice(null);
    setError(null);

    try {
      await importBackupJson(backupJson, { mode: importMode });
      const now = new Date().toISOString();
      saveLastBackupAt(now);
      setLastBackupAt(now);
      setBackupJson(null);
      setNotice(
        importMode === 'replace'
          ? 'Backup importado substituindo os dados locais.'
          : 'Backup importado e mesclado aos dados locais.',
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Não foi possível importar o backup.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Backup"
      description="Exporte e importe todos os dados offline salvos no IndexedDB deste dispositivo."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-field-50 p-2 text-field-700">
              <FileJson size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-950">Backup local JSON</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                O arquivo gerado contém todas as tabelas locais, incluindo fila de sincronização futura.
              </p>
            </div>
          </div>

          <dl className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <dt className="font-medium text-slate-500">Último backup exportado/importado</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {lastBackupAt ? formatDatePtBr(lastBackupAt) : 'Nenhum backup registrado neste dispositivo'}
            </dd>
          </dl>

          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Download size={18} aria-hidden="true" />
            Exportar backup JSON
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-sky-50 p-2 text-sky-700">
              <Upload size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-950">Importar backup</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                O arquivo é validado antes de qualquer alteração no banco local.
              </p>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-700">Arquivo JSON</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              disabled={busy}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:h-11 file:border-0 file:bg-slate-100 file:px-4 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          {backupSummary ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-field-100 bg-field-50 p-3 text-sm text-field-800">
                <p className="font-semibold">Backup válido</p>
                <p className="mt-1">
                  Versão {backupSummary.version} gerada em {formatDatePtBr(backupSummary.exported_at)}.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {summaryEntries.map((entry) => (
                  <div key={entry.label} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-medium text-slate-500">{entry.label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{entry.count}</p>
                  </div>
                ))}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-950">Como importar</legend>
                <label className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-1"
                  />
                  <span>
                    <strong>Substituir dados locais.</strong> Apaga as tabelas atuais antes de importar o
                    backup.
                  </span>
                </label>
                <label className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-1"
                  />
                  <span>
                    <strong>Mesclar dados.</strong> Mantém registros atuais e atualiza registros com o
                    mesmo id.
                  </span>
                </label>
              </fieldset>

              <button
                type="button"
                onClick={handleImport}
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Upload size={18} aria-hidden="true" />
                Importar backup validado
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {notice ? (
        <div className="rounded-lg border border-field-100 bg-field-50 px-4 py-3 text-sm font-medium text-field-700">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <SyncPanel />
    </PageShell>
  );
}
