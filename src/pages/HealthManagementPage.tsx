import { AlertTriangle, CalendarClock, Edit, Plus, Save, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { getAnimalCategoryLabel } from '../constants/animalOptions';
import {
  getEffectiveSanitaryStatus,
  getSanitaryStatusLabel,
  getSanitaryTypeLabel,
  isSanitaryOverdue,
  isSanitaryUpcoming,
  sanitaryStatusOptions,
  sanitaryTypeOptions,
} from '../constants/sanitaryOptions';
import { PageShell } from '../components/layout/PageShell';
import * as animalsService from '../services/animalsService';
import * as lotsService from '../services/lotsService';
import * as sanitaryManagementService from '../services/sanitaryManagementService';
import type {
  Animal,
  Lot,
  SanitaryManagement,
  SanitaryManagementStatus,
  SanitaryManagementType,
} from '../types';
import { todayDateString } from '../utils/date';
import { formatDatePtBr } from '../utils/format';

type TargetType = 'animal' | 'lot';

interface SanitaryFormState {
  procedure_type: SanitaryManagementType;
  target_type: TargetType;
  animal_id: string;
  lot_id: string;
  date: string;
  next_application_date: string;
  responsible: string;
  product: string;
  dosage: string;
  notes: string;
  status: SanitaryManagementStatus;
}

interface SanitaryFiltersState {
  animal_id: string;
  lot_id: string;
  procedure_type: SanitaryManagementType | '';
  date: string;
  status: SanitaryManagementStatus | '';
}

const emptyForm: SanitaryFormState = {
  procedure_type: 'vaccine',
  target_type: 'animal',
  animal_id: '',
  lot_id: '',
  date: todayDateString(),
  next_application_date: '',
  responsible: '',
  product: '',
  dosage: '',
  notes: '',
  status: 'done',
};

const emptyFilters: SanitaryFiltersState = {
  animal_id: '',
  lot_id: '',
  procedure_type: '',
  date: '',
  status: '',
};

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function animalLabel(animals: Animal[], animalId?: string) {
  if (!animalId) {
    return '-';
  }

  const animal = animals.find((item) => item.id === animalId);
  return animal
    ? `${animal.identification}${animal.name ? ` - ${animal.name}` : ''}`
    : 'Animal não encontrado';
}

function lotLabel(lots: Lot[], lotId?: string) {
  if (!lotId) {
    return '-';
  }

  const lot = lots.find((item) => item.id === lotId || item.name === lotId);
  return lot?.name ?? lotId;
}

function sanitaryToForm(record?: SanitaryManagement | null): SanitaryFormState {
  if (!record) {
    return emptyForm;
  }

  return {
    procedure_type: record.procedure_type,
    target_type: record.lot_id ? 'lot' : 'animal',
    animal_id: record.animal_id ?? '',
    lot_id: record.lot_id ?? '',
    date: record.date,
    next_application_date: record.next_application_date ?? '',
    responsible: record.responsible ?? '',
    product: record.product ?? '',
    dosage: record.dosage ?? '',
    notes: record.notes ?? '',
    status: record.status ?? 'done',
  };
}

function statusBadgeClass(status: SanitaryManagementStatus) {
  if (status === 'overdue') {
    return 'bg-red-50 text-red-700';
  }

  if (status === 'pending') {
    return 'bg-harvest-100 text-slate-800';
  }

  return 'bg-field-50 text-field-700';
}

export function HealthManagementPage() {
  const [records, setRecords] = useState<SanitaryManagement[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SanitaryManagement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SanitaryManagement | null>(null);
  const [form, setForm] = useState<SanitaryFormState>(emptyForm);
  const [filters, setFilters] = useState<SanitaryFiltersState>(emptyFilters);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    try {
      const [sanitaryRecords, animalRecords, lotRecords] = await Promise.all([
        sanitaryManagementService.list(),
        animalsService.list(),
        lotsService.list(),
      ]);

      setRecords(sanitaryRecords);
      setAnimals(animalRecords);
      setLots(lotRecords);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar manejos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const animalOptions = useMemo(
    () => [...animals].sort((a, b) => a.identification.localeCompare(b.identification, 'pt-BR')),
    [animals],
  );

  const lotOptions = useMemo(
    () => {
      const registeredLots = [...lots]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map((lot) => ({ value: lot.id, label: lot.name }));
      const registeredLotKeys = new Set(lots.flatMap((lot) => [lot.id, lot.name]));
      const legacyLots = Array.from(
        new Set(animals.map((animal) => animal.lot_id).filter(Boolean) as string[]),
      )
        .filter((lotId) => !registeredLotKeys.has(lotId))
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((lotId) => ({ value: lotId, label: lotId }));

      return [...registeredLots, ...legacyLots];
    },
    [animals, lots],
  );

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        const effectiveStatus = getEffectiveSanitaryStatus(
          record.status ?? 'done',
          record.next_application_date,
        );
        const selectedLot = filters.lot_id
          ? lots.find((lot) => lot.id === filters.lot_id)
          : undefined;
        const matchesLot =
          !filters.lot_id ||
          record.lot_id === filters.lot_id ||
          (selectedLot ? record.lot_id === selectedLot.name : false);

        return (
          (!filters.animal_id || record.animal_id === filters.animal_id) &&
          matchesLot &&
          (!filters.procedure_type || record.procedure_type === filters.procedure_type) &&
          (!filters.date || record.date === filters.date) &&
          (!filters.status || effectiveStatus === filters.status)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filters, lots, records]);

  const overdueRecords = useMemo(
    () =>
      records
        .filter((record) => isSanitaryOverdue(record.next_application_date, record.status))
        .sort((a, b) =>
          (a.next_application_date ?? a.date).localeCompare(b.next_application_date ?? b.date),
        ),
    [records],
  );

  const upcomingRecords = useMemo(
    () =>
      records
        .filter((record) => isSanitaryUpcoming(record.next_application_date, record.status))
        .sort((a, b) =>
          (a.next_application_date ?? a.date).localeCompare(b.next_application_date ?? b.date),
        ),
    [records],
  );

  function updateForm<K extends keyof SanitaryFormState>(field: K, value: SanitaryFormState[K]) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'target_type') {
        next.animal_id = '';
        next.lot_id = '';
      }

      return next;
    });
  }

  function updateFilter<K extends keyof SanitaryFiltersState>(
    field: K,
    value: SanitaryFiltersState[K],
  ) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setEditingRecord(null);
    setPendingDelete(null);
    setForm({
      ...emptyForm,
      animal_id: animalOptions[0]?.id ?? '',
    });
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(record: SanitaryManagement) {
    setEditingRecord(record);
    setPendingDelete(null);
    setForm(sanitaryToForm(record));
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRecord(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    if (form.target_type === 'animal' && !form.animal_id) {
      setError('Selecione o animal tratado.');
      setSaving(false);
      return;
    }

    if (form.target_type === 'lot' && !form.lot_id) {
      setError('Selecione o lote tratado.');
      setSaving(false);
      return;
    }

    const payload = {
      procedure_type: form.procedure_type,
      animal_id: form.target_type === 'animal' ? form.animal_id : undefined,
      lot_id: form.target_type === 'lot' ? form.lot_id : undefined,
      date: form.date,
      next_application_date: cleanText(form.next_application_date),
      responsible: cleanText(form.responsible),
      product: cleanText(form.product),
      dosage: cleanText(form.dosage),
      notes: cleanText(form.notes),
      status: form.status,
    } satisfies sanitaryManagementService.CreateSanitaryManagementInput;

    try {
      if (editingRecord) {
        await sanitaryManagementService.update(editingRecord.id, payload);
        setMessage('Manejo sanitário atualizado com sucesso.');
      } else {
        await sanitaryManagementService.create(payload);
        setMessage('Manejo sanitário cadastrado com sucesso.');
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
      await sanitaryManagementService.deleteSanitaryManagement(pendingDelete.id);
      setPendingDelete(null);
      setMessage('Manejo sanitário excluído com sucesso.');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir.');
    }
  }

  return (
    <PageShell
      title="Manejo Sanitário"
      description="Controle offline de vacinas, vermífugos, medicamentos e procedimentos por animal ou lote."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Manejos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{records.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Vencidos</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{overdueRecords.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Próximos</p>
          <p className="mt-2 text-2xl font-semibold text-harvest-500">{upcomingRecords.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Registros locais</h3>
          <p className="text-sm text-slate-500">
            Alertas são gerados pela data de próxima aplicação salva no dispositivo.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          <Plus size={18} aria-hidden="true" />
          Novo manejo
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

      {(overdueRecords.length > 0 || upcomingRecords.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800">
              <AlertTriangle size={18} aria-hidden="true" />
              Manejos vencidos
            </div>
            {overdueRecords.length === 0 ? (
              <p className="text-sm text-red-700">Nenhum manejo vencido.</p>
            ) : (
              <div className="space-y-2">
                {overdueRecords.slice(0, 5).map((record) => (
                  <p key={record.id} className="text-sm text-red-800">
                    {getSanitaryTypeLabel(record.procedure_type)} · próxima em{' '}
                    {formatDatePtBr(record.next_application_date)}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-harvest-100 bg-harvest-100/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CalendarClock size={18} aria-hidden="true" />
              Próximas aplicações
            </div>
            {upcomingRecords.length === 0 ? (
              <p className="text-sm text-slate-700">Nenhuma próxima aplicação no período.</p>
            ) : (
              <div className="space-y-2">
                {upcomingRecords.slice(0, 5).map((record) => (
                  <p key={record.id} className="text-sm text-slate-800">
                    {getSanitaryTypeLabel(record.procedure_type)} · próxima em{' '}
                    {formatDatePtBr(record.next_application_date)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {pendingDelete ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-red-800">
              Excluir manejo de {formatDatePtBr(pendingDelete.date)}?
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
                {editingRecord ? 'Editar manejo sanitário' : 'Cadastrar manejo sanitário'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Escolha se o manejo foi individual ou aplicado em um lote/piquete.
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
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tipo</span>
              <select
                value={form.procedure_type}
                onChange={(event) =>
                  updateForm('procedure_type', event.target.value as SanitaryManagementType)
                }
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {sanitaryTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  updateForm('status', event.target.value as SanitaryManagementStatus)
                }
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {sanitaryStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-slate-700">Alvo do manejo</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  <input
                    type="radio"
                    checked={form.target_type === 'animal'}
                    onChange={() => updateForm('target_type', 'animal')}
                  />
                  Animal tratado
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  <input
                    type="radio"
                    checked={form.target_type === 'lot'}
                    onChange={() => updateForm('target_type', 'lot')}
                  />
                  Lote tratado
                </label>
              </div>
            </fieldset>

            {form.target_type === 'animal' ? (
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Animal tratado *</span>
                <select
                  value={form.animal_id}
                  onChange={(event) => updateForm('animal_id', event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
                >
                  <option value="">Selecione</option>
                  {animalOptions.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.identification} {animal.name ? `- ${animal.name}` : ''} ·{' '}
                      {getAnimalCategoryLabel(animal.category)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Lote tratado *</span>
                <select
                  value={form.lot_id}
                  onChange={(event) => updateForm('lot_id', event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
                >
                  <option value="">Selecione</option>
                  {lotOptions.map((lot) => (
                    <option key={lot.value} value={lot.value}>
                      {lot.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Data de aplicação</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => updateForm('date', event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Próxima aplicação</span>
              <input
                type="date"
                value={form.next_application_date}
                onChange={(event) => updateForm('next_application_date', event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Responsável</span>
              <input
                value={form.responsible}
                onChange={(event) => updateForm('responsible', event.target.value)}
                placeholder="Nome do responsável"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Produto utilizado</span>
              <input
                value={form.product}
                onChange={(event) => updateForm('product', event.target.value)}
                placeholder="Ex.: Vacina clostridial"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Dosagem</span>
              <input
                value={form.dosage}
                onChange={(event) => updateForm('dosage', event.target.value)}
                placeholder="Ex.: 5 ml"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
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

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-950">Filtros</h3>
          <button
            type="button"
            onClick={() => setFilters(emptyFilters)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"
          >
            Limpar
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Animal</span>
            <select
              value={filters.animal_id}
              onChange={(event) => updateFilter('animal_id', event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
            >
              <option value="">Todos</option>
              {animalOptions.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.identification}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Lote</span>
            <select
              value={filters.lot_id}
              onChange={(event) => updateFilter('lot_id', event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
            >
              <option value="">Todos</option>
              {lotOptions.map((lot) => (
                <option key={lot.value} value={lot.value}>
                  {lot.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Tipo</span>
            <select
              value={filters.procedure_type}
              onChange={(event) =>
                updateFilter('procedure_type', event.target.value as SanitaryManagementType | '')
              }
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
            >
              <option value="">Todos</option>
              {sanitaryTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Data</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter('date', event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                updateFilter('status', event.target.value as SanitaryManagementStatus | '')
              }
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
            >
              <option value="">Todos</option>
              {sanitaryStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando manejos locais...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">Nenhum manejo encontrado.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRecords.map((record) => {
              const effectiveStatus = getEffectiveSanitaryStatus(
                record.status ?? 'done',
                record.next_application_date,
              );

              return (
                <article key={record.id} className="p-4">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-field-700">
                        {formatDatePtBr(record.date)}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-950">
                        {getSanitaryTypeLabel(record.procedure_type)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {record.animal_id
                          ? animalLabel(animals, record.animal_id)
                          : `Lote ${lotLabel(lots, record.lot_id)}`}
                      </p>
                    </div>

                    <dl className="grid gap-2 text-sm">
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Produto</dt>
                        <dd className="font-semibold text-slate-900">{record.product || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Dosagem</dt>
                        <dd className="font-semibold text-slate-900">{record.dosage || '-'}</dd>
                      </div>
                    </dl>

                    <dl className="grid gap-2 text-sm">
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Próxima aplicação</dt>
                        <dd className="font-semibold text-slate-900">
                          {formatDatePtBr(record.next_application_date)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Status</dt>
                        <dd>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                              effectiveStatus,
                            )}`}
                          >
                            {getSanitaryStatusLabel(effectiveStatus)}
                          </span>
                        </dd>
                      </div>
                    </dl>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(record)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        aria-label={`Editar manejo de ${formatDatePtBr(record.date)}`}
                        title="Editar"
                      >
                        <Edit size={17} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(record)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                        aria-label={`Excluir manejo de ${formatDatePtBr(record.date)}`}
                        title="Excluir"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
