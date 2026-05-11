import { db } from '../db';
import type { Semen } from '../types';
import {
  assertOptionalDate,
  assertOptionalPositiveNumber,
  assertRequiredText,
  normalizeOptionalText,
  normalizeText,
} from '../utils/validation';
import { createCrudService, type EntityCreateInput, type EntityUpdateInput } from './localCrud';

export type CreateSemenInput = EntityCreateInput<Semen>;
export type UpdateSemenInput = EntityUpdateInput<Semen>;

function prepareSemen(record: Semen): Semen {
  const dosesAvailable = record.doses_available ?? record.quantity ?? 0;

  return {
    ...record,
    code: normalizeOptionalText(record.code),
    bull_name: normalizeText(record.bull_name),
    breed: normalizeOptionalText(record.breed),
    batch: normalizeOptionalText(record.batch),
    supplier: normalizeOptionalText(record.supplier),
    semen_center: normalizeOptionalText(record.semen_center),
    quantity: record.quantity ?? dosesAvailable,
    doses_available: dosesAvailable,
    genetic_traits: normalizeOptionalText(record.genetic_traits),
    notes: normalizeOptionalText(record.notes),
    status: record.status ?? 'active',
  };
}

function validateSemen(record: Semen) {
  assertRequiredText(record.bull_name, 'Nome ou código do touro');
  assertRequiredText(record.status, 'Status');
  assertOptionalPositiveNumber(record.quantity, 'Quantidade');
  assertOptionalPositiveNumber(record.doses_available, 'Doses disponíveis');
  assertOptionalPositiveNumber(record.price_per_dose, 'Valor por dose');
  assertOptionalDate(record.expiration_date, 'Validade');
}

export const semenService = createCrudService<Semen>({
  table: db.semen,
  entityName: 'semen',
  idPrefix: 'semen',
  prepare: prepareSemen,
  validate: validateSemen,
});

export const { create, update, delete: deleteSemen, list, getById } = semenService;
