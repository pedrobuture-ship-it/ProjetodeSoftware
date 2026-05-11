import { LOW_SEMEN_DOSES_LIMIT } from '../constants/semenOptions';
import {
  getEffectiveSanitaryStatus,
  isSanitaryOverdue,
  isSanitaryUpcoming,
} from '../constants/sanitaryOptions';
import type {
  Animal,
  Birth,
  Insemination,
  Lot,
  MatrixReproductiveStatus,
  PregnancyDiagnosis,
  SanitaryManagement,
  Semen,
} from '../types';
import {
  addDaysToDateString,
  daysBetweenDateStrings,
  monthKeyFromDateString,
  todayDateString,
} from '../utils/date';
import * as animalsService from './animalsService';
import * as birthsService from './birthsService';
import * as inseminationsService from './inseminationsService';
import * as lotsService from './lotsService';
import * as pregnancyDiagnosesService from './pregnancyDiagnosesService';
import * as sanitaryManagementService from './sanitaryManagementService';
import * as semenService from './semenService';

export type DashboardAlertSeverity = 'danger' | 'warning' | 'info';

export interface DashboardMetrics {
  totalAnimals: number;
  totalMatrices: number;
  totalBulls: number;
  totalCalves: number;
  pregnantCows: number;
  emptyCows: number;
  inseminatedCows: number;
  monthInseminations: number;
  expectedBirths: number;
  pendingSanitaryManagement: number;
  lowSemenStock: number;
}

export interface DashboardAlert {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  severity: DashboardAlertSeverity;
  route: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  alerts: DashboardAlert[];
  generatedAt: string;
}

const UPCOMING_DIAGNOSIS_DAYS = 7;
const UPCOMING_BIRTH_DAYS = 45;
const MATRIX_WITHOUT_INSEMINATION_DAYS = 180;
const ANIMAL_STALE_DAYS = 180;

function isMatrixCandidate(animal: Animal) {
  return (
    animal.sex === 'female' &&
    (animal.category === 'matrix' || animal.category === 'heifer') &&
    animal.status === 'active'
  );
}

function getAnimalLabel(animal?: Animal) {
  if (!animal) {
    return 'Animal não encontrado';
  }

  return `${animal.identification}${animal.name ? ` - ${animal.name}` : ''}`;
}

function getLotLabel(lots: Lot[], lotId?: string) {
  if (!lotId) {
    return 'não informado';
  }

  const lot = lots.find((item) => item.id === lotId || item.name === lotId);
  return lot?.name ?? lotId;
}

function getSemenDoses(semen: Semen) {
  return semen.doses_available ?? semen.quantity ?? 0;
}

function getLatestInsemination(animalId: string, inseminations: Insemination[]) {
  return inseminations
    .filter((insemination) => insemination.animal_id === animalId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

function getLatestDiagnosis(animalId: string, diagnoses: PregnancyDiagnosis[]) {
  return diagnoses
    .filter((diagnosis) => diagnosis.animal_id === animalId && diagnosis.result !== 'inconclusive')
    .sort((a, b) => b.diagnosis_date.localeCompare(a.diagnosis_date))[0];
}

function getLatestBirth(animalId: string, births: Birth[]) {
  return births
    .filter((birth) => birth.animal_id === animalId)
    .sort((a, b) => b.birth_date.localeCompare(a.birth_date))[0];
}

function getDerivedMatrixStatus(
  animal: Animal,
  inseminations: Insemination[],
  diagnoses: PregnancyDiagnosis[],
  births: Birth[],
): MatrixReproductiveStatus {
  if (animal.status === 'discarded' || animal.status === 'dead' || animal.category === 'discard') {
    return 'discarded';
  }

  const latestInsemination = getLatestInsemination(animal.id, inseminations);
  const latestDiagnosis = getLatestDiagnosis(animal.id, diagnoses);
  const latestBirth = getLatestBirth(animal.id, births);

  if (latestBirth && (!latestInsemination || latestBirth.birth_date >= latestInsemination.date)) {
    return 'calved';
  }

  if (latestDiagnosis && (!latestInsemination || latestDiagnosis.diagnosis_date >= latestInsemination.date)) {
    return latestDiagnosis.result === 'pregnant' ? 'pregnant' : 'empty';
  }

  if (latestInsemination) {
    if (latestInsemination.status === 'positive') {
      return 'pregnant';
    }

    if (latestInsemination.status === 'negative' || latestInsemination.status === 'aborted') {
      return 'empty';
    }

    return 'inseminated';
  }

  return animal.reproductive_status ?? 'empty';
}

function isDateWithinNextDays(date: string | undefined, days: number, today: string) {
  if (!date || date < today) {
    return false;
  }

  return date <= addDaysToDateString(today, days);
}

function buildMetrics(
  animals: Animal[],
  inseminations: Insemination[],
  diagnoses: PregnancyDiagnosis[],
  births: Birth[],
  sanitaryRecords: SanitaryManagement[],
  semenRecords: Semen[],
  today: string,
): DashboardMetrics {
  const matrixAnimals = animals.filter(isMatrixCandidate);
  const matrixStatuses = matrixAnimals.map((animal) =>
    getDerivedMatrixStatus(animal, inseminations, diagnoses, births),
  );
  const currentMonth = monthKeyFromDateString(today);
  const expectedBirthMatrixIds = new Set<string>();

  for (const insemination of inseminations) {
    if (
      insemination.birth_due_date &&
      insemination.birth_due_date >= today &&
      insemination.status === 'positive'
    ) {
      expectedBirthMatrixIds.add(insemination.animal_id);
    }
  }

  for (const diagnosis of diagnoses) {
    if (diagnosis.result === 'pregnant' && diagnosis.expected_birth_date && diagnosis.expected_birth_date >= today) {
      expectedBirthMatrixIds.add(diagnosis.animal_id);
    }
  }

  return {
    totalAnimals: animals.length,
    totalMatrices: animals.filter((animal) => animal.category === 'matrix').length,
    totalBulls: animals.filter((animal) => animal.category === 'bull').length,
    totalCalves: animals.filter((animal) => animal.category === 'calf').length,
    pregnantCows: matrixStatuses.filter((status) => status === 'pregnant').length,
    emptyCows: matrixStatuses.filter((status) => status === 'empty').length,
    inseminatedCows: matrixStatuses.filter((status) => status === 'inseminated').length,
    monthInseminations: inseminations.filter((insemination) =>
      monthKeyFromDateString(insemination.date) === currentMonth,
    ).length,
    expectedBirths: expectedBirthMatrixIds.size,
    pendingSanitaryManagement: sanitaryRecords.filter(
      (record) => getEffectiveSanitaryStatus(record.status ?? 'done', record.next_application_date) !== 'done',
    ).length,
    lowSemenStock: semenRecords.filter((semen) => getSemenDoses(semen) <= LOW_SEMEN_DOSES_LIMIT).length,
  };
}

function buildAlerts(
  animals: Animal[],
  inseminations: Insemination[],
  diagnoses: PregnancyDiagnosis[],
  births: Birth[],
  sanitaryRecords: SanitaryManagement[],
  semenRecords: Semen[],
  lots: Lot[],
  today: string,
) {
  const alerts: DashboardAlert[] = [];

  for (const insemination of inseminations) {
    const animal = animals.find((item) => item.id === insemination.animal_id);

    if (
      (insemination.status ?? 'awaiting_diagnosis') === 'awaiting_diagnosis' &&
      isDateWithinNextDays(insemination.diagnosis_due_date, UPCOMING_DIAGNOSIS_DAYS, today)
    ) {
      alerts.push({
        id: `diagnosis-${insemination.id}`,
        title: 'Diagnóstico de gestação próximo',
        description: `${getAnimalLabel(animal)} deve ser avaliada.`,
        dueDate: insemination.diagnosis_due_date,
        severity: 'info',
        route: '/diagnostico-gestacao',
      });
    }

    if (
      (insemination.status === 'positive' || animal?.reproductive_status === 'pregnant') &&
      isDateWithinNextDays(insemination.birth_due_date, UPCOMING_BIRTH_DAYS, today)
    ) {
      alerts.push({
        id: `birth-${insemination.id}`,
        title: 'Parto previsto',
        description: `${getAnimalLabel(animal)} tem parto previsto.`,
        dueDate: insemination.birth_due_date,
        severity: 'warning',
        route: '/partos',
      });
    }
  }

  for (const diagnosis of diagnoses) {
    const animal = animals.find((item) => item.id === diagnosis.animal_id);

    if (
      diagnosis.result === 'pregnant' &&
      isDateWithinNextDays(diagnosis.expected_birth_date, UPCOMING_BIRTH_DAYS, today)
    ) {
      alerts.push({
        id: `diagnosis-birth-${diagnosis.id}`,
        title: 'Parto previsto',
        description: `${getAnimalLabel(animal)} tem previsão de parto pelo diagnóstico.`,
        dueDate: diagnosis.expected_birth_date,
        severity: 'warning',
        route: '/partos',
      });
    }
  }

  for (const record of sanitaryRecords) {
    if (record.procedure_type !== 'vaccine' && record.procedure_type !== 'deworming') {
      continue;
    }

    const target = record.animal_id
      ? getAnimalLabel(animals.find((animal) => animal.id === record.animal_id))
      : `Lote ${getLotLabel(lots, record.lot_id)}`;

    if (isSanitaryOverdue(record.next_application_date, record.status)) {
      alerts.push({
        id: `sanitary-overdue-${record.id}`,
        title: record.procedure_type === 'vaccine' ? 'Vacina vencida' : 'Vermífugo vencido',
        description: `${target} precisa de reaplicação.`,
        dueDate: record.next_application_date,
        severity: 'danger',
        route: '/manejo-sanitario',
      });
      continue;
    }

    if (isSanitaryUpcoming(record.next_application_date, record.status)) {
      alerts.push({
        id: `sanitary-upcoming-${record.id}`,
        title: record.procedure_type === 'vaccine' ? 'Vacina vencendo' : 'Vermífugo vencendo',
        description: `${target} tem reaplicação próxima.`,
        dueDate: record.next_application_date,
        severity: 'warning',
        route: '/manejo-sanitario',
      });
    }
  }

  for (const animal of animals.filter(isMatrixCandidate)) {
    const matrixStatus = getDerivedMatrixStatus(animal, inseminations, diagnoses, births);

    if (matrixStatus !== 'empty' && matrixStatus !== 'calved') {
      continue;
    }

    const latestInsemination = getLatestInsemination(animal.id, inseminations);
    const daysWithoutInsemination = latestInsemination
      ? daysBetweenDateStrings(latestInsemination.date, today)
      : daysBetweenDateStrings(animal.updated_at.slice(0, 10), today);

    if (daysWithoutInsemination >= MATRIX_WITHOUT_INSEMINATION_DAYS) {
      alerts.push({
        id: `matrix-without-insemination-${animal.id}`,
        title: 'Matriz muito tempo sem inseminação',
        description: `${getAnimalLabel(animal)} está há ${daysWithoutInsemination} dias sem inseminação registrada.`,
        dueDate: latestInsemination?.date,
        severity: 'warning',
        route: '/matrizes',
      });
    }
  }

  for (const semen of semenRecords) {
    const doses = getSemenDoses(semen);

    if (doses <= LOW_SEMEN_DOSES_LIMIT) {
      alerts.push({
        id: `semen-low-${semen.id}`,
        title: 'Estoque baixo de sêmen',
        description: `${semen.bull_name} está com ${doses} dose(s) disponível(is).`,
        severity: doses === 0 ? 'danger' : 'warning',
        route: '/touros-semen',
      });
    }
  }

  for (const animal of animals) {
    const daysWithoutUpdate = daysBetweenDateStrings(animal.updated_at.slice(0, 10), today);

    if (daysWithoutUpdate >= ANIMAL_STALE_DAYS) {
      alerts.push({
        id: `animal-stale-${animal.id}`,
        title: 'Animal sem atualização recente',
        description: `${getAnimalLabel(animal)} não é atualizado há ${daysWithoutUpdate} dias.`,
        dueDate: animal.updated_at.slice(0, 10),
        severity: 'info',
        route: '/animais',
      });
    }
  }

  return alerts.sort((a, b) => {
    const severityOrder: Record<DashboardAlertSeverity, number> = {
      danger: 0,
      warning: 1,
      info: 2,
    };

    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }

    return (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  const [animals, inseminations, diagnoses, births, sanitaryRecords, semenRecords, lots] =
    await Promise.all([
      animalsService.list(),
      inseminationsService.list(),
      pregnancyDiagnosesService.list(),
      birthsService.list(),
      sanitaryManagementService.list(),
      semenService.list(),
      lotsService.list(),
    ]);
  const today = todayDateString();

  return {
    metrics: buildMetrics(
      animals,
      inseminations,
      diagnoses,
      births,
      sanitaryRecords,
      semenRecords,
      today,
    ),
    alerts: buildAlerts(
      animals,
      inseminations,
      diagnoses,
      births,
      sanitaryRecords,
      semenRecords,
      lots,
      today,
    ),
    generatedAt: new Date().toISOString(),
  };
}
