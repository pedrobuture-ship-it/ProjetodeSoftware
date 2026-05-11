import { db } from '../db';
import type { Birth, MatrixReproductiveStatus } from '../types';
import { isBeforeDate, isFutureDate } from '../utils/date';
import {
  assertOptionalPositiveNumber,
  assertRequiredDate,
  assertRequiredText,
  normalizeOptionalText,
} from '../utils/validation';
import * as animalsService from './animalsService';
import * as inseminationsService from './inseminationsService';
import { createCrudService, type EntityCreateInput, type EntityUpdateInput } from './localCrud';

export type CreateBirthInput = EntityCreateInput<Birth>;
export type UpdateBirthInput = EntityUpdateInput<Birth>;

const MINIMUM_BIRTH_DATE = '1990-01-01';

function prepareBirth(record: Birth): Birth {
  const calfStatus = record.calf_status ?? (record.outcome === 'alive' ? 'alive' : 'dead');

  return {
    ...record,
    animal_id: record.animal_id.trim(),
    birth_type: record.birth_type ?? 'normal',
    calf_count: record.calf_count ?? 1,
    outcome: record.outcome ?? (calfStatus === 'alive' ? 'alive' : 'stillborn'),
    calf_id: normalizeOptionalText(record.calf_id),
    calf_identification: normalizeOptionalText(record.calf_identification),
    calf_status: calfStatus,
    responsible: normalizeOptionalText(record.responsible),
    notes: normalizeOptionalText(record.notes),
  };
}

async function matrixHasPregnancyEvidence(animalId: string) {
  const matrix = await animalsService.getById(animalId);

  if (matrix?.reproductive_status === 'pregnant') {
    return true;
  }

  const positiveDiagnosis = (await db.pregnancyDiagnoses.where('animal_id').equals(animalId).toArray())
    .filter((diagnosis) => !diagnosis.deleted_at && diagnosis.result === 'pregnant')
    .sort((a, b) => b.diagnosis_date.localeCompare(a.diagnosis_date))[0];

  return Boolean(positiveDiagnosis);
}

async function validateBirth(record: Birth) {
  assertRequiredText(record.animal_id, 'Matriz');
  assertRequiredDate(record.birth_date, 'Data do parto');
  assertRequiredText(record.birth_type, 'Tipo de parto');
  assertRequiredText(record.calf_status, 'Status do bezerro');
  assertOptionalPositiveNumber(record.calf_count, 'Quantidade de bezerros');
  assertOptionalPositiveNumber(record.birth_weight_kg, 'Peso ao nascer');

  if (isFutureDate(record.birth_date) || isBeforeDate(record.birth_date, MINIMUM_BIRTH_DATE)) {
    throw new Error('Informe uma data de parto válida.');
  }

  const matrix = await animalsService.getById(record.animal_id);

  if (!matrix || matrix.sex !== 'female' || !['matrix', 'heifer'].includes(matrix.category)) {
    throw new Error('Selecione uma matriz válida.');
  }

  if (!(await matrixHasPregnancyEvidence(record.animal_id))) {
    throw new Error('Apenas matrizes prenhas podem registrar parto.');
  }

  const latestInsemination = (await inseminationsService.list())
    .filter((insemination) => insemination.animal_id === record.animal_id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (latestInsemination && record.birth_date < latestInsemination.date) {
    throw new Error('O parto não pode ser anterior à inseminação.');
  }
}

const baseBirthsService = createCrudService<Birth>({
  table: db.births,
  entityName: 'births',
  idPrefix: 'birth',
  prepare: prepareBirth,
  validate: validateBirth,
});

async function setMatrixStatus(animalId: string, reproductiveStatus: MatrixReproductiveStatus) {
  await animalsService.update(animalId, { reproductive_status: reproductiveStatus });
}

async function refreshMatrixStatus(animalId: string) {
  const activeBirth = (await db.births.where('animal_id').equals(animalId).toArray())
    .filter((birth) => !birth.deleted_at)
    .sort((a, b) => b.birth_date.localeCompare(a.birth_date))[0];

  if (activeBirth) {
    await setMatrixStatus(animalId, 'calved');
    return;
  }

  const latestDiagnosis = (await db.pregnancyDiagnoses.where('animal_id').equals(animalId).toArray())
    .filter((diagnosis) => !diagnosis.deleted_at && diagnosis.result !== 'inconclusive')
    .sort((a, b) => b.diagnosis_date.localeCompare(a.diagnosis_date))[0];

  if (latestDiagnosis?.result === 'pregnant') {
    await setMatrixStatus(animalId, 'pregnant');
    return;
  }

  if (latestDiagnosis?.result === 'empty') {
    await setMatrixStatus(animalId, 'empty');
    return;
  }

  const latestInsemination = (await inseminationsService.list())
    .filter((insemination) => insemination.animal_id === animalId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (latestInsemination) {
    await setMatrixStatus(
      animalId,
      latestInsemination.status === 'positive'
        ? 'pregnant'
        : latestInsemination.status === 'negative' || latestInsemination.status === 'aborted'
          ? 'empty'
          : 'inseminated',
    );
    return;
  }

  await setMatrixStatus(animalId, 'empty');
}

export async function create(data: CreateBirthInput) {
  const record = await baseBirthsService.create(data);
  await setMatrixStatus(record.animal_id, 'calved');
  return record;
}

export async function update(id: string, data: UpdateBirthInput) {
  const existing = await baseBirthsService.getById(id);

  if (!existing) {
    throw new Error('Parto não encontrado.');
  }

  const record = await baseBirthsService.update(id, data);
  await setMatrixStatus(record.animal_id, 'calved');

  if (existing.animal_id !== record.animal_id) {
    await refreshMatrixStatus(existing.animal_id);
  }

  return record;
}

export async function deleteBirth(id: string) {
  const existing = await baseBirthsService.getById(id);

  if (!existing) {
    throw new Error('Parto não encontrado.');
  }

  const record = await baseBirthsService.delete(id);
  await refreshMatrixStatus(record.animal_id);

  return record;
}

export const list = baseBirthsService.list;
export const getById = baseBirthsService.getById;

export const birthsService = {
  create,
  update,
  delete: deleteBirth,
  list,
  getById,
};
