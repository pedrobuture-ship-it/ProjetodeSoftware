import type { AnimalCategory, AnimalSex, AnimalStatus } from '../types';

export const animalCategoryOptions: Array<{ value: AnimalCategory; label: string }> = [
  { value: 'matrix', label: 'Matriz' },
  { value: 'bull', label: 'Touro' },
  { value: 'calf', label: 'Bezerro' },
  { value: 'heifer', label: 'Novilha' },
  { value: 'steer', label: 'Garrote' },
  { value: 'discard', label: 'Descarte' },
];

export const animalSexOptions: Array<{ value: AnimalSex; label: string }> = [
  { value: 'female', label: 'Fêmea' },
  { value: 'male', label: 'Macho' },
];

export const animalStatusOptions: Array<{ value: AnimalStatus; label: string }> = [
  { value: 'active', label: 'Ativo' },
  { value: 'sold', label: 'Vendido' },
  { value: 'dead', label: 'Morto' },
  { value: 'discarded', label: 'Descartado' },
];

const animalCategoryLabels: Record<AnimalCategory, string> = {
  matrix: 'Matriz',
  bull: 'Touro',
  calf: 'Bezerro',
  heifer: 'Novilha',
  steer: 'Garrote',
  discard: 'Descarte',
  other: 'Outro',
};

const animalSexLabels: Record<AnimalSex, string> = {
  female: 'Fêmea',
  male: 'Macho',
  unknown: 'Não informado',
};

const animalStatusLabels: Record<AnimalStatus, string> = {
  active: 'Ativo',
  sold: 'Vendido',
  dead: 'Morto',
  discarded: 'Descartado',
  inactive: 'Inativo',
};

export function getAnimalCategoryLabel(category: AnimalCategory) {
  return animalCategoryLabels[category] ?? category;
}

export function getAnimalSexLabel(sex: AnimalSex) {
  return animalSexLabels[sex] ?? sex;
}

export function getAnimalStatusLabel(status: AnimalStatus) {
  return animalStatusLabels[status] ?? status;
}
