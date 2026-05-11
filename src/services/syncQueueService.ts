import { db } from '../db';
import type { SyncQueueItem } from '../types';
import { nowIso } from '../utils/date';
import { createLocalId } from '../utils/id';
import { assertRequiredText } from '../utils/validation';
import type { EntityCreateInput, EntityUpdateInput, ListOptions } from './localCrud';

export type CreateSyncQueueInput = EntityCreateInput<SyncQueueItem>;
export type UpdateSyncQueueInput = EntityUpdateInput<SyncQueueItem>;

function prepareQueueItem(data: CreateSyncQueueInput): SyncQueueItem {
  const now = nowIso();

  return {
    ...data,
    id: data.id ?? createLocalId('sync'),
    attempts: data.attempts ?? 0,
    created_at: data.created_at ?? now,
    updated_at: data.updated_at ?? now,
    sync_status: data.sync_status ?? 'pending_create',
  } as SyncQueueItem;
}

function validateQueueItem(record: SyncQueueItem) {
  assertRequiredText(record.entity, 'Entidade');
  assertRequiredText(record.entity_id, 'Registro');
  assertRequiredText(record.operation, 'Operação');
}

export async function create(data: CreateSyncQueueInput) {
  const record = prepareQueueItem(data);
  validateQueueItem(record);
  await db.syncQueue.add(record);
  return record;
}

export async function update(id: string, data: UpdateSyncQueueInput) {
  const existing = await db.syncQueue.get(id);

  if (!existing) {
    throw new Error('Registro não encontrado.');
  }

  const record = {
    ...existing,
    ...data,
    id: existing.id,
    created_at: existing.created_at,
    updated_at: nowIso(),
  } as SyncQueueItem;

  validateQueueItem(record);
  await db.syncQueue.put(record);
  return record;
}

export async function deleteSyncQueueItem(id: string) {
  await db.syncQueue.delete(id);
}

export async function list(options: ListOptions = {}) {
  const records = await db.syncQueue.orderBy('created_at').toArray();

  if (options.includeDeleted) {
    return records;
  }

  return records.filter((record) => !record.deleted_at);
}

export async function getById(id: string, options: ListOptions = {}) {
  const record = await db.syncQueue.get(id);

  if (!record || (!options.includeDeleted && record.deleted_at)) {
    return undefined;
  }

  return record;
}

export async function clearSynced() {
  await db.syncQueue.where('sync_status').equals('synced').delete();
}

export const syncQueueService = {
  create,
  update,
  delete: deleteSyncQueueItem,
  list,
  getById,
  clearSynced,
};
