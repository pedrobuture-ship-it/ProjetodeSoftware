import type { SanitaryManagementStatus, SanitaryManagementType } from '../types';
import { addDaysToDateString, todayDateString } from '../utils/date';

export const UPCOMING_SANITARY_DAYS = 30;

export const sanitaryTypeOptions: Array<{ value: SanitaryManagementType; label: string }> = [
  { value: 'vaccine', label: 'Vacina' },
  { value: 'deworming', label: 'Vermífugo' },
  { value: 'medication', label: 'Medicamento' },
  { value: 'veterinary_procedure', label: 'Procedimento veterinário' },
  { value: 'other', label: 'Outro' },
];

export const sanitaryStatusOptions: Array<{ value: SanitaryManagementStatus; label: string }> = [
  { value: 'done', label: 'Realizado' },
  { value: 'pending', label: 'Pendente' },
  { value: 'overdue', label: 'Vencido' },
];

const sanitaryTypeLabels: Record<SanitaryManagementType, string> = {
  vaccine: 'Vacina',
  deworming: 'Vermífugo',
  medication: 'Medicamento',
  veterinary_procedure: 'Procedimento veterinário',
  exam: 'Exame',
  other: 'Outro',
};

const sanitaryStatusLabels: Record<SanitaryManagementStatus, string> = {
  done: 'Realizado',
  pending: 'Pendente',
  overdue: 'Vencido',
};

export function getSanitaryTypeLabel(type: SanitaryManagementType) {
  return sanitaryTypeLabels[type] ?? type;
}

export function getSanitaryStatusLabel(status: SanitaryManagementStatus) {
  return sanitaryStatusLabels[status] ?? status;
}

export function isSanitaryOverdue(nextApplicationDate?: string, status?: SanitaryManagementStatus) {
  if (status === 'overdue') {
    return true;
  }

  return Boolean(nextApplicationDate && nextApplicationDate < todayDateString());
}

export function isSanitaryUpcoming(nextApplicationDate?: string, status?: SanitaryManagementStatus) {
  if (!nextApplicationDate || isSanitaryOverdue(nextApplicationDate, status)) {
    return false;
  }

  return nextApplicationDate <= addDaysToDateString(todayDateString(), UPCOMING_SANITARY_DAYS);
}

export function getEffectiveSanitaryStatus(
  status: SanitaryManagementStatus,
  nextApplicationDate?: string,
) {
  return isSanitaryOverdue(nextApplicationDate, status) ? 'overdue' : status;
}
