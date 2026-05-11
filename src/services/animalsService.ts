import { db } from '../db';
import type { Animal } from '../types';
import {
  assertOptionalDate,
  assertOptionalPositiveNumber,
  assertRequiredText,
  normalizeIdentifier,
  normalizeOptionalText,
  normalizeText,
} from '../utils/validation';
import { createCrudService, type EntityCreateInput, type EntityUpdateInput } from './localCrud';

export type CreateAnimalInput = EntityCreateInput<Animal>;
export type UpdateAnimalInput = EntityUpdateInput<Animal>;

async function ensureUniqueIdentification(identification: string, currentId: string) {
  const normalizedIdentification = normalizeIdentifier(identification);
  const animals = await db.animals.toArray();
  const duplicated = animals.some(
    (animal) =>
      animal.id !== currentId &&
      !animal.deleted_at &&
      normalizeIdentifier(animal.identification) === normalizedIdentification,
  );

  if (duplicated) {
    throw new Error('Já existe um animal com este brinco/identificação.');
  }
}

function prepareAnimal(record: Animal): Animal {
  return {
    ...record,
    identification: normalizeText(record.identification),
    name: normalizeOptionalText(record.name),
    breed: normalizeOptionalText(record.breed),
    lot_id: normalizeOptionalText(record.lot_id),
    mother_id: normalizeOptionalText(record.mother_id),
    father_id: normalizeOptionalText(record.father_id),
    notes: normalizeOptionalText(record.notes),
  };
}

async function validateAnimal(record: Animal) {
  assertRequiredText(record.identification, 'Brinco/identificação');
  assertRequiredText(record.sex, 'Sexo');
  assertRequiredText(record.category, 'Categoria');
  assertRequiredText(record.status, 'Status');
  assertOptionalDate(record.birth_date, 'Data de nascimento');
  assertOptionalPositiveNumber(record.weight_kg, 'Peso');
  await ensureUniqueIdentification(record.identification, record.id);
}

export const animalsService = createCrudService<Animal>({
  table: db.animals,
  entityName: 'animals',
  idPrefix: 'animal',
  prepare: prepareAnimal,
  validate: validateAnimal,
});

export const { create, update, delete: deleteAnimal, list, getById } = animalsService;
