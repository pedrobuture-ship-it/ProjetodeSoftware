import { db } from '../db';
import {
  inseminationStatusFromDiagnosis,
  reproductiveStatusFromDiagnosis,
} from '../constants/reproductionOptions';
import type { Insemination, MatrixReproductiveStatus, PregnancyDiagnosis } from '../types';
import { isBeforeDate, isFutureDate } from '../utils/date';
import {
  assertOptionalDate,
  assertRequiredDate,
  assertRequiredText,
  normalizeOptionalText,
} from '../utils/validation';
import * as animalsService from './animalsService';
import * as inseminationsService from './inseminationsService';
import { createCrudService, type EntityCreateInput, type EntityUpdateInput } from './localCrud';

export type CreatePregnancyDiagnosisInput = EntityCreateInput<PregnancyDiagnosis>;
export type UpdatePregnancyDiagnosisInput = EntityUpdateInput<PregnancyDiagnosis>;

const MINIMUM_DIAGNOSIS_DATE = '1990-01-01';

function preparePregnancyDiagnosis(record: PregnancyDiagnosis): PregnancyDiagnosis {
  return {
    ...record,
    animal_id: record.animal_id.trim(),
    insemination_id: normalizeOptionalText(record.insemination_id),
    method: record.method ?? 'ultrasound',
    responsible: normalizeOptionalText(record.responsible),
    notes: normalizeOptionalText(record.notes),
  };
}

async function validatePregnancyDiagnosis(record: PregnancyDiagnosis) {
  assertRequiredText(record.animal_id, 'Matriz avaliada');
  assertRequiredDate(record.diagnosis_date, 'Data do diagnóstico');
  assertRequiredText(record.method, 'Método');
  assertRequiredText(record.result, 'Resultado');
  assertOptionalDate(record.expected_birth_date, 'Previsão de parto');

  if (
    isFutureDate(record.diagnosis_date) ||
    isBeforeDate(record.diagnosis_date, MINIMUM_DIAGNOSIS_DATE)
  ) {
    throw new Error('Informe uma data de diagnóstico válida.');
  }

  const matrix = await animalsService.getById(record.animal_id);

  if (!matrix || matrix.sex !== 'female' || !['matrix', 'heifer'].includes(matrix.category)) {
    throw new Error('Selecione uma matriz ou novilha válida.');
  }

  if (record.insemination_id) {
    const relatedInsemination = await inseminationsService.getById(record.insemination_id);

    if (!relatedInsemination || relatedInsemination.animal_id !== record.animal_id) {
      throw new Error('A inseminação relacionada não pertence à matriz selecionada.');
    }

    if (record.diagnosis_date < relatedInsemination.date) {
      throw new Error('O diagnóstico não pode ser anterior à inseminação relacionada.');
    }
  }
}

const basePregnancyDiagnosesService = createCrudService<PregnancyDiagnosis>({
  table: db.pregnancyDiagnoses,
  entityName: 'pregnancyDiagnoses',
  idPrefix: 'pregnancy',
  prepare: preparePregnancyDiagnosis,
  validate: validatePregnancyDiagnosis,
});

async function setMatrixStatus(animalId: string, status?: MatrixReproductiveStatus) {
  if (!status) {
    return;
  }

  await animalsService.update(animalId, { reproductive_status: status });
}

async function updateRelatedInsemination(diagnosis: PregnancyDiagnosis) {
  if (!diagnosis.insemination_id) {
    return;
  }

  const relatedInsemination = await inseminationsService.getById(diagnosis.insemination_id);

  if (!relatedInsemination) {
    return;
  }

  await inseminationsService.update(diagnosis.insemination_id, {
    status: inseminationStatusFromDiagnosis(diagnosis.result),
  });
}

async function refreshMatrixStatus(animalId: string) {
  const births = await db.births.where('animal_id').equals(animalId).toArray();
  const activeBirth = births
    .filter((birth) => !birth.deleted_at)
    .sort((a, b) => b.birth_date.localeCompare(a.birth_date))[0];

  if (activeBirth) {
    await animalsService.update(animalId, { reproductive_status: 'calved' });
    return;
  }

  const diagnoses = await db.pregnancyDiagnoses.where('animal_id').equals(animalId).toArray();
  const latestConclusiveDiagnosis = diagnoses
    .filter((diagnosis) => !diagnosis.deleted_at && diagnosis.result !== 'inconclusive')
    .sort((a, b) => b.diagnosis_date.localeCompare(a.diagnosis_date))[0];

  if (latestConclusiveDiagnosis) {
    await setMatrixStatus(
      animalId,
      reproductiveStatusFromDiagnosis(latestConclusiveDiagnosis.result),
    );
    return;
  }

  const inseminations = (await inseminationsService.list())
    .filter((insemination) => insemination.animal_id === animalId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestInsemination = inseminations[0];

  if (!latestInsemination) {
    await animalsService.update(animalId, { reproductive_status: 'empty' });
    return;
  }

  const nextStatus: MatrixReproductiveStatus =
    latestInsemination.status === 'positive'
      ? 'pregnant'
      : latestInsemination.status === 'negative' || latestInsemination.status === 'aborted'
        ? 'empty'
        : 'inseminated';

  await animalsService.update(animalId, { reproductive_status: nextStatus });
}

export async function create(data: CreatePregnancyDiagnosisInput) {
  const relatedInsemination = data.insemination_id
    ? await inseminationsService.getById(data.insemination_id)
    : undefined;
  const record = await basePregnancyDiagnosesService.create({
    ...data,
    expected_birth_date: data.expected_birth_date ?? relatedInsemination?.birth_due_date,
  });

  await setMatrixStatus(record.animal_id, reproductiveStatusFromDiagnosis(record.result));
  await updateRelatedInsemination(record);

  return record;
}

export async function update(id: string, data: UpdatePregnancyDiagnosisInput) {
  const existing = await basePregnancyDiagnosesService.getById(id);

  if (!existing) {
    throw new Error('Diagnóstico não encontrado.');
  }

  const nextInseminationId = data.insemination_id ?? existing.insemination_id;
  const relatedInsemination: Insemination | undefined = nextInseminationId
    ? await inseminationsService.getById(nextInseminationId)
    : undefined;
  const record = await basePregnancyDiagnosesService.update(id, {
    ...data,
    expected_birth_date: data.expected_birth_date ?? relatedInsemination?.birth_due_date,
  });

  if (existing.insemination_id && existing.insemination_id !== record.insemination_id) {
    await inseminationsService.update(existing.insemination_id, {
      status: 'awaiting_diagnosis',
    });
  }

  await setMatrixStatus(record.animal_id, reproductiveStatusFromDiagnosis(record.result));
  await updateRelatedInsemination(record);

  if (existing.animal_id !== record.animal_id) {
    await refreshMatrixStatus(existing.animal_id);
  }

  return record;
}

export async function deletePregnancyDiagnosis(id: string) {
  const existing = await basePregnancyDiagnosesService.getById(id);

  if (!existing) {
    throw new Error('Diagnóstico não encontrado.');
  }

  const record = await basePregnancyDiagnosesService.delete(id);

  if (record.insemination_id) {
    await inseminationsService.update(record.insemination_id, {
      status: 'awaiting_diagnosis',
    });
  }

  await refreshMatrixStatus(record.animal_id);

  return record;
}

export const list = basePregnancyDiagnosesService.list;
export const getById = basePregnancyDiagnosesService.getById;

export const pregnancyDiagnosesService = {
  create,
  update,
  delete: deletePregnancyDiagnosis,
  list,
  getById,
};
