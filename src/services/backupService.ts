import { db } from '../db';
import type { OfflineBackup, OfflineBackupData, LocalTableName } from '../types';
import { nowIso } from '../utils/date';

const BACKUP_VERSION = 1;

const tableNames: LocalTableName[] = [
  'animals',
  'inseminations',
  'pregnancyDiagnoses',
  'births',
  'semen',
  'sanitaryManagement',
  'lots',
  'farmSettings',
  'syncQueue',
];

function assertBackupShape(value: unknown): asserts value is OfflineBackup {
  if (!value || typeof value !== 'object') {
    throw new Error('Backup inválido.');
  }

  const backup = value as OfflineBackup;

  if (backup.app !== 'fazenda-cria' || !backup.data || typeof backup.data !== 'object') {
    throw new Error('Backup não pertence a este aplicativo.');
  }

  for (const tableName of tableNames) {
    if (!Array.isArray(backup.data[tableName])) {
      throw new Error(`Tabela ausente ou inválida no backup: ${tableName}.`);
    }
  }
}

export async function exportLocalDatabase(): Promise<OfflineBackup> {
  return db.transaction('r', db.tables, async () => {
    const data: OfflineBackupData = {
      animals: await db.animals.toArray(),
      inseminations: await db.inseminations.toArray(),
      pregnancyDiagnoses: await db.pregnancyDiagnoses.toArray(),
      births: await db.births.toArray(),
      semen: await db.semen.toArray(),
      sanitaryManagement: await db.sanitaryManagement.toArray(),
      lots: await db.lots.toArray(),
      farmSettings: await db.farmSettings.toArray(),
      syncQueue: await db.syncQueue.toArray(),
    };

    return {
      app: 'fazenda-cria',
      version: BACKUP_VERSION,
      exported_at: nowIso(),
      data,
    };
  });
}

export async function exportLocalDatabaseToJson() {
  const backup = await exportLocalDatabase();
  return JSON.stringify(backup, null, 2);
}

export interface BackupSummary {
  exported_at: string;
  version: number;
  counts: Record<LocalTableName, number>;
}

export interface ImportBackupOptions {
  mode?: 'replace' | 'merge';
}

export function getBackupSummary(backup: OfflineBackup): BackupSummary {
  return {
    exported_at: backup.exported_at,
    version: backup.version,
    counts: tableNames.reduce(
      (acc, tableName) => ({
        ...acc,
        [tableName]: backup.data[tableName].length,
      }),
      {} as Record<LocalTableName, number>,
    ),
  };
}

export function parseBackupJson(backupInput: string) {
  let backup: unknown;

  try {
    backup = JSON.parse(backupInput);
  } catch {
    throw new Error('O arquivo selecionado não é um JSON válido.');
  }

  assertBackupShape(backup);
  return backup;
}

export function validateBackupJson(backupInput: string) {
  return getBackupSummary(parseBackupJson(backupInput));
}

export async function importBackupJson(
  backupInput: string | OfflineBackup,
  options: ImportBackupOptions = {},
) {
  const backup = typeof backupInput === 'string' ? parseBackupJson(backupInput) : backupInput;
  const mode = options.mode ?? 'replace';

  assertBackupShape(backup);

  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      await Promise.all(db.tables.map((table) => table.clear()));
    }

    await db.animals.bulkPut(backup.data.animals);
    await db.inseminations.bulkPut(backup.data.inseminations);
    await db.pregnancyDiagnoses.bulkPut(backup.data.pregnancyDiagnoses);
    await db.births.bulkPut(backup.data.births);
    await db.semen.bulkPut(backup.data.semen);
    await db.sanitaryManagement.bulkPut(backup.data.sanitaryManagement);
    await db.lots.bulkPut(backup.data.lots);
    await db.farmSettings.bulkPut(backup.data.farmSettings);
    await db.syncQueue.bulkPut(backup.data.syncQueue);
  });

  return backup;
}
