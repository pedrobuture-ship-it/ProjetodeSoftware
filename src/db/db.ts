import Dexie, { type Table } from 'dexie';
import type {
  Animal,
  Birth,
  FarmSettings,
  Insemination,
  Lot,
  PregnancyDiagnosis,
  SanitaryManagement,
  Semen,
  SyncQueueItem,
} from '../types';

export class FazendaCriaDatabase extends Dexie {
  animals!: Table<Animal, string>;
  inseminations!: Table<Insemination, string>;
  pregnancyDiagnoses!: Table<PregnancyDiagnosis, string>;
  births!: Table<Birth, string>;
  semen!: Table<Semen, string>;
  sanitaryManagement!: Table<SanitaryManagement, string>;
  lots!: Table<Lot, string>;
  farmSettings!: Table<FarmSettings, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('fazenda_cria_offline_db');

    this.version(1).stores({
      animals:
        '&id, identification, remote_id, farm_id, sync_status, category, sex, status, lot_id, updated_at, deleted_at',
      inseminations:
        '&id, animal_id, semen_id, remote_id, farm_id, sync_status, date, updated_at, deleted_at',
      pregnancyDiagnoses:
        '&id, animal_id, remote_id, farm_id, sync_status, diagnosis_date, result, updated_at, deleted_at',
      births:
        '&id, animal_id, calf_id, remote_id, farm_id, sync_status, birth_date, updated_at, deleted_at',
      semen:
        '&id, code, remote_id, farm_id, sync_status, bull_name, batch, updated_at, deleted_at',
      sanitaryManagement:
        '&id, animal_id, lot_id, remote_id, farm_id, sync_status, date, procedure_type, updated_at, deleted_at',
      lots: '&id, name, remote_id, farm_id, sync_status, type, active, updated_at, deleted_at',
      farmSettings: '&id, remote_id, farm_id, sync_status, farm_name, updated_at, deleted_at',
      syncQueue:
        '&id, entity, entity_id, operation, sync_status, attempts, created_at, updated_at, deleted_at',
    });
  }
}

export const db = new FazendaCriaDatabase();
