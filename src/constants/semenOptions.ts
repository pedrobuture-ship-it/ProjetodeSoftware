import type { SemenStatus } from '../types';

export const LOW_SEMEN_DOSES_LIMIT = 5;

export const semenStatusOptions: Array<{ value: SemenStatus; label: string }> = [
  { value: 'active', label: 'Ativo' },
  { value: 'sold_out', label: 'Sem doses' },
  { value: 'inactive', label: 'Inativo' },
];

const semenStatusLabels: Record<SemenStatus, string> = {
  active: 'Ativo',
  sold_out: 'Sem doses',
  inactive: 'Inativo',
};

export function getSemenStatusLabel(status: SemenStatus) {
  return semenStatusLabels[status] ?? status;
}

export function isLowSemenStock(dosesAvailable?: number) {
  return (dosesAvailable ?? 0) > 0 && (dosesAvailable ?? 0) <= LOW_SEMEN_DOSES_LIMIT;
}
