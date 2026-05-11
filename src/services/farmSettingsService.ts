import { db } from '../db';
import type { FarmSettings } from '../types';
import {
  assertOptionalPositiveNumber,
  assertRequiredText,
  normalizeOptionalText,
  normalizeText,
} from '../utils/validation';
import { createCrudService, type EntityCreateInput, type EntityUpdateInput } from './localCrud';

export type CreateFarmSettingsInput = EntityCreateInput<FarmSettings>;
export type UpdateFarmSettingsInput = EntityUpdateInput<FarmSettings>;

function prepareFarmSettings(record: FarmSettings): FarmSettings {
  return {
    ...record,
    farm_name: normalizeText(record.farm_name),
    owner_name: normalizeOptionalText(record.owner_name),
    document: normalizeOptionalText(record.document),
    city: normalizeOptionalText(record.city),
    state: normalizeOptionalText(record.state)?.toUpperCase(),
    app_preferences: record.app_preferences
      ? {
          compact_mode: Boolean(record.app_preferences.compact_mode),
          low_semen_doses_alert: record.app_preferences.low_semen_doses_alert,
          sanitary_alert_days: record.app_preferences.sanitary_alert_days,
        }
      : undefined,
    notes: normalizeOptionalText(record.notes),
  };
}

function validateFarmSettings(record: FarmSettings) {
  assertRequiredText(record.farm_name, 'Nome da fazenda');
  assertOptionalPositiveNumber(record.area_total_hectares, 'Área total');
  assertOptionalPositiveNumber(record.app_preferences?.low_semen_doses_alert, 'Alerta de sêmen baixo');
  assertOptionalPositiveNumber(record.app_preferences?.sanitary_alert_days, 'Dias de alerta sanitário');
}

export const farmSettingsService = createCrudService<FarmSettings>({
  table: db.farmSettings,
  entityName: 'farmSettings',
  idPrefix: 'settings',
  prepare: prepareFarmSettings,
  validate: validateFarmSettings,
});

export async function getCurrent() {
  const settings = await farmSettingsService.list();
  return settings[0];
}

export const { create, update, delete: deleteFarmSettings, list, getById } =
  farmSettingsService;
