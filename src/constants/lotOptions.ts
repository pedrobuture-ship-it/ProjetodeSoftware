import type { LotStatus, LotType } from '../types';

export const lotTypeOptions: Array<{ value: LotType; label: string }> = [
  { value: 'paddock', label: 'Piquete' },
  { value: 'lot', label: 'Lote' },
];

export const lotStatusOptions: Array<{ value: LotStatus; label: string }> = [
  { value: 'active', label: 'Ativo' },
  { value: 'maintenance', label: 'Em manutenção' },
  { value: 'inactive', label: 'Inativo' },
];

const lotTypeLabels: Record<LotType, string> = {
  paddock: 'Piquete',
  lot: 'Lote',
};

const lotStatusLabels: Record<LotStatus, string> = {
  active: 'Ativo',
  maintenance: 'Em manutenção',
  inactive: 'Inativo',
};

export function getLotTypeLabel(type: LotType) {
  return lotTypeLabels[type] ?? type;
}

export function getLotStatusLabel(status: LotStatus) {
  return lotStatusLabels[status] ?? status;
}
