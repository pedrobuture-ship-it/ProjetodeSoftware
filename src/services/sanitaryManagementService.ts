import { db } from '../db';
import type { SanitaryManagement } from '../types';
import {
  assertOptionalDate,
  assertRequiredDate,
  assertRequiredText,
  normalizeOptionalText,
} from '../utils/validation';
import { createCrudService, type EntityCreateInput, type EntityUpdateInput } from './localCrud';

export type CreateSanitaryManagementInput = EntityCreateInput<SanitaryManagement>;
export type UpdateSanitaryManagementInput = EntityUpdateInput<SanitaryManagement>;

function prepareSanitaryManagement(record: SanitaryManagement): SanitaryManagement {
  return {
    ...record,
    animal_id: normalizeOptionalText(record.animal_id),
    lot_id: normalizeOptionalText(record.lot_id),
    next_application_date: normalizeOptionalText(record.next_application_date),
    product: normalizeOptionalText(record.product),
    dosage: normalizeOptionalText(record.dosage),
    responsible: normalizeOptionalText(record.responsible),
    notes: normalizeOptionalText(record.notes),
    status: record.status ?? 'done',
  };
}

function validateSanitaryManagement(record: SanitaryManagement) {
  assertRequiredDate(record.date, 'Data de aplicação');
  assertRequiredText(record.procedure_type, 'Tipo de manejo');
  assertRequiredText(record.status, 'Status');
  assertOptionalDate(record.next_application_date, 'Próxima aplicação');

  if ((!record.animal_id && !record.lot_id) || (record.animal_id && record.lot_id)) {
    throw new Error('Informe apenas um vínculo: animal tratado ou lote tratado.');
  }
}

export const sanitaryManagementService = createCrudService<SanitaryManagement>({
  table: db.sanitaryManagement,
  entityName: 'sanitaryManagement',
  idPrefix: 'sanitary',
  prepare: prepareSanitaryManagement,
  validate: validateSanitaryManagement,
});

export const { create, update, delete: deleteSanitaryManagement, list, getById } =
  sanitaryManagementService;
