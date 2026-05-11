import type {
  BirthType,
  CalfStatus,
  InseminationStatus,
  InseminationType,
  MatrixReproductiveStatus,
  PregnancyDiagnosisMethod,
  PregnancyDiagnosisResult,
} from '../types';

export const PREGNANCY_DIAGNOSIS_DAYS = 30;
export const CATTLE_GESTATION_DAYS = 283;

export const matrixReproductiveStatusOptions: Array<{
  value: MatrixReproductiveStatus;
  label: string;
}> = [
  { value: 'empty', label: 'Vazia' },
  { value: 'inseminated', label: 'Inseminada' },
  { value: 'pregnant', label: 'Prenha' },
  { value: 'calved', label: 'Parida' },
  { value: 'discarded', label: 'Descartada' },
];

export const inseminationTypeOptions: Array<{ value: InseminationType; label: string }> = [
  { value: 'iatf', label: 'IATF' },
  { value: 'conventional_ai', label: 'IA convencional' },
  { value: 'natural_mating', label: 'Monta natural' },
];

export const inseminationStatusOptions: Array<{ value: InseminationStatus; label: string }> = [
  { value: 'awaiting_diagnosis', label: 'Aguardando diagnóstico' },
  { value: 'positive', label: 'Positiva' },
  { value: 'negative', label: 'Negativa' },
  { value: 'aborted', label: 'Abortada' },
];

export const pregnancyDiagnosisMethodOptions: Array<{
  value: PregnancyDiagnosisMethod;
  label: string;
}> = [
  { value: 'ultrasound', label: 'Ultrassom' },
  { value: 'palpation', label: 'Palpação' },
  { value: 'observation', label: 'Observação' },
  { value: 'other', label: 'Outro' },
];

export const pregnancyDiagnosisResultOptions: Array<{
  value: PregnancyDiagnosisResult;
  label: string;
}> = [
  { value: 'pregnant', label: 'Prenha' },
  { value: 'empty', label: 'Vazia' },
  { value: 'inconclusive', label: 'Inconclusivo' },
];

export const birthTypeOptions: Array<{ value: BirthType; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'assisted', label: 'Auxiliado' },
  { value: 'cesarean', label: 'Cesárea' },
];

export const calfStatusOptions: Array<{ value: CalfStatus; label: string }> = [
  { value: 'alive', label: 'Vivo' },
  { value: 'dead', label: 'Morto' },
  { value: 'weak', label: 'Fraco' },
  { value: 'sold', label: 'Vendido' },
];

const matrixStatusLabels: Record<MatrixReproductiveStatus, string> = {
  empty: 'Vazia',
  inseminated: 'Inseminada',
  pregnant: 'Prenha',
  calved: 'Parida',
  discarded: 'Descartada',
};

const inseminationTypeLabels: Record<InseminationType, string> = {
  iatf: 'IATF',
  conventional_ai: 'IA convencional',
  natural_mating: 'Monta natural',
};

const inseminationStatusLabels: Record<InseminationStatus, string> = {
  awaiting_diagnosis: 'Aguardando diagnóstico',
  positive: 'Positiva',
  negative: 'Negativa',
  aborted: 'Abortada',
};

const pregnancyDiagnosisMethodLabels: Record<PregnancyDiagnosisMethod, string> = {
  ultrasound: 'Ultrassom',
  palpation: 'Palpação',
  observation: 'Observação',
  other: 'Outro',
};

const pregnancyDiagnosisResultLabels: Record<PregnancyDiagnosisResult, string> = {
  pregnant: 'Prenha',
  empty: 'Vazia',
  inconclusive: 'Inconclusivo',
};

const birthTypeLabels: Record<BirthType, string> = {
  normal: 'Normal',
  assisted: 'Auxiliado',
  cesarean: 'Cesárea',
};

const calfStatusLabels: Record<CalfStatus, string> = {
  alive: 'Vivo',
  dead: 'Morto',
  weak: 'Fraco',
  sold: 'Vendido',
};

export function getMatrixReproductiveStatusLabel(status: MatrixReproductiveStatus) {
  return matrixStatusLabels[status] ?? status;
}

export function getInseminationTypeLabel(type?: InseminationType) {
  return type ? inseminationTypeLabels[type] : '-';
}

export function getInseminationStatusLabel(status?: InseminationStatus) {
  return status ? inseminationStatusLabels[status] : '-';
}

export function getPregnancyDiagnosisMethodLabel(method?: PregnancyDiagnosisMethod) {
  return method ? pregnancyDiagnosisMethodLabels[method] : '-';
}

export function getPregnancyDiagnosisResultLabel(result?: PregnancyDiagnosisResult) {
  return result ? pregnancyDiagnosisResultLabels[result] : '-';
}

export function getBirthTypeLabel(type?: BirthType) {
  return type ? birthTypeLabels[type] : '-';
}

export function getCalfStatusLabel(status?: CalfStatus) {
  return status ? calfStatusLabels[status] : '-';
}

export function inseminationStatusFromDiagnosis(result: PregnancyDiagnosisResult) {
  if (result === 'pregnant') {
    return 'positive';
  }

  if (result === 'empty') {
    return 'negative';
  }

  return 'awaiting_diagnosis';
}

export function reproductiveStatusFromDiagnosis(result: PregnancyDiagnosisResult) {
  if (result === 'pregnant') {
    return 'pregnant';
  }

  if (result === 'empty') {
    return 'empty';
  }

  return undefined;
}

export function reproductiveStatusFromInsemination(status?: InseminationStatus) {
  if (status === 'positive') {
    return 'pregnant';
  }

  if (status === 'negative' || status === 'aborted') {
    return 'empty';
  }

  return 'inseminated';
}
