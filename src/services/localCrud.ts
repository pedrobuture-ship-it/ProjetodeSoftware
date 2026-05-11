import type { Table } from 'dexie';
import { db } from '../db';
import type {
  LocalEntity,
  SyncOperation,
  SyncQueueEntityName,
  SyncQueueItem,
  SyncStatus,
} from '../types';
import { nowIso } from '../utils/date';
import { createLocalId } from '../utils/id';
import { getActiveFarmId } from './farmContextService';

export type EntityCreateInput<T extends LocalEntity> = Omit<
  T,
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_status'
> &
  Partial<Pick<LocalEntity, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_status'>>;

export type EntityUpdateInput<T extends LocalEntity> = Partial<
  Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_status'>
>;

export interface ListOptions {
  includeDeleted?: boolean;
}

interface CrudConfig<T extends LocalEntity> {
  table: Table<T, string>;
  entityName: SyncQueueEntityName;
  idPrefix: string;
  prepare?: (record: T) => T | Promise<T>;
  validate?: (record: T) => void | Promise<void>;
}

function nextSyncStatus(currentStatus: SyncStatus): SyncStatus {
  return currentStatus === 'pending_create' ? 'pending_create' : 'pending_update';
}

async function enqueueSyncOperation<T extends LocalEntity>(
  entity: SyncQueueEntityName,
  operation: SyncOperation,
  record: T,
) {
  const now = nowIso();
  const queueItem: SyncQueueItem = {
    id: createLocalId('sync'),
    entity,
    entity_id: record.id,
    operation,
    payload: record,
    attempts: 0,
    created_at: now,
    updated_at: now,
    sync_status: 'pending_create',
  };

  await db.syncQueue.add(queueItem);
}

export function createCrudService<T extends LocalEntity>(config: CrudConfig<T>) {
  async function create(data: EntityCreateInput<T>) {
    const now = nowIso();
    const draft = {
      ...data,
      id: data.id ?? createLocalId(config.idPrefix),
      farm_id: data.farm_id ?? getActiveFarmId(),
      created_at: data.created_at ?? now,
      updated_at: data.updated_at ?? now,
      deleted_at: data.deleted_at,
      sync_status: data.sync_status ?? 'pending_create',
    } as T;
    const record = config.prepare ? await config.prepare(draft) : draft;

    if (config.validate) {
      await config.validate(record);
    }

    await db.transaction('rw', config.table, db.syncQueue, async () => {
      await config.table.add(record);
      await enqueueSyncOperation(config.entityName, 'create', record);
    });

    return record;
  }

  async function update(id: string, data: EntityUpdateInput<T>) {
    const existing = await config.table.get(id);

    if (!existing || existing.deleted_at) {
      throw new Error('Registro não encontrado.');
    }

    const draft = {
      ...existing,
      ...data,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: nowIso(),
      deleted_at: existing.deleted_at,
      sync_status: nextSyncStatus(existing.sync_status),
    } as T;
    const record = config.prepare ? await config.prepare(draft) : draft;

    if (config.validate) {
      await config.validate(record);
    }

    await db.transaction('rw', config.table, db.syncQueue, async () => {
      await config.table.put(record);
      await enqueueSyncOperation(config.entityName, 'update', record);
    });

    return record;
  }

  async function remove(id: string) {
    const existing = await config.table.get(id);

    if (!existing || existing.deleted_at) {
      throw new Error('Registro não encontrado.');
    }

    const record = {
      ...existing,
      updated_at: nowIso(),
      deleted_at: nowIso(),
      sync_status: 'pending_delete',
    } as T;

    await db.transaction('rw', config.table, db.syncQueue, async () => {
      await config.table.put(record);
      await enqueueSyncOperation(config.entityName, 'delete', record);
    });

    return record;
  }

  async function list(options: ListOptions = {}) {
    const records = await config.table.orderBy('updated_at').reverse().toArray();

    if (options.includeDeleted) {
      return records;
    }

    return records.filter((record) => !record.deleted_at);
  }

  async function getById(id: string, options: ListOptions = {}) {
    const record = await config.table.get(id);

    if (!record || (!options.includeDeleted && record.deleted_at)) {
      return undefined;
    }

    return record;
  }

  return {
    create,
    update,
    delete: remove,
    list,
    getById,
  };
}
