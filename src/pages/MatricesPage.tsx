import { Clock, History, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getAnimalCategoryLabel } from '../constants/animalOptions';
import {
  getInseminationStatusLabel,
  getInseminationTypeLabel,
  getMatrixReproductiveStatusLabel,
  reproductiveStatusFromInsemination,
} from '../constants/reproductionOptions';
import { PageShell } from '../components/layout/PageShell';
import * as animalsService from '../services/animalsService';
import * as birthsService from '../services/birthsService';
import * as inseminationsService from '../services/inseminationsService';
import * as lotsService from '../services/lotsService';
import * as pregnancyDiagnosesService from '../services/pregnancyDiagnosesService';
import * as semenService from '../services/semenService';
import type {
  Animal,
  Birth,
  Insemination,
  Lot,
  MatrixReproductiveStatus,
  PregnancyDiagnosis,
  Semen,
} from '../types';
import { formatDatePtBr } from '../utils/format';

interface MatrixSummary {
  animal: Animal;
  status: MatrixReproductiveStatus;
  latestInsemination?: Insemination;
  diagnosisDueDate?: string;
  birthDueDate?: string;
  history: Array<{ date: string; title: string; description: string }>;
}

function isMatrixAnimal(animal: Animal) {
  return animal.sex === 'female' && (animal.category === 'matrix' || animal.category === 'heifer');
}

function getLatestByDate<T>(records: T[], getDate: (record: T) => string | undefined) {
  return [...records].sort((a, b) => (getDate(b) ?? '').localeCompare(getDate(a) ?? ''))[0];
}

function getSemenName(semenRecords: Semen[], semenId?: string) {
  if (!semenId) {
    return 'Sêmen não informado';
  }

  return semenRecords.find((semen) => semen.id === semenId)?.bull_name ?? 'Sêmen não encontrado';
}

function getLotLabel(lots: Lot[], lotId?: string) {
  if (!lotId) {
    return 'Sem lote';
  }

  const lot = lots.find((item) => item.id === lotId || item.name === lotId);
  return lot?.name ?? lotId;
}

function buildMatrixStatus(
  animal: Animal,
  latestInsemination?: Insemination,
  latestDiagnosis?: PregnancyDiagnosis,
  latestBirth?: Birth,
) {
  if (animal.status === 'discarded' || animal.status === 'dead' || animal.category === 'discard') {
    return 'discarded';
  }

  if (latestBirth && (!latestInsemination || latestBirth.birth_date >= latestInsemination.date)) {
    return 'calved';
  }

  if (
    latestDiagnosis &&
    (!latestInsemination || latestDiagnosis.diagnosis_date >= latestInsemination.date)
  ) {
    if (latestDiagnosis.result === 'pregnant') {
      return 'pregnant';
    }

    if (latestDiagnosis.result === 'empty') {
      return 'empty';
    }
  }

  if (latestInsemination) {
    return reproductiveStatusFromInsemination(latestInsemination.status);
  }

  return animal.reproductive_status ?? 'empty';
}

export function MatricesPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [diagnoses, setDiagnoses] = useState<PregnancyDiagnosis[]>([]);
  const [births, setBirths] = useState<Birth[]>([]);
  const [semenRecords, setSemenRecords] = useState<Semen[]>([]);
  const [selectedMatrixId, setSelectedMatrixId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    try {
      const [animalRecords, lotRecords, inseminationRecords, diagnosisRecords, birthRecords, semenList] =
        await Promise.all([
          animalsService.list(),
          lotsService.list(),
          inseminationsService.list(),
          pregnancyDiagnosesService.list(),
          birthsService.list(),
          semenService.list(),
        ]);

      setAnimals(animalRecords);
      setLots(lotRecords);
      setInseminations(inseminationRecords);
      setDiagnoses(diagnosisRecords);
      setBirths(birthRecords);
      setSemenRecords(semenList);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar matrizes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const summaries = useMemo<MatrixSummary[]>(() => {
    return animals
      .filter(isMatrixAnimal)
      .map((animal) => {
        const matrixInseminations = inseminations
          .filter((insemination) => insemination.animal_id === animal.id)
          .sort((a, b) => b.date.localeCompare(a.date));
        const matrixDiagnoses = diagnoses
          .filter((diagnosis) => diagnosis.animal_id === animal.id)
          .sort((a, b) => b.diagnosis_date.localeCompare(a.diagnosis_date));
        const matrixBirths = births
          .filter((birth) => birth.animal_id === animal.id)
          .sort((a, b) => b.birth_date.localeCompare(a.birth_date));
        const latestInsemination = matrixInseminations[0];
        const latestDiagnosis = matrixDiagnoses[0];
        const latestBirth = matrixBirths[0];
        const history = [
          ...matrixInseminations.map((insemination) => ({
            date: insemination.date,
            title: 'Inseminação',
            description: `${getInseminationTypeLabel(insemination.type)} · ${getInseminationStatusLabel(
              insemination.status,
            )} · ${getSemenName(semenRecords, insemination.semen_id)}`,
          })),
          ...matrixDiagnoses.map((diagnosis) => ({
            date: diagnosis.diagnosis_date,
            title: 'Diagnóstico',
            description:
              diagnosis.result === 'pregnant'
                ? 'Prenha'
                : diagnosis.result === 'empty'
                  ? 'Vazia'
                  : 'Inconclusivo',
          })),
          ...matrixBirths.map((birth) => ({
            date: birth.birth_date,
            title: 'Parto',
            description: birth.outcome,
          })),
        ].sort((a, b) => b.date.localeCompare(a.date));

        return {
          animal,
          status: buildMatrixStatus(animal, latestInsemination, latestDiagnosis, latestBirth),
          latestInsemination,
          diagnosisDueDate: latestInsemination?.diagnosis_due_date,
          birthDueDate: latestInsemination?.birth_due_date,
          history,
        };
      });
  }, [animals, births, diagnoses, inseminations, semenRecords]);

  const filteredSummaries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

    if (!normalizedSearch) {
      return summaries;
    }

    return summaries.filter(({ animal }) =>
      [animal.identification, animal.name, animal.breed, getLotLabel(lots, animal.lot_id)]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedSearch)),
    );
  }, [lots, search, summaries]);

  const selectedSummary = useMemo(() => {
    const preferredId = selectedMatrixId || filteredSummaries[0]?.animal.id;
    return filteredSummaries.find((summary) => summary.animal.id === preferredId);
  }, [filteredSummaries, selectedMatrixId]);

  const statusCounts = useMemo(() => {
    return summaries.reduce(
      (acc, summary) => {
        acc[summary.status] += 1;
        return acc;
      },
      { empty: 0, inseminated: 0, pregnant: 0, calved: 0, discarded: 0 },
    );
  }, [summaries]);

  return (
    <PageShell
      title="Matrizes"
      description="Acompanhamento offline de fêmeas matriz e novilha, com histórico reprodutivo local."
    >
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Matrizes/novilhas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{summaries.length}</p>
        </div>
        {(['empty', 'inseminated', 'pregnant', 'calved'] as MatrixReproductiveStatus[]).map(
          (status) => (
            <div key={status} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                {getMatrixReproductiveStatusLabel(status)}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{statusCounts[status]}</p>
            </div>
          ),
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <label className="block max-w-xl">
        <span className="text-sm font-medium text-slate-700">Buscar matriz</span>
        <div className="relative mt-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Brinco, nome, raça ou lote"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          />
        </div>
      </label>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando matrizes locais...</div>
        ) : filteredSummaries.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Nenhuma fêmea matriz ou novilha encontrada no cadastro de animais.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSummaries.map((summary) => (
              <article key={summary.animal.id} className="p-4">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-field-700">
                      {summary.animal.identification}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950">
                      {summary.animal.name || summary.animal.breed || 'Matriz sem nome'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {getAnimalCategoryLabel(summary.animal.category)} ·{' '}
                      {summary.animal.breed || 'Raça não informada'} ·{' '}
                      {getLotLabel(lots, summary.animal.lot_id)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">Status reprodutivo</p>
                    <span className="mt-1 inline-flex rounded-full bg-field-50 px-2.5 py-1 text-xs font-semibold text-field-700">
                      {getMatrixReproductiveStatusLabel(summary.status)}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-1">
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Última inseminação</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatDatePtBr(summary.latestInsemination?.date)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Prev. diagnóstico</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatDatePtBr(summary.diagnosisDueDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Prev. parto</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatDatePtBr(summary.birthDueDate)}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => setSelectedMatrixId(summary.animal.id)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <History size={17} aria-hidden="true" />
                    Histórico
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Clock size={18} className="text-field-700" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-slate-950">Histórico da matriz</h3>
            <p className="text-sm text-slate-500">
              {selectedSummary
                ? `${selectedSummary.animal.identification} · ${
                    selectedSummary.animal.name || selectedSummary.animal.breed || 'sem nome'
                  }`
                : 'Selecione uma matriz para visualizar o histórico.'}
            </p>
          </div>
        </div>

        {!selectedSummary ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Nenhuma matriz selecionada.
          </div>
        ) : selectedSummary.history.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Ainda não há eventos reprodutivos para esta matriz.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {selectedSummary.history.map((event) => (
              <div key={`${event.title}-${event.date}-${event.description}`} className="p-3 text-sm">
                <p className="font-semibold text-slate-950">{event.title}</p>
                <p className="mt-1 text-slate-600">{event.description}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{formatDatePtBr(event.date)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
