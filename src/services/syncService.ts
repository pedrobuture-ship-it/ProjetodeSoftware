import type { Table } from 'dexie';
import { db } from '../db';
import { supabase } from '../lib/supabase';
import type {
  Animal,
  Birth,
  FarmSettings,
  Insemination,
  LocalEntity,
  Lot,
  PregnancyDiagnosis,
  SanitaryManagement,
  Semen,
  SyncQueueEntityName,
} from '../types';
import { createLocalId } from '../utils/id';
import { normalizeIdentifier } from '../utils/validation';
import {
  getActiveFarmId,
  setActiveFarmContext,
} from './farmContextService';

export type SyncConnectionStatus = 'offline' | 'online' | 'syncing' | 'synced' | 'error';
export type SyncMode = 'two_way' | 'push' | 'pull';

export interface RemoteFarm {
  id: string;
  name: string;
  updated_at?: string;
}

export interface RemoteFarmMember {
  id: string;
  farm_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface SyncSummary {
  pushed: number;
  pulled: number;
  conflictsResolved: number;
  skipped: number;
  errors: string[];
  startedAt: string;
  completedAt: string;
}

interface SyncContext {
  localById: Record<SyncQueueEntityName, Map<string, LocalEntity>>;
  localByRemote: Record<SyncQueueEntityName, Map<string, LocalEntity>>;
  remoteByLocal: Record<SyncQueueEntityName, Map<string, string>>;
}

interface RelationConfig {
  field: string;
  target: SyncQueueEntityName;
  required?: boolean;
}

interface SyncTableConfig<T extends LocalEntity> {
  localName: SyncQueueEntityName;
  remoteName: string;
  idPrefix: string;
  table: Table<T, string>;
  relations?: RelationConfig[];
}

type AnyLocalEntity =
  | Animal
  | Insemination
  | PregnancyDiagnosis
  | Birth
  | Semen
  | SanitaryManagement
  | Lot
  | FarmSettings;

type RemoteRow = Record<string, unknown> & {
  id: string;
  farm_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

const LAST_SYNC_KEY = 'fazenda-cria:last-sync-at';

const syncTables: Array<SyncTableConfig<AnyLocalEntity>> = [
  {
    localName: 'lots',
    remoteName: 'lots',
    idPrefix: 'lot',
    table: db.lots as Table<AnyLocalEntity, string>,
  },
  {
    localName: 'semen',
    remoteName: 'semen',
    idPrefix: 'semen',
    table: db.semen as Table<AnyLocalEntity, string>,
  },
  {
    localName: 'animals',
    remoteName: 'animals',
    idPrefix: 'animal',
    table: db.animals as Table<AnyLocalEntity, string>,
    relations: [
      { field: 'lot_id', target: 'lots' },
      { field: 'mother_id', target: 'animals' },
      { field: 'father_id', target: 'animals' },
    ],
  },
  {
    localName: 'inseminations',
    remoteName: 'inseminations',
    idPrefix: 'insemination',
    table: db.inseminations as Table<AnyLocalEntity, string>,
    relations: [
      { field: 'animal_id', target: 'animals', required: true },
      { field: 'semen_id', target: 'semen' },
      { field: 'bull_id', target: 'animals' },
    ],
  },
  {
    localName: 'pregnancyDiagnoses',
    remoteName: 'pregnancy_diagnoses',
    idPrefix: 'pregnancy',
    table: db.pregnancyDiagnoses as Table<AnyLocalEntity, string>,
    relations: [
      { field: 'animal_id', target: 'animals', required: true },
      { field: 'insemination_id', target: 'inseminations' },
    ],
  },
  {
    localName: 'births',
    remoteName: 'births',
    idPrefix: 'birth',
    table: db.births as Table<AnyLocalEntity, string>,
    relations: [
      { field: 'animal_id', target: 'animals', required: true },
      { field: 'calf_id', target: 'animals' },
    ],
  },
  {
    localName: 'sanitaryManagement',
    remoteName: 'sanitary_management',
    idPrefix: 'sanitary',
    table: db.sanitaryManagement as Table<AnyLocalEntity, string>,
    relations: [
      { field: 'animal_id', target: 'animals' },
      { field: 'lot_id', target: 'lots' },
    ],
  },
  {
    localName: 'farmSettings',
    remoteName: 'farm_settings',
    idPrefix: 'settings',
    table: db.farmSettings as Table<AnyLocalEntity, string>,
  },
];

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase não configurado. Verifique o arquivo .env.');
  }

  return supabase;
}

function assertOnline() {
  if (!navigator.onLine) {
    throw new Error('Sem internet no momento. Os dados continuam salvos localmente.');
  }
}

function getTableConfig(name: SyncQueueEntityName) {
  return syncTables.find((table) => table.localName === name);
}

function isRemoteNewer(remote: RemoteRow, local: LocalEntity) {
  return new Date(remote.updated_at).getTime() > new Date(local.updated_at).getTime();
}

function makeEmptyEntityMap<T>() {
  return {
    animals: new Map<string, T>(),
    inseminations: new Map<string, T>(),
    pregnancyDiagnoses: new Map<string, T>(),
    births: new Map<string, T>(),
    semen: new Map<string, T>(),
    sanitaryManagement: new Map<string, T>(),
    lots: new Map<string, T>(),
    farmSettings: new Map<string, T>(),
  };
}

async function buildSyncContext(): Promise<SyncContext> {
  const localById = makeEmptyEntityMap<LocalEntity>();
  const localByRemote = makeEmptyEntityMap<LocalEntity>();
  const remoteByLocal = makeEmptyEntityMap<string>();

  for (const config of syncTables) {
    const records = await config.table.toArray();

    for (const record of records) {
      localById[config.localName].set(record.id, record);

      if (record.remote_id) {
        localByRemote[config.localName].set(record.remote_id, record);
        remoteByLocal[config.localName].set(record.id, record.remote_id);
      }
    }
  }

  return { localById, localByRemote, remoteByLocal };
}

function getRemoteIdForLocal(
  context: SyncContext,
  target: SyncQueueEntityName,
  localId?: string,
) {
  return localId ? context.remoteByLocal[target].get(localId) : undefined;
}

function getLocalIdForRemote(
  context: SyncContext,
  target: SyncQueueEntityName,
  remoteId?: string | null,
) {
  const localEntity = remoteId ? context.localByRemote[target].get(remoteId) : undefined;
  return localEntity?.id;
}

function cleanRemotePayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value === undefined ? null : value]),
  );
}

function toRemotePayload(
  config: SyncTableConfig<AnyLocalEntity>,
  record: AnyLocalEntity,
  farmId: string,
  userId: string,
  context: SyncContext,
  includeCreatedBy: boolean,
) {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === 'id' || key === 'remote_id' || key === 'sync_status') {
      continue;
    }

    payload[key] = value;
  }

  payload.farm_id = farmId;

  if (includeCreatedBy) {
    payload.created_by = userId;
  }

  for (const relation of config.relations ?? []) {
    const localRelationId = record[relation.field as keyof AnyLocalEntity] as string | undefined;
    const remoteRelationId = getRemoteIdForLocal(context, relation.target, localRelationId);
    const relationExistsLocally = localRelationId
      ? context.localById[relation.target].has(localRelationId)
      : false;

    if (relation.required && !remoteRelationId) {
      throw new Error(`Relação obrigatória não sincronizada em ${config.localName}: ${relation.field}.`);
    }

    if (!relation.required && localRelationId && relationExistsLocally && !remoteRelationId) {
      throw new Error(
        `Relação pendente de sincronização em ${config.localName}: ${relation.field}. Sincronize novamente após enviar o registro relacionado.`,
      );
    }

    payload[relation.field] = remoteRelationId ?? null;
  }

  return cleanRemotePayload(payload);
}

function toLocalRecord(
  config: SyncTableConfig<AnyLocalEntity>,
  remote: RemoteRow,
  context: SyncContext,
  existing?: AnyLocalEntity,
) {
  const local: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(remote)) {
    if (key === 'id' || key === 'created_by') {
      continue;
    }

    local[key] = value ?? undefined;
  }

  for (const relation of config.relations ?? []) {
    const remoteRelationId = remote[relation.field] as string | undefined | null;
    local[relation.field] = getLocalIdForRemote(context, relation.target, remoteRelationId);
  }

  return {
    ...existing,
    ...local,
    id: existing?.id ?? createLocalId(config.idPrefix),
    remote_id: remote.id,
    farm_id: remote.farm_id,
    created_at: remote.created_at,
    updated_at: remote.updated_at,
    deleted_at: remote.deleted_at ?? undefined,
    sync_status: 'synced',
  } as AnyLocalEntity;
}

function findLocalNaturalMatch(
  config: SyncTableConfig<AnyLocalEntity>,
  remote: RemoteRow,
  localRecords: AnyLocalEntity[],
) {
  if (config.localName === 'animals') {
    const remoteIdentification = normalizeIdentifier(String(remote.identification ?? ''));
    return localRecords.find(
      (record) =>
        !record.remote_id &&
        normalizeIdentifier(String((record as Animal).identification ?? '')) === remoteIdentification,
    );
  }

  if (config.localName === 'lots') {
    const remoteName = String(remote.name ?? '').trim().toLocaleLowerCase('pt-BR');
    return localRecords.find(
      (record) =>
        !record.remote_id &&
        String((record as Lot).name ?? '').trim().toLocaleLowerCase('pt-BR') === remoteName,
    );
  }

  if (config.localName === 'semen' && remote.code) {
    const remoteCode = String(remote.code).trim().toLocaleLowerCase('pt-BR');
    return localRecords.find(
      (record) =>
        !record.remote_id &&
        String((record as Semen).code ?? '').trim().toLocaleLowerCase('pt-BR') === remoteCode,
    );
  }

  if (config.localName === 'farmSettings') {
    return localRecords.find((record) => !record.remote_id && record.farm_id === remote.farm_id);
  }

  return undefined;
}

async function findRemoteNaturalMatch(
  config: SyncTableConfig<AnyLocalEntity>,
  farmId: string,
  record: AnyLocalEntity,
) {
  const client = requireSupabase();

  if (config.localName === 'animals') {
    const identification = (record as Animal).identification;
    const { data, error } = await client
      .from(config.remoteName)
      .select('*')
      .eq('farm_id', farmId)
      .eq('identification', identification)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as RemoteRow | null;
  }

  if (config.localName === 'lots') {
    const { data, error } = await client
      .from(config.remoteName)
      .select('*')
      .eq('farm_id', farmId)
      .eq('name', (record as Lot).name)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as RemoteRow | null;
  }

  if (config.localName === 'semen' && (record as Semen).code) {
    const { data, error } = await client
      .from(config.remoteName)
      .select('*')
      .eq('farm_id', farmId)
      .eq('code', (record as Semen).code)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as RemoteRow | null;
  }

  if (config.localName === 'farmSettings') {
    const { data, error } = await client
      .from(config.remoteName)
      .select('*')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as RemoteRow | null;
  }

  return null;
}

async function fetchRemoteById(config: SyncTableConfig<AnyLocalEntity>, remoteId: string) {
  const { data, error } = await requireSupabase()
    .from(config.remoteName)
    .select('*')
    .eq('id', remoteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as RemoteRow | null;
}

async function markQueueItemsSynced(entity: SyncQueueEntityName, localId: string) {
  await db.syncQueue
    .where('entity_id')
    .equals(localId)
    .modify((item) => {
      if (item.entity === entity) {
        item.sync_status = 'synced';
        item.updated_at = new Date().toISOString();
      }
    });
}

async function applyRemoteToLocal(
  config: SyncTableConfig<AnyLocalEntity>,
  remote: RemoteRow,
  context: SyncContext,
  existing?: AnyLocalEntity,
) {
  const record = toLocalRecord(config, remote, context, existing);

  await config.table.put(record);
  context.localByRemote[config.localName].set(remote.id, record);
  context.remoteByLocal[config.localName].set(record.id, remote.id);
  await markQueueItemsSynced(config.localName, record.id);

  return record;
}

async function pushRecord(
  config: SyncTableConfig<AnyLocalEntity>,
  record: AnyLocalEntity,
  farmId: string,
  userId: string,
  context: SyncContext,
) {
  if (record.farm_id && record.farm_id !== farmId) {
    return 'skipped' as const;
  }

  if (record.deleted_at && !record.remote_id) {
    await config.table.put({ ...record, farm_id: farmId, sync_status: 'synced' });
    await markQueueItemsSynced(config.localName, record.id);
    return 'pushed' as const;
  }

  const remoteExisting = record.remote_id
    ? await fetchRemoteById(config, record.remote_id)
    : await findRemoteNaturalMatch(config, farmId, record);

  if (remoteExisting && isRemoteNewer(remoteExisting, record)) {
    await applyRemoteToLocal(config, remoteExisting, context, record);
    return 'conflict_remote' as const;
  }

  const includeCreatedBy = !remoteExisting;
  const payload = toRemotePayload(config, record, farmId, userId, context, includeCreatedBy);
  const client = requireSupabase();
  const response = remoteExisting
    ? await client
        .from(config.remoteName)
        .update(payload)
        .eq('id', remoteExisting.id)
        .select()
        .single()
    : await client
        .from(config.remoteName)
        .insert(payload)
        .select()
        .single();

  if (response.error) {
    throw response.error;
  }

  const remote = response.data as RemoteRow;
  const syncedRecord = {
    ...record,
    remote_id: remote.id,
    farm_id: remote.farm_id,
    created_at: remote.created_at,
    updated_at: remote.updated_at,
    deleted_at: remote.deleted_at ?? undefined,
    sync_status: 'synced',
  } as AnyLocalEntity;

  await config.table.put(syncedRecord);
  context.localByRemote[config.localName].set(remote.id, syncedRecord);
  context.remoteByLocal[config.localName].set(syncedRecord.id, remote.id);
  await markQueueItemsSynced(config.localName, syncedRecord.id);

  return 'pushed' as const;
}

async function pushLocalChanges(farmId: string, userId: string, summary: SyncSummary) {
  let context = await buildSyncContext();

  for (const config of syncTables) {
    const records = (await config.table.toArray()).filter((record) => {
      const needsSync = record.sync_status !== 'synced' || !record.remote_id || !record.farm_id;
      const belongsToSelectedFarm = !record.farm_id || record.farm_id === farmId;

      return needsSync && belongsToSelectedFarm;
    });

    for (const record of records) {
      try {
        const result = await pushRecord(config, record, farmId, userId, context);

        if (result === 'pushed') {
          summary.pushed += 1;
        } else if (result === 'conflict_remote') {
          summary.conflictsResolved += 1;
          summary.pulled += 1;
        } else {
          summary.skipped += 1;
        }
      } catch (error) {
        summary.errors.push(
          `${config.localName}: ${error instanceof Error ? error.message : 'erro ao enviar registro'}`,
        );
      }
    }

    context = await buildSyncContext();
  }
}

async function pullRemoteChanges(farmId: string, summary: SyncSummary) {
  let context = await buildSyncContext();

  for (const config of syncTables) {
    const { data, error } = await requireSupabase()
      .from(config.remoteName)
      .select('*')
      .eq('farm_id', farmId)
      .order('updated_at', { ascending: true });

    if (error) {
      throw error;
    }

    const localRecords = await config.table.toArray();
    const remoteRows = (data ?? []) as RemoteRow[];
    const existingByRemoteId = new Map<string, AnyLocalEntity>();

    for (const remote of remoteRows) {
      const existingByRemote = context.localByRemote[config.localName].get(remote.id) as
        | AnyLocalEntity
        | undefined;
      const existing =
        existingByRemote ??
        findLocalNaturalMatch(config, remote, localRecords) ??
        ({
          id: createLocalId(config.idPrefix),
          remote_id: remote.id,
          farm_id: remote.farm_id,
          created_at: remote.created_at,
          updated_at: remote.updated_at,
          deleted_at: remote.deleted_at ?? undefined,
          sync_status: 'synced',
        } as AnyLocalEntity);

      existingByRemoteId.set(remote.id, existing);
      context.localById[config.localName].set(existing.id, existing);
      context.localByRemote[config.localName].set(remote.id, existing);
      context.remoteByLocal[config.localName].set(existing.id, remote.id);
    }

    for (const remote of remoteRows) {
      const existing = existingByRemoteId.get(remote.id);

      if (existing && existing.sync_status !== 'synced' && !isRemoteNewer(remote, existing)) {
        summary.skipped += 1;
        continue;
      }

      await applyRemoteToLocal(config, remote, context, existing);
      summary.pulled += 1;
    }

    context = await buildSyncContext();
  }
}

export function getSelectedFarmId() {
  return getActiveFarmId() ?? null;
}

export function setSelectedFarmId(farmId: string, farmName?: string) {
  setActiveFarmContext({ id: farmId, name: farmName });
}

export function getLastSyncAt() {
  try {
    return window.localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function setLastSyncAt(value: string) {
  window.localStorage.setItem(LAST_SYNC_KEY, value);
}

export async function getPendingSyncCount() {
  const counts = await Promise.all(
    syncTables.map(async (config) => {
      const records = await config.table.toArray();
      return records.filter((record) => record.sync_status !== 'synced' || !record.remote_id).length;
    }),
  );

  return counts.reduce((total, count) => total + count, 0);
}

export async function listRemoteFarms(): Promise<RemoteFarm[]> {
  assertOnline();

  const { data, error } = await requireSupabase()
    .from('farms')
    .select('id,name,updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RemoteFarm[];
}

export async function createRemoteFarm(name: string, userId: string) {
  assertOnline();

  const farmName = name.trim();

  if (!farmName) {
    throw new Error('Informe o nome da fazenda.');
  }

  const { data, error } = await requireSupabase()
    .from('farms')
    .insert({
      name: farmName,
      owner_id: userId,
      created_by: userId,
    })
    .select('id,name,updated_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const farm = data as RemoteFarm;
  setSelectedFarmId(farm.id, farm.name);
  return farm;
}

export async function listRemoteFarmMembers(farmId: string): Promise<RemoteFarmMember[]> {
  assertOnline();

  if (!farmId) {
    return [];
  }

  const { data, error } = await requireSupabase()
    .from('farm_members')
    .select('id,farm_id,user_id,role,created_at')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RemoteFarmMember[];
}

export async function runSync({
  farmId,
  mode,
  userId,
}: {
  farmId: string;
  mode: SyncMode;
  userId: string;
}): Promise<SyncSummary> {
  assertOnline();

  if (!farmId) {
    throw new Error('Selecione uma fazenda antes de sincronizar.');
  }

  const startedAt = new Date().toISOString();
  const summary: SyncSummary = {
    pushed: 0,
    pulled: 0,
    conflictsResolved: 0,
    skipped: 0,
    errors: [],
    startedAt,
    completedAt: startedAt,
  };

  if (mode === 'push' || mode === 'two_way') {
    await pushLocalChanges(farmId, userId, summary);
  }

  if (mode === 'pull' || mode === 'two_way') {
    await pullRemoteChanges(farmId, summary);
  }

  summary.completedAt = new Date().toISOString();

  if (summary.errors.length === 0) {
    setLastSyncAt(summary.completedAt);
  }

  return summary;
}

export function getSyncTableConfig(name: SyncQueueEntityName) {
  return getTableConfig(name);
}
