import { Baby, Edit, Plus, Save, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  birthTypeOptions,
  calfStatusOptions,
  getBirthTypeLabel,
  getCalfStatusLabel,
} from '../constants/reproductionOptions';
import { PageShell } from '../components/layout/PageShell';
import * as animalsService from '../services/animalsService';
import * as birthsService from '../services/birthsService';
import * as pregnancyDiagnosesService from '../services/pregnancyDiagnosesService';
import type {
  Animal,
  Birth,
  BirthOutcome,
  BirthType,
  CalfStatus,
  AnimalSex,
  PregnancyDiagnosis,
} from '../types';
import { isFutureDate, todayDateString } from '../utils/date';
import { formatDatePtBr, formatWeightKg } from '../utils/format';

interface BirthFormState {
  animal_id: string;
  birth_date: string;
  birth_type: BirthType;
  calf_count: string;
  calf_sex: AnimalSex;
  birth_weight_kg: string;
  calf_status: CalfStatus;
  calf_identification: string;
  auto_create_calf: boolean;
  notes: string;
}

const emptyForm: BirthFormState = {
  animal_id: '',
  birth_date: todayDateString(),
  birth_type: 'normal',
  calf_count: '1',
  calf_sex: 'female',
  birth_weight_kg: '',
  calf_status: 'alive',
  calf_identification: '',
  auto_create_calf: true,
  notes: '',
};

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseDecimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  return normalized ? Number(normalized) : undefined;
}

function parseInteger(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function matrixLabel(animals: Animal[], animalId: string) {
  const animal = animals.find((item) => item.id === animalId);
  return animal ? `${animal.identification}${animal.name ? ` - ${animal.name}` : ''}` : 'Matriz não encontrada';
}

function birthToForm(birth?: Birth | null): BirthFormState {
  if (!birth) {
    return emptyForm;
  }

  return {
    animal_id: birth.animal_id,
    birth_date: birth.birth_date,
    birth_type: birth.birth_type ?? 'normal',
    calf_count: birth.calf_count?.toString() ?? '1',
    calf_sex: birth.calf_sex ?? 'female',
    birth_weight_kg: birth.birth_weight_kg?.toString() ?? '',
    calf_status: birth.calf_status ?? (birth.outcome === 'alive' ? 'alive' : 'dead'),
    calf_identification: birth.calf_identification ?? '',
    auto_create_calf: false,
    notes: birth.notes ?? '',
  };
}

export function BirthsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [births, setBirths] = useState<Birth[]>([]);
  const [diagnoses, setDiagnoses] = useState<PregnancyDiagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBirth, setEditingBirth] = useState<Birth | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Birth | null>(null);
  const [form, setForm] = useState<BirthFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    try {
      const [animalRecords, birthRecords, diagnosisRecords] = await Promise.all([
        animalsService.list(),
        birthsService.list(),
        pregnancyDiagnosesService.list(),
      ]);

      setAnimals(animalRecords);
      setBirths(birthRecords);
      setDiagnoses(diagnosisRecords);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar partos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const pregnantMatrices = useMemo(
    () =>
      animals
        .filter((animal) => {
          if (
            animal.sex !== 'female' ||
            (animal.category !== 'matrix' && animal.category !== 'heifer') ||
            animal.reproductive_status === 'calved' ||
            animal.reproductive_status === 'discarded'
          ) {
            return false;
          }

          const latestConclusiveDiagnosis = diagnoses
            .filter(
              (diagnosis) =>
                diagnosis.animal_id === animal.id && diagnosis.result !== 'inconclusive',
            )
            .sort((a, b) => b.diagnosis_date.localeCompare(a.diagnosis_date))[0];

          return (
            animal.reproductive_status === 'pregnant' ||
            latestConclusiveDiagnosis?.result === 'pregnant'
          );
        })
        .sort((a, b) => a.identification.localeCompare(b.identification, 'pt-BR')),
    [animals, diagnoses],
  );

  const sortedBirths = useMemo(
    () => [...births].sort((a, b) => b.birth_date.localeCompare(a.birth_date)),
    [births],
  );

  function updateForm<K extends keyof BirthFormState>(field: K, value: BirthFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setEditingBirth(null);
    setPendingDelete(null);
    setForm({
      ...emptyForm,
      animal_id: pregnantMatrices[0]?.id ?? '',
    });
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(birth: Birth) {
    setEditingBirth(birth);
    setPendingDelete(null);
    setForm(birthToForm(birth));
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingBirth(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const calfCount = parseInteger(form.calf_count) ?? 1;
    const birthWeight = parseDecimal(form.birth_weight_kg);

    if (!form.animal_id) {
      setError('Selecione uma matriz prenha.');
      setSaving(false);
      return;
    }

    if (!form.birth_date || isFutureDate(form.birth_date)) {
      setError('Informe uma data de parto válida.');
      setSaving(false);
      return;
    }

    if (calfCount < 1) {
      setError('Informe a quantidade de bezerros.');
      setSaving(false);
      return;
    }

    if (birthWeight !== undefined && (Number.isNaN(birthWeight) || birthWeight < 0)) {
      setError('Informe um peso ao nascer válido.');
      setSaving(false);
      return;
    }

    if (form.calf_status === 'alive' && form.auto_create_calf && !form.calf_identification.trim()) {
      setError('Informe a identificação do bezerro para cadastrar automaticamente.');
      setSaving(false);
      return;
    }

    const existingDuplicateCalf = animals.some(
      (animal) =>
        animal.identification.trim().toLocaleLowerCase('pt-BR') ===
        form.calf_identification.trim().toLocaleLowerCase('pt-BR'),
    );

    if (form.calf_status === 'alive' && form.auto_create_calf && existingDuplicateCalf) {
      setError('Já existe um animal com a identificação informada para o bezerro.');
      setSaving(false);
      return;
    }

    const outcome: BirthOutcome = form.calf_status === 'alive' ? 'alive' : 'stillborn';

    try {
      const payload = {
        animal_id: form.animal_id,
        birth_date: form.birth_date,
        birth_type: form.birth_type,
        calf_count: calfCount,
        calf_sex: form.calf_sex,
        calf_status: form.calf_status,
        calf_identification: cleanText(form.calf_identification),
        birth_weight_kg: birthWeight,
        calf_id: editingBirth?.calf_id,
        outcome,
        notes: cleanText(form.notes),
      } satisfies birthsService.CreateBirthInput;

      if (editingBirth) {
        await birthsService.update(editingBirth.id, payload);
        setMessage('Parto atualizado com sucesso.');
      } else {
        let calf: Animal | undefined;
        let calfCreated = false;

        try {
          if (form.calf_status === 'alive' && form.auto_create_calf) {
            const matrix = animals.find((animal) => animal.id === form.animal_id);
            calf = await animalsService.create({
              identification: form.calf_identification,
              sex: form.calf_sex,
              category: 'calf',
              status: 'active',
              birth_date: form.birth_date,
              weight_kg: birthWeight,
              mother_id: matrix?.id,
              lot_id: matrix?.lot_id,
              notes: 'Cadastrado automaticamente a partir do parto.',
            });
            calfCreated = true;
          }

          await birthsService.create({
            ...payload,
            calf_id: calf?.id,
            calf_identification: calf?.identification ?? payload.calf_identification,
          });
        } catch (birthError) {
          if (calf) {
            await animalsService.deleteAnimal(calf.id).catch(() => undefined);
          }

          throw birthError;
        }

        setMessage(
          calfCreated
            ? 'Parto registrado e bezerro cadastrado com sucesso.'
            : 'Parto registrado com sucesso.',
        );
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
      await birthsService.deleteBirth(pendingDelete.id);
      setPendingDelete(null);
      setMessage('Parto excluído com sucesso.');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir.');
    }
  }

  return (
    <PageShell
      title="Partos"
      description="Registro offline de partos, status do bezerro e cadastro automático quando houver nascimento vivo."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Partos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{births.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Matrizes prenhas</p>
          <p className="mt-2 text-2xl font-semibold text-field-700">{pregnantMatrices.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Bezerros vivos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {births.filter((birth) => birth.calf_status === 'alive' || birth.outcome === 'alive').length}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Registros locais</h3>
          <p className="text-sm text-slate-500">Após registrar parto, a matriz é marcada como parida.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          <Plus size={18} aria-hidden="true" />
          Novo parto
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
              Excluir parto de {matrixLabel(animals, pendingDelete.animal_id)} em{' '}
              {formatDatePtBr(pendingDelete.birth_date)}?
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
                {editingBirth ? 'Editar parto' : 'Registrar parto'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Como opção principal, aparecem matrizes marcadas como prenhas.
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
              <span className="text-sm font-medium text-slate-700">Matriz *</span>
              <select
                value={form.animal_id}
                onChange={(event) => updateForm('animal_id', event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                <option value="">Selecione</option>
                {pregnantMatrices.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.identification} {animal.name ? `- ${animal.name}` : ''}
                  </option>
                ))}
                {editingBirth && !pregnantMatrices.some((animal) => animal.id === editingBirth.animal_id) ? (
                  <option value={editingBirth.animal_id}>{matrixLabel(animals, editingBirth.animal_id)}</option>
                ) : null}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Data do parto *</span>
              <input
                type="date"
                max={todayDateString()}
                value={form.birth_date}
                onChange={(event) => updateForm('birth_date', event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tipo de parto</span>
              <select
                value={form.birth_type}
                onChange={(event) => updateForm('birth_type', event.target.value as BirthType)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {birthTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Quantidade de bezerros</span>
              <input
                value={form.calf_count}
                onChange={(event) => updateForm('calf_count', event.target.value)}
                inputMode="numeric"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Sexo do bezerro</span>
              <select
                value={form.calf_sex}
                onChange={(event) => updateForm('calf_sex', event.target.value as AnimalSex)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                <option value="female">Fêmea</option>
                <option value="male">Macho</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Peso ao nascer</span>
              <input
                value={form.birth_weight_kg}
                onChange={(event) => updateForm('birth_weight_kg', event.target.value)}
                inputMode="decimal"
                placeholder="kg"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Status do bezerro</span>
              <select
                value={form.calf_status}
                onChange={(event) => updateForm('calf_status', event.target.value as CalfStatus)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {calfStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {form.calf_status === 'alive' ? (
              <div className="rounded-lg border border-field-100 bg-field-50 p-3 sm:col-span-2">
                <label className="flex items-start gap-3 text-sm font-medium text-field-700">
                  <input
                    type="checkbox"
                    checked={form.auto_create_calf}
                    onChange={(event) => updateForm('auto_create_calf', event.target.checked)}
                    className="mt-1"
                    disabled={Boolean(editingBirth)}
                  />
                  Cadastrar automaticamente o bezerro em Animais
                </label>
                {form.auto_create_calf ? (
                  <label className="mt-3 block">
                    <span className="text-sm font-medium text-slate-700">Identificação do bezerro</span>
                    <input
                      value={form.calf_identification}
                      onChange={(event) => updateForm('calf_identification', event.target.value)}
                      placeholder="Ex.: BZ-001"
                      className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

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
          <div className="p-6 text-sm text-slate-500">Carregando partos locais...</div>
        ) : sortedBirths.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">Nenhum parto registrado ainda.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedBirths.map((birth) => (
              <article key={birth.id} className="p-4">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-field-700">
                      {formatDatePtBr(birth.birth_date)}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950">
                      {matrixLabel(animals, birth.animal_id)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {birth.calf_identification || birth.calf_id ? 'Bezerro identificado' : 'Sem bezerro vinculado'}
                    </p>
                  </div>

                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Tipo</dt>
                      <dd className="font-semibold text-slate-900">{getBirthTypeLabel(birth.birth_type)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Quantidade</dt>
                      <dd className="font-semibold text-slate-900">{birth.calf_count ?? 1}</dd>
                    </div>
                  </dl>

                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Status bezerro</dt>
                      <dd className="font-semibold text-slate-900">{getCalfStatusLabel(birth.calf_status)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Peso</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatWeightKg(birth.birth_weight_kg)}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(birth)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                      aria-label={`Editar parto de ${matrixLabel(animals, birth.animal_id)}`}
                      title="Editar"
                    >
                      <Edit size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(birth)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                      aria-label={`Excluir parto de ${matrixLabel(animals, birth.animal_id)}`}
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

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        <Baby size={18} className="mb-2 text-field-700" aria-hidden="true" />
        Bezerros vivos podem ser cadastrados automaticamente em Animais com categoria bezerro.
      </div>
    </PageShell>
  );
}
