export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';

export interface LocalEntity {
  id: string;
  remote_id?: string;
  farm_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  sync_status: SyncStatus;
}

export type AnimalSex = 'female' | 'male' | 'unknown';
export type MatrixReproductiveStatus =
  | 'empty'
  | 'inseminated'
  | 'pregnant'
  | 'calved'
  | 'discarded';
export type AnimalCategory =
  | 'matrix'
  | 'bull'
  | 'calf'
  | 'heifer'
  | 'steer'
  | 'discard'
  | 'other';
export type AnimalStatus = 'active' | 'sold' | 'dead' | 'discarded' | 'inactive';

export interface Animal extends LocalEntity {
  identification: string;
  name?: string;
  sex: AnimalSex;
  category: AnimalCategory;
  status: AnimalStatus;
  breed?: string;
  birth_date?: string;
  weight_kg?: number;
  reproductive_status?: MatrixReproductiveStatus;
  lot_id?: string;
  mother_id?: string;
  father_id?: string;
  notes?: string;
}

export interface Insemination extends LocalEntity {
  animal_id: string;
  date: string;
  semen_id?: string;
  bull_id?: string;
  protocol?: string;
  technician?: string;
  type?: InseminationType;
  status?: InseminationStatus;
  diagnosis_due_date?: string;
  birth_due_date?: string;
  notes?: string;
}

export type InseminationType = 'iatf' | 'conventional_ai' | 'natural_mating';
export type InseminationStatus =
  | 'awaiting_diagnosis'
  | 'positive'
  | 'negative'
  | 'aborted';

export type PregnancyDiagnosisMethod = 'ultrasound' | 'palpation' | 'observation' | 'other';
export type PregnancyDiagnosisResult = 'pregnant' | 'empty' | 'inconclusive';

export interface PregnancyDiagnosis extends LocalEntity {
  animal_id: string;
  insemination_id?: string;
  diagnosis_date: string;
  method?: PregnancyDiagnosisMethod;
  result: PregnancyDiagnosisResult;
  expected_birth_date?: string;
  responsible?: string;
  notes?: string;
}

export type BirthType = 'normal' | 'assisted' | 'cesarean';
export type CalfStatus = 'alive' | 'dead' | 'weak' | 'sold';
export type BirthOutcome = 'alive' | 'stillborn' | 'abortion' | 'unknown';

export interface Birth extends LocalEntity {
  animal_id: string;
  birth_date: string;
  birth_type?: BirthType;
  calf_count?: number;
  outcome: BirthOutcome;
  calf_id?: string;
  calf_identification?: string;
  calf_sex?: AnimalSex;
  calf_status?: CalfStatus;
  birth_weight_kg?: number;
  responsible?: string;
  notes?: string;
}

export type SemenStatus = 'active' | 'inactive' | 'sold_out';

export interface Semen extends LocalEntity {
  code?: string;
  bull_name: string;
  breed?: string;
  batch?: string;
  supplier?: string;
  semen_center?: string;
  quantity?: number;
  doses_available?: number;
  price_per_dose?: number;
  genetic_traits?: string;
  expiration_date?: string;
  notes?: string;
  status: SemenStatus;
}

export type SanitaryManagementType =
  | 'vaccine'
  | 'deworming'
  | 'medication'
  | 'veterinary_procedure'
  | 'exam'
  | 'other';
export type SanitaryManagementStatus = 'done' | 'pending' | 'overdue';

export interface SanitaryManagement extends LocalEntity {
  date: string;
  procedure_type: SanitaryManagementType;
  animal_id?: string;
  lot_id?: string;
  next_application_date?: string;
  product?: string;
  dosage?: string;
  responsible?: string;
  notes?: string;
  status: SanitaryManagementStatus;
}

export type LotType = 'lot' | 'paddock';
export type LotStatus = 'active' | 'inactive' | 'maintenance';

export interface Lot extends LocalEntity {
  name: string;
  type: LotType;
  pasture_type?: string;
  area_hectares?: number;
  description?: string;
  active: boolean;
  status: LotStatus;
}

export interface FarmSettings extends LocalEntity {
  farm_name: string;
  owner_name?: string;
  document?: string;
  city?: string;
  state?: string;
  area_total_hectares?: number;
  app_preferences?: FarmAppPreferences;
  notes?: string;
}

export interface FarmAppPreferences {
  compact_mode?: boolean;
  low_semen_doses_alert?: number;
  sanitary_alert_days?: number;
}

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncQueueEntityName =
  | 'animals'
  | 'inseminations'
  | 'pregnancyDiagnoses'
  | 'births'
  | 'semen'
  | 'sanitaryManagement'
  | 'lots'
  | 'farmSettings';

export interface SyncQueueItem extends LocalEntity {
  entity: SyncQueueEntityName;
  entity_id: string;
  operation: SyncOperation;
  payload: unknown;
  attempts: number;
  last_error?: string;
}

export type LocalTableName = SyncQueueEntityName | 'syncQueue';

export interface OfflineBackupData {
  animals: Animal[];
  inseminations: Insemination[];
  pregnancyDiagnoses: PregnancyDiagnosis[];
  births: Birth[];
  semen: Semen[];
  sanitaryManagement: SanitaryManagement[];
  lots: Lot[];
  farmSettings: FarmSettings[];
  syncQueue: SyncQueueItem[];
}

export interface OfflineBackup {
  app: 'fazenda-cria';
  version: number;
  exported_at: string;
  data: OfflineBackupData;
}
