import { Edit, Plus, Save, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getInseminationStatusLabel,
  getPregnancyDiagnosisMethodLabel,
  getPregnancyDiagnosisResultLabel,
  pregnancyDiagnosisMethodOptions,
  pregnancyDiagnosisResultOptions,
} from '../constants/reproductionOptions';
import { PageShell } from '../components/layout/PageShell';
import * as animalsService from '../services/animalsService';
import * as inseminationsService from '../services/inseminationsService';
import * as pregnancyDiagnosesService from '../services/pregnancyDiagnosesService';
import type {
  Animal,
  Insemination,
  PregnancyDiagnosis,
  PregnancyDiagnosisMethod,
  PregnancyDiagnosisResult,
} from '../types';
import { isFutureDate, todayDateString } from '../utils/date';
import { formatDatePtBr } from '../utils/format';

interface DiagnosisFormState {
  animal_id: string;
  diagnosis_date: string;
  method: PregnancyDiagnosisMethod;
  result: PregnancyDiagnosisResult;
  insemination_id: string;
  notes: string;
}

const emptyForm: DiagnosisFormState = {
  animal_id: '',
  diagnosis_date: todayDateString(),
  method: 'ultrasound',
  result: 'pregnant',
  insemination_id: '',
  notes: '',
};

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isMatrixAnimal(animal: Animal) {
  return animal.sex === 'female' && (animal.category === 'matrix' || animal.category === 'heifer');
}

function matrixLabel(animals: Animal[], animalId: string) {
  const animal = animals.find((item) => item.id === animalId);
  return animal ? `${animal.identification}${animal.name ? ` - ${animal.name}` : ''}` : 'Matriz não encontrada';
}

function diagnosisToForm(diagnosis?: PregnancyDiagnosis | null): DiagnosisFormState {
  if (!diagnosis) {
    return emptyForm;
  }

  return {
    animal_id: diagnosis.animal_id,
    diagnosis_date: diagnosis.diagnosis_date,
    method: diagnosis.method ?? 'ultrasound',
    result: diagnosis.result,
    insemination_id: diagnosis.insemination_id ?? '',
    notes: diagnosis.notes ?? '',
  };
}

export function PregnancyDiagnosisPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [diagnoses, setDiagnoses] = useState<PregnancyDiagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<PregnancyDiagnosis | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PregnancyDiagnosis | null>(null);
  const [form, setForm] = useState<DiagnosisFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    try {
      const [animalRecords, inseminationRecords, diagnosisRecords] = await Promise.all([
        animalsService.list(),
        inseminationsService.list(),
        pregnancyDiagnosesService.list(),
      ]);

      setAnimals(animalRecords);
      setInseminations(inseminationRecords);
      setDiagnoses(diagnosisRecords);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar diagnósticos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const matrixOptions = useMemo(
    () =>
      animals
        .filter(isMatrixAnimal)
        .sort((a, b) => a.identification.localeCompare(b.identification, 'pt-BR')),
    [animals],
  );

  const relatedInseminations = useMemo(
    () =>
      inseminations
        .filter((insemination) => insemination.animal_id === form.animal_id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [form.animal_id, inseminations],
  );

  const sortedDiagnoses = useMemo(
    () => [...diagnoses].sort((a, b) => b.diagnosis_date.localeCompare(a.diagnosis_date)),
    [diagnoses],
  );

  function updateForm<K extends keyof DiagnosisFormState>(field: K, value: DiagnosisFormState[K]) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'animal_id') {
        const latestInsemination = inseminations
          .filter((insemination) => insemination.animal_id === value)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        next.insemination_id = latestInsemination?.id ?? '';
      }

      return next;
    });
  }

  function openCreateForm() {
    const firstMatrixId = matrixOptions[0]?.id ?? '';
    const latestInsemination = inseminations
      .filter((insemination) => insemination.animal_id === firstMatrixId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    setEditingDiagnosis(null);
    setPendingDelete(null);
    setForm({
      ...emptyForm,
      animal_id: firstMatrixId,
      insemination_id: latestInsemination?.id ?? '',
    });
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(diagnosis: PregnancyDiagnosis) {
    setEditingDiagnosis(diagnosis);
    setPendingDelete(null);
    setForm(diagnosisToForm(diagnosis));
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingDiagnosis(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    if (!form.animal_id) {
      setError('Selecione a matriz avaliada.');
      setSaving(false);
      return;
    }

    if (!form.diagnosis_date || isFutureDate(form.diagnosis_date)) {
      setError('Informe uma data de diagnóstico válida.');
      setSaving(false);
      return;
    }

    const payload = {
      animal_id: form.animal_id,
      diagnosis_date: form.diagnosis_date,
      method: form.method,
      result: form.result,
      insemination_id: cleanText(form.insemination_id),
      notes: cleanText(form.notes),
    } satisfies pregnancyDiagnosesService.CreatePregnancyDiagnosisInput;

    try {
      if (editingDiagnosis) {
        await pregnancyDiagnosesService.update(editingDiagnosis.id, payload);
        setMessage('Diagnóstico atualizado com sucesso.');
      } else {
        await pregnancyDiagnosesService.create(payload);
        setMessage('Diagnóstico registrado com sucesso.');
      }

      closeForm();
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }

    try {
      await pregnancyDiagnosesService.deletePregnancyDiagnosis(pendingDelete.id);
      setPendingDelete(null);
      setMessage('Diagnóstico excluído com sucesso.');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir.');
    }
  }

  return (
    <PageShell
      title="Diagnóstico de Gestação"
      description="Registro offline do diagnóstico, com atualização da matriz e da inseminação relacionada."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Diagnósticos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{diagnoses.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Prenhas</p>
          <p className="mt-2 text-2xl font-semibold text-field-700">
            {diagnoses.filter((diagnosis) => diagnosis.result === 'pregnant').length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Matrizes disponíveis</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{matrixOptions.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Diagnósticos locais</h3>
          <p className="text-sm text-slate-500">Os dados persistem no IndexedDB do dispositivo.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          <Plus size={18} aria-hidden="true" />
          Novo diagnóstico
        </button>
      </div>

      {message ? (
        <div className="rounded-lg border border-field-100 bg-field-50 px-4 py-3 text-sm font-medium text-field-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {pendingDelete ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-red-800">
              Excluir diagnóstico de {matrixLabel(animals, pendingDelete.animal_id)} em{' '}
              {formatDatePtBr(pendingDelete.diagnosis_date)}?
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {formOpen ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5"
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                {editingDiagnosis ? 'Editar diagnóstico' : 'Registrar diagnóstico'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Resultado prenha ou vazia atualiza o status reprodutivo da matriz.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
              aria-label="Fechar formulário"
              title="Fechar"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Matriz avaliada *</span>
              <select
                value={form.animal_id}
                onChange={(event) => updateForm('animal_id', event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                <option value="">Selecione</option>
                {matrixOptions.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.identification} {animal.name ? `- ${animal.name}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Data do diagnóstico *</span>
              <input
                type="date"
                max={todayDateString()}
                value={form.diagnosis_date}
                onChange={(event) => updateForm('diagnosis_date', event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Inseminação relacionada</span>
              <select
                value={form.insemination_id}
                onChange={(event) => updateForm('insemination_id', event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                <option value="">Sem relação</option>
                {relatedInseminations.map((insemination) => (
                  <option key={insemination.id} value={insemination.id}>
                    {formatDatePtBr(insemination.date)} ·{' '}
                    {getInseminationStatusLabel(insemination.status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Método</span>
              <select
                value={form.method}
                onChange={(event) => updateForm('method', event.target.value as PregnancyDiagnosisMethod)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {pregnancyDiagnosisMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Resultado</span>
              <select
                value={form.result}
                onChange={(event) => updateForm('result', event.target.value as PregnancyDiagnosisResult)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {pregnancyDiagnosisResultOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Observações</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeForm}
              className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white disabled:opacity-70"
            >
              <Save size={18} aria-hidden="true" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando diagnósticos locais...</div>
        ) : sortedDiagnoses.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Nenhum diagnóstico registrado ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedDiagnoses.map((diagnosis) => (
              <article key={diagnosis.id} className="p-4">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-field-700">
                      {formatDatePtBr(diagnosis.diagnosis_date)}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950">
                      {matrixLabel(animals, diagnosis.animal_id)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {diagnosis.insemination_id ? 'Com inseminação relacionada' : 'Sem relação informada'}
                    </p>
                  </div>

                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Método</dt>
                      <dd className="font-semibold text-slate-900">
                        {getPregnancyDiagnosisMethodLabel(diagnosis.method)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Resultado</dt>
                      <dd className="font-semibold text-slate-900">
                        {getPregnancyDiagnosisResultLabel(diagnosis.result)}
                      </dd>
                    </div>
                  </dl>

                  <p className="text-sm text-slate-600">{diagnosis.notes || '-'}</p>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(diagnosis)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                      aria-label={`Editar diagnóstico de ${matrixLabel(animals, diagnosis.animal_id)}`}
                      title="Editar"
                    >
                      <Edit size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(diagnosis)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                      aria-label={`Excluir diagnóstico de ${matrixLabel(animals, diagnosis.animal_id)}`}
                      title="Excluir"
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
