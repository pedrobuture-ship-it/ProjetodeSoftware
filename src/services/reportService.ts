import {
  getAnimalCategoryLabel,
  getAnimalSexLabel,
  getAnimalStatusLabel,
} from '../constants/animalOptions';
import { getLotStatusLabel, getLotTypeLabel } from '../constants/lotOptions';
import {
  getBirthTypeLabel,
  getCalfStatusLabel,
  getInseminationStatusLabel,
  getInseminationTypeLabel,
  getMatrixReproductiveStatusLabel,
  getPregnancyDiagnosisMethodLabel,
  getPregnancyDiagnosisResultLabel,
} from '../constants/reproductionOptions';
import {
  getEffectiveSanitaryStatus,
  getSanitaryStatusLabel,
  getSanitaryTypeLabel,
} from '../constants/sanitaryOptions';
import { getSemenStatusLabel } from '../constants/semenOptions';
import type {
  Animal,
  Birth,
  BirthOutcome,
  FarmSettings,
  Insemination,
  Lot,
  PregnancyDiagnosis,
  SanitaryManagement,
  Semen,
} from '../types';
import { buildCsv, type CsvValue } from '../utils/csv';
import { todayDateString } from '../utils/date';
import { timestampForFilename } from '../utils/download';
import {
  formatDatePtBr,
  formatWeightKg,
} from '../utils/format';
import { createSimplePdfBlob, type PdfSection } from '../utils/pdf';
import * as animalsService from './animalsService';
import * as birthsService from './birthsService';
import * as farmSettingsService from './farmSettingsService';
import * as inseminationsService from './inseminationsService';
import * as lotsService from './lotsService';
import * as pregnancyDiagnosesService from './pregnancyDiagnosesService';
import * as sanitaryManagementService from './sanitaryManagementService';
import * as semenService from './semenService';

export type CsvReportKey =
  | 'animals'
  | 'matrices'
  | 'inseminations'
  | 'diagnoses'
  | 'births'
  | 'sanitaryManagement'
  | 'semen'
  | 'lots';

export type PdfReportKey =
  | 'general'
  | 'animalCard'
  | 'matrixHistory'
  | 'expectedBirths'
  | 'pendingSanitary';

export interface ReportDataset {
  animals: Animal[];
  inseminations: Insemination[];
  diagnoses: PregnancyDiagnosis[];
  births: Birth[];
  sanitaryRecords: SanitaryManagement[];
  semenRecords: Semen[];
  lots: Lot[];
  farmSettings: FarmSettings[];
}

export interface GeneratedTextReport {
  filename: string;
  content: string;
}

export interface GeneratedBlobReport {
  filename: string;
  blob: Blob;
}

interface PdfReportOptions {
  animalId?: string;
  matrixId?: string;
}

export const csvReportOptions: Array<{ key: CsvReportKey; label: string }> = [
  { key: 'animals', label: 'Animais' },
  { key: 'matrices', label: 'Matrizes' },
  { key: 'inseminations', label: 'Inseminações' },
  { key: 'diagnoses', label: 'Diagnósticos' },
  { key: 'births', label: 'Partos' },
  { key: 'sanitaryManagement', label: 'Manejo sanitário' },
  { key: 'semen', label: 'Sêmen' },
  { key: 'lots', label: 'Lotes' },
];

const csvReportFilenames: Record<CsvReportKey, string> = {
  animals: 'animais',
  matrices: 'matrizes',
  inseminations: 'inseminacoes',
  diagnoses: 'diagnosticos',
  births: 'partos',
  sanitaryManagement: 'manejo-sanitario',
  semen: 'semen',
  lots: 'lotes',
};

const birthOutcomeLabels: Record<BirthOutcome, string> = {
  alive: 'Vivo',
  stillborn: 'Natimorto',
  abortion: 'Aborto',
  unknown: 'Não informado',
};

function getFarmName(dataset: ReportDataset) {
  return dataset.farmSettings[0]?.farm_name ?? 'Fazenda sem nome';
}

function getAnimal(dataset: ReportDataset, animalId?: string) {
  return animalId ? dataset.animals.find((animal) => animal.id === animalId) : undefined;
}

function getLot(dataset: ReportDataset, lotId?: string) {
  return lotId ? dataset.lots.find((lot) => lot.id === lotId) : undefined;
}

function getSemen(dataset: ReportDataset, semenId?: string) {
  return semenId ? dataset.semenRecords.find((semen) => semen.id === semenId) : undefined;
}

function getAnimalLabel(dataset: ReportDataset, animalId?: string) {
  const animal = getAnimal(dataset, animalId);

  if (!animal) {
    return animalId ? 'Animal não encontrado' : '-';
  }

  return `${animal.identification}${animal.name ? ` - ${animal.name}` : ''}`;
}

function getLotLabel(dataset: ReportDataset, lotId?: string) {
  const lot = getLot(dataset, lotId);
  return lot ? lot.name : lotId ? 'Lote não encontrado' : '-';
}

function getSemenLabel(dataset: ReportDataset, semenId?: string) {
  const semen = getSemen(dataset, semenId);
  return semen ? semen.bull_name : semenId ? 'Sêmen não encontrado' : '-';
}

function isMatrix(animal: Animal) {
  return animal.sex === 'female' && (animal.category === 'matrix' || animal.category === 'heifer');
}

function getLatestInsemination(dataset: ReportDataset, animalId: string) {
  return dataset.inseminations
    .filter((insemination) => insemination.animal_id === animalId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

function csvFilename(key: CsvReportKey) {
  return `fazenda-cria-${csvReportFilenames[key]}-${timestampForFilename()}.csv`;
}

function pdfFilename(slug: string) {
  return `fazenda-cria-${slug}-${timestampForFilename()}.pdf`;
}

function makeCsvReport(filenameKey: CsvReportKey, headers: string[], rows: CsvValue[][]) {
  return {
    filename: csvFilename(filenameKey),
    content: buildCsv(headers, rows),
  };
}

function animalRows(dataset: ReportDataset) {
  return dataset.animals.map((animal) => [
    animal.identification,
    animal.name,
    getAnimalCategoryLabel(animal.category),
    getAnimalSexLabel(animal.sex),
    animal.breed,
    formatDatePtBr(animal.birth_date),
    animal.weight_kg,
    getLotLabel(dataset, animal.lot_id),
    getAnimalStatusLabel(animal.status),
    animal.reproductive_status ? getMatrixReproductiveStatusLabel(animal.reproductive_status) : '',
    getAnimalLabel(dataset, animal.mother_id),
    getAnimalLabel(dataset, animal.father_id),
    animal.notes,
    formatDatePtBr(animal.updated_at),
  ]);
}

function matrixRows(dataset: ReportDataset) {
  return dataset.animals.filter(isMatrix).map((animal) => {
    const latestInsemination = getLatestInsemination(dataset, animal.id);

    return [
      animal.identification,
      animal.name,
      getAnimalCategoryLabel(animal.category),
      animal.breed,
      getAnimalStatusLabel(animal.status),
      animal.reproductive_status ? getMatrixReproductiveStatusLabel(animal.reproductive_status) : 'Vazia',
      formatDatePtBr(latestInsemination?.date),
      formatDatePtBr(latestInsemination?.diagnosis_due_date),
      formatDatePtBr(latestInsemination?.birth_due_date),
      getLotLabel(dataset, animal.lot_id),
      animal.notes,
    ];
  });
}

export async function loadReportDataset(): Promise<ReportDataset> {
  const [
    animals,
    inseminations,
    diagnoses,
    births,
    sanitaryRecords,
    semenRecords,
    lots,
    farmSettings,
  ] = await Promise.all([
    animalsService.list(),
    inseminationsService.list(),
    pregnancyDiagnosesService.list(),
    birthsService.list(),
    sanitaryManagementService.list(),
    semenService.list(),
    lotsService.list(),
    farmSettingsService.list(),
  ]);

  return {
    animals,
    inseminations,
    diagnoses,
    births,
    sanitaryRecords,
    semenRecords,
    lots,
    farmSettings,
  };
}

export function buildCsvReport(key: CsvReportKey, dataset: ReportDataset): GeneratedTextReport {
  if (key === 'animals') {
    return makeCsvReport(
      key,
      [
        'Brinco',
        'Nome',
        'Categoria',
        'Sexo',
        'Raça',
        'Nascimento',
        'Peso kg',
        'Lote',
        'Status',
        'Status reprodutivo',
        'Mãe',
        'Pai',
        'Observações',
        'Atualizado em',
      ],
      animalRows(dataset),
    );
  }

  if (key === 'matrices') {
    return makeCsvReport(
      key,
      [
        'Brinco',
        'Nome',
        'Categoria',
        'Raça',
        'Status',
        'Status reprodutivo',
        'Última inseminação',
        'Previsão diagnóstico',
        'Previsão parto',
        'Lote',
        'Observações',
      ],
      matrixRows(dataset),
    );
  }

  if (key === 'inseminations') {
    return makeCsvReport(
      key,
      [
        'Matriz',
        'Data',
        'Touro/Sêmen',
        'Inseminador',
        'Protocolo',
        'Tipo',
        'Status',
        'Previsão diagnóstico',
        'Previsão parto',
        'Observações',
      ],
      dataset.inseminations.map((insemination) => [
        getAnimalLabel(dataset, insemination.animal_id),
        formatDatePtBr(insemination.date),
        getSemenLabel(dataset, insemination.semen_id),
        insemination.technician,
        insemination.protocol,
        getInseminationTypeLabel(insemination.type),
        getInseminationStatusLabel(insemination.status),
        formatDatePtBr(insemination.diagnosis_due_date),
        formatDatePtBr(insemination.birth_due_date),
        insemination.notes,
      ]),
    );
  }

  if (key === 'diagnoses') {
    return makeCsvReport(
      key,
      ['Matriz', 'Data', 'Método', 'Resultado', 'Previsão parto', 'Responsável', 'Observações'],
      dataset.diagnoses.map((diagnosis) => [
        getAnimalLabel(dataset, diagnosis.animal_id),
        formatDatePtBr(diagnosis.diagnosis_date),
        getPregnancyDiagnosisMethodLabel(diagnosis.method),
        getPregnancyDiagnosisResultLabel(diagnosis.result),
        formatDatePtBr(diagnosis.expected_birth_date),
        diagnosis.responsible,
        diagnosis.notes,
      ]),
    );
  }

  if (key === 'births') {
    return makeCsvReport(
      key,
      [
        'Matriz',
        'Data',
        'Tipo de parto',
        'Quantidade',
        'Sexo bezerro',
        'Peso ao nascer',
        'Status bezerro',
        'Resultado',
        'Identificação bezerro',
        'Responsável',
        'Observações',
      ],
      dataset.births.map((birth) => [
        getAnimalLabel(dataset, birth.animal_id),
        formatDatePtBr(birth.birth_date),
        getBirthTypeLabel(birth.birth_type),
        birth.calf_count,
        birth.calf_sex ? getAnimalSexLabel(birth.calf_sex) : '',
        birth.birth_weight_kg,
        getCalfStatusLabel(birth.calf_status),
        birthOutcomeLabels[birth.outcome] ?? birth.outcome,
        birth.calf_identification,
        birth.responsible,
        birth.notes,
      ]),
    );
  }

  if (key === 'sanitaryManagement') {
    return makeCsvReport(
      key,
      [
        'Tipo',
        'Animal',
        'Lote',
        'Data',
        'Próxima aplicação',
        'Responsável',
        'Produto',
        'Dosagem',
        'Status',
        'Observações',
      ],
      dataset.sanitaryRecords.map((record) => [
        getSanitaryTypeLabel(record.procedure_type),
        getAnimalLabel(dataset, record.animal_id),
        getLotLabel(dataset, record.lot_id),
        formatDatePtBr(record.date),
        formatDatePtBr(record.next_application_date),
        record.responsible,
        record.product,
        record.dosage,
        getSanitaryStatusLabel(getEffectiveSanitaryStatus(record.status, record.next_application_date)),
        record.notes,
      ]),
    );
  }

  if (key === 'semen') {
    return makeCsvReport(
      key,
      [
        'Nome/Código',
        'Código',
        'Raça',
        'Central',
        'Fornecedor',
        'Doses disponíveis',
        'Valor por dose',
        'Características genéticas',
        'Validade',
        'Status',
        'Observações',
      ],
      dataset.semenRecords.map((semen) => [
        semen.bull_name,
        semen.code,
        semen.breed,
        semen.semen_center,
        semen.supplier,
        semen.doses_available ?? semen.quantity ?? 0,
        semen.price_per_dose,
        semen.genetic_traits,
        formatDatePtBr(semen.expiration_date),
        getSemenStatusLabel(semen.status),
        semen.notes,
      ]),
    );
  }

  return makeCsvReport(
    key,
    ['Nome', 'Tipo', 'Pastagem', 'Área ha', 'Status', 'Observações'],
    dataset.lots.map((lot) => [
      lot.name,
      getLotTypeLabel(lot.type),
      lot.pasture_type,
      lot.area_hectares,
      getLotStatusLabel(lot.status),
      lot.description,
    ]),
  );
}

function animalProfileLines(dataset: ReportDataset, animal: Animal) {
  return [
    `Identificação: ${animal.identification}`,
    `Nome: ${animal.name || '-'}`,
    `Categoria: ${getAnimalCategoryLabel(animal.category)}`,
    `Sexo: ${getAnimalSexLabel(animal.sex)}`,
    `Raça: ${animal.breed || '-'}`,
    `Nascimento: ${formatDatePtBr(animal.birth_date)}`,
    `Peso: ${formatWeightKg(animal.weight_kg)}`,
    `Lote/piquete: ${getLotLabel(dataset, animal.lot_id)}`,
    `Status: ${getAnimalStatusLabel(animal.status)}`,
    `Status reprodutivo: ${
      animal.reproductive_status ? getMatrixReproductiveStatusLabel(animal.reproductive_status) : '-'
    }`,
    `Mãe: ${getAnimalLabel(dataset, animal.mother_id)}`,
    `Pai: ${getAnimalLabel(dataset, animal.father_id)}`,
    `Observações: ${animal.notes || '-'}`,
  ];
}

function matrixHistoryLines(dataset: ReportDataset, matrix: Animal) {
  const inseminations = dataset.inseminations
    .filter((insemination) => insemination.animal_id === matrix.id)
    .map((insemination) => ({
      date: insemination.date,
      text: `Inseminação em ${formatDatePtBr(insemination.date)} | ${getInseminationTypeLabel(
        insemination.type,
      )} | ${getInseminationStatusLabel(insemination.status)} | ${getSemenLabel(
        dataset,
        insemination.semen_id,
      )}`,
    }));
  const diagnoses = dataset.diagnoses
    .filter((diagnosis) => diagnosis.animal_id === matrix.id)
    .map((diagnosis) => ({
      date: diagnosis.diagnosis_date,
      text: `Diagnóstico em ${formatDatePtBr(diagnosis.diagnosis_date)} | ${getPregnancyDiagnosisMethodLabel(
        diagnosis.method,
      )} | ${getPregnancyDiagnosisResultLabel(diagnosis.result)} | Prev. parto ${formatDatePtBr(
        diagnosis.expected_birth_date,
      )}`,
    }));
  const births = dataset.births
    .filter((birth) => birth.animal_id === matrix.id)
    .map((birth) => ({
      date: birth.birth_date,
      text: `Parto em ${formatDatePtBr(birth.birth_date)} | ${getBirthTypeLabel(
        birth.birth_type,
      )} | ${birth.calf_count ?? 1} bezerro(s) | ${birthOutcomeLabels[birth.outcome] ?? birth.outcome}`,
    }));

  return [...inseminations, ...diagnoses, ...births]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((event) => event.text);
}

function expectedBirthLines(dataset: ReportDataset) {
  const today = todayDateString();
  const fromInseminations = dataset.inseminations
    .filter((insemination) => insemination.birth_due_date && insemination.birth_due_date >= today)
    .filter((insemination) => insemination.status === 'positive')
    .map((insemination) => ({
      date: insemination.birth_due_date ?? '',
      text: `${formatDatePtBr(insemination.birth_due_date)} | ${getAnimalLabel(
        dataset,
        insemination.animal_id,
      )} | Inseminação ${formatDatePtBr(insemination.date)}`,
    }));
  const fromDiagnoses = dataset.diagnoses
    .filter(
      (diagnosis) =>
        diagnosis.result === 'pregnant' &&
        diagnosis.expected_birth_date &&
        diagnosis.expected_birth_date >= today,
    )
    .map((diagnosis) => ({
      date: diagnosis.expected_birth_date ?? '',
      text: `${formatDatePtBr(diagnosis.expected_birth_date)} | ${getAnimalLabel(
        dataset,
        diagnosis.animal_id,
      )} | Diagnóstico ${formatDatePtBr(diagnosis.diagnosis_date)}`,
    }));

  return [...fromInseminations, ...fromDiagnoses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => item.text);
}

function pendingSanitaryLines(dataset: ReportDataset) {
  return dataset.sanitaryRecords
    .filter((record) => getEffectiveSanitaryStatus(record.status, record.next_application_date) !== 'done')
    .sort((a, b) => (a.next_application_date ?? a.date).localeCompare(b.next_application_date ?? b.date))
    .map((record) => {
      const target = record.animal_id
        ? getAnimalLabel(dataset, record.animal_id)
        : getLotLabel(dataset, record.lot_id);

      return `${formatDatePtBr(record.next_application_date || record.date)} | ${getSanitaryTypeLabel(
        record.procedure_type,
      )} | ${target} | ${getSanitaryStatusLabel(
        getEffectiveSanitaryStatus(record.status, record.next_application_date),
      )} | ${record.product || '-'}`;
    });
}

export function buildPdfReport(
  key: PdfReportKey,
  dataset: ReportDataset,
  options: PdfReportOptions = {},
): GeneratedBlobReport {
  const generatedAt = new Date().toISOString();
  const commonSection: PdfSection = {
    title: 'Dados do relatório',
    lines: [
      `Fazenda: ${getFarmName(dataset)}`,
      `Gerado em: ${formatDatePtBr(generatedAt)}`,
      'Origem dos dados: banco local offline deste dispositivo.',
    ],
  };

  if (key === 'general') {
    const matrices = dataset.animals.filter(isMatrix);
    const pregnant = matrices.filter((animal) => animal.reproductive_status === 'pregnant').length;
    const empty = matrices.filter((animal) => animal.reproductive_status === 'empty').length;
    const pendingSanitary = pendingSanitaryLines(dataset).length;
    const lowSemen = dataset.semenRecords.filter(
      (semen) => (semen.doses_available ?? semen.quantity ?? 0) <= 5,
    ).length;

    return {
      filename: pdfFilename('relatorio-geral'),
      blob: createSimplePdfBlob('Relatório geral da fazenda', [
        commonSection,
        {
          title: 'Resumo do rebanho',
          lines: [
            `Total de animais: ${dataset.animals.length}`,
            `Matrizes/novilhas: ${matrices.length}`,
            `Touros: ${dataset.animals.filter((animal) => animal.category === 'bull').length}`,
            `Bezerros: ${dataset.animals.filter((animal) => animal.category === 'calf').length}`,
            `Vacas prenhas: ${pregnant}`,
            `Vacas vazias: ${empty}`,
          ],
        },
        {
          title: 'Operação',
          lines: [
            `Inseminações registradas: ${dataset.inseminations.length}`,
            `Diagnósticos registrados: ${dataset.diagnoses.length}`,
            `Partos registrados: ${dataset.births.length}`,
            `Manejos pendentes/vencidos: ${pendingSanitary}`,
            `Itens de sêmen com estoque baixo ou zerado: ${lowSemen}`,
          ],
        },
      ]),
    };
  }

  if (key === 'animalCard') {
    const animal = getAnimal(dataset, options.animalId);

    if (!animal) {
      throw new Error('Selecione um animal para gerar a ficha individual.');
    }

    return {
      filename: pdfFilename(`ficha-animal-${animal.identification}`),
      blob: createSimplePdfBlob('Ficha individual do animal', [
        commonSection,
        { title: 'Identificação', lines: animalProfileLines(dataset, animal) },
      ]),
    };
  }

  if (key === 'matrixHistory') {
    const matrix = getAnimal(dataset, options.matrixId);

    if (!matrix || !isMatrix(matrix)) {
      throw new Error('Selecione uma matriz ou novilha para gerar o histórico.');
    }

    return {
      filename: pdfFilename(`historico-matriz-${matrix.identification}`),
      blob: createSimplePdfBlob('Histórico da matriz', [
        commonSection,
        { title: 'Matriz', lines: animalProfileLines(dataset, matrix) },
        { title: 'Histórico reprodutivo', lines: matrixHistoryLines(dataset, matrix) },
      ]),
    };
  }

  if (key === 'expectedBirths') {
    return {
      filename: pdfFilename('partos-previstos'),
      blob: createSimplePdfBlob('Partos previstos', [
        commonSection,
        { title: 'Próximos partos', lines: expectedBirthLines(dataset) },
      ]),
    };
  }

  return {
    filename: pdfFilename('manejos-pendentes'),
    blob: createSimplePdfBlob('Manejos pendentes', [
      commonSection,
      { title: 'Manejos pendentes ou vencidos', lines: pendingSanitaryLines(dataset) },
    ]),
  };
}

export function getReportSummary(dataset: ReportDataset) {
  return {
    animals: dataset.animals.length,
    matrices: dataset.animals.filter(isMatrix).length,
    inseminations: dataset.inseminations.length,
    diagnoses: dataset.diagnoses.length,
    births: dataset.births.length,
    sanitary: dataset.sanitaryRecords.length,
    semen: dataset.semenRecords.length,
    lots: dataset.lots.length,
  };
}

export function getMatrixOptions(dataset: ReportDataset) {
  return dataset.animals.filter(isMatrix);
}

export function getAnimalOptions(dataset: ReportDataset) {
  return dataset.animals;
}

export function getAnimalOptionLabel(animal: Animal) {
  return `${animal.identification}${animal.name ? ` - ${animal.name}` : ''}`;
}
