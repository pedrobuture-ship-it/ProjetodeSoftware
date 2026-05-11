import { db } from '../db';
import type { Lot } from '../types';
import {
  assertOptionalPositiveNumber,
  assertRequiredText,
  normalizeOptionalText,
  normalizeText,
} from '../utils/validation';
import { createCrudService, type EntityCreateInput, type EntityUpdateInput } from './localCrud';

export type CreateLotInput = EntityCreateInput<Lot>;
export type UpdateLotInput = EntityUpdateInput<Lot>;

function prepareLot(record: Lot): Lot {
  const status = record.status ?? (record.active === false ? 'inactive' : 'active');

  return {
    ...record,
    name: normalizeText(record.name),
    pasture_type: normalizeOptionalText(record.pasture_type),
    description: normalizeOptionalText(record.description),
    status,
    active: status === 'active',
  };
}

function validateLot(record: Lot) {
  assertRequiredText(record.name, 'Nome do lote/piquete');
  assertRequiredText(record.type, 'Tipo');
  assertRequiredText(record.status, 'Status');
  assertOptionalPositiveNumber(record.area_hectares, 'Área aproximada');
}

export const lotsService = createCrudService<Lot>({
  table: db.lots,
  entityName: 'lots',
  idPrefix: 'lot',
  prepare: prepareLot,
  validate: validateLot,
});

export const { create, update, delete: deleteLot, list, getById } = lotsService;
