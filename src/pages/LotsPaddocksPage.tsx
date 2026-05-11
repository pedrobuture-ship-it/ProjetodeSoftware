import { ArrowRightLeft, Edit, Plus, Save, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { getLotStatusLabel, getLotTypeLabel, lotStatusOptions, lotTypeOptions } from '../constants/lotOptions';
import { getAnimalCategoryLabel, getAnimalStatusLabel } from '../constants/animalOptions';
import { PageShell } from '../components/layout/PageShell';
import * as animalsService from '../services/animalsService';
import * as lotsService from '../services/lotsService';
import type { Animal, Lot, LotStatus, LotType } from '../types';
import { formatNumberPtBr } from '../utils/format';

interface LotFormState {
  name: string;
  type: LotType;
  pasture_type: string;
  area_hectares: string;
  description: string;
  status: LotStatus;
}

const emptyLotForm: LotFormState = {
  name: '',
  type: 'paddock',
  pasture_type: '',
  area_hectares: '',
  description: '',
  status: 'active',
};

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseDecimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  return normalized ? Number(normalized) : undefined;
}

function lotLabel(lots: Lot[], lotId?: string) {
  if (!lotId) {
    return 'Sem lote';
  }

  const lot = lots.find((item) => item.id === lotId || item.name === lotId);
  return lot?.name ?? lotId;
}

function animalBelongsToLot(animal: Animal, lot: Lot) {
  return animal.lot_id === lot.id || animal.lot_id === lot.name;
}

function lotToForm(lot?: Lot | null): LotFormState {
  if (!lot) {
    return emptyLotForm;
  }

  return {
    name: lot.name,
    type: lot.type ?? 'paddock',
    pasture_type: lot.pasture_type ?? '',
    area_hectares: lot.area_hectares?.toString() ?? '',
    description: lot.description ?? '',
    status: lot.status ?? (lot.active === false ? 'inactive' : 'active'),
  };
}

export function LotsPaddocksPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Lot | null>(null);
  const [form, setForm] = useState<LotFormState>(emptyLotForm);
  const [selectedLotFilter, setSelectedLotFilter] = useState('');
  const [moveAnimalId, setMoveAnimalId] = useState('');
  const [moveTargetLot, setMoveTargetLot] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    try {
      const [lotRecords, animalRecords] = await Promise.all([
        lotsService.list(),
        animalsService.list(),
      ]);
      setLots(lotRecords);
      setAnimals(animalRecords);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar dados locais.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const lotFilterOptions = useMemo(
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

  const animalsByLot = useMemo(() => {
    if (!selectedLotFilter) {
      return animals;
    }

    const selectedLot = lots.find((lot) => lot.id === selectedLotFilter);
    return animals.filter(
      (animal) =>
        animal.lot_id === selectedLotFilter ||
        (selectedLot ? animal.lot_id === selectedLot.name : false),
    );
  }, [animals, lots, selectedLotFilter]);

  const lotAnimalCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const animal of animals) {
      if (!animal.lot_id) {
        continue;
      }

      counts.set(animal.lot_id, (counts.get(animal.lot_id) ?? 0) + 1);
    }

    return counts;
  }, [animals]);

  function countAnimalsInLot(lot: Lot) {
    const byId = lotAnimalCounts.get(lot.id) ?? 0;
    const byName = lot.name === lot.id ? 0 : (lotAnimalCounts.get(lot.name) ?? 0);
    return byId + byName;
  }

  function updateForm<K extends keyof LotFormState>(field: K, value: LotFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setEditingLot(null);
    setPendingDelete(null);
    setForm(emptyLotForm);
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(lot: Lot) {
    setEditingLot(lot);
    setPendingDelete(null);
    setForm(lotToForm(lot));
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingLot(null);
    setForm(emptyLotForm);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const area = parseDecimal(form.area_hectares);

    if (!form.name.trim()) {
      setError('Informe o nome do lote/piquete.');
      setSaving(false);
      return;
    }

    if (area !== undefined && (Number.isNaN(area) || area < 0)) {
      setError('Informe uma área aproximada válida.');
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name,
      type: form.type,
      pasture_type: cleanText(form.pasture_type),
      area_hectares: area,
      description: cleanText(form.description),
      status: form.status,
      active: form.status === 'active',
    } satisfies lotsService.CreateLotInput;

    try {
      if (editingLot) {
        await lotsService.update(editingLot.id, payload);

        await Promise.all(
          animals
            .filter((animal) => animalBelongsToLot(animal, editingLot))
            .map((animal) => animalsService.update(animal.id, { lot_id: editingLot.id })),
        );

        setMessage('Lote/piquete atualizado com sucesso.');
      } else {
        await lotsService.create(payload);
        setMessage('Lote/piquete cadastrado com sucesso.');
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
      await lotsService.deleteLot(pendingDelete.id);
      setPendingDelete(null);
      setMessage('Lote/piquete excluído com sucesso.');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir.');
    }
  }

  async function handleMoveAnimal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!moveAnimalId || !moveTargetLot) {
      setError('Selecione o animal e o lote/piquete de destino.');
      return;
    }

    try {
      await animalsService.update(moveAnimalId, { lot_id: moveTargetLot });
      setMoveAnimalId('');
      setMoveTargetLot('');
      setMessage('Animal movimentado com sucesso.');
      await loadData();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Não foi possível movimentar o animal.');
    }
  }

  return (
    <PageShell
      title="Lotes/Piquetes"
      description="Cadastro offline de áreas de manejo e movimentação local de animais entre lotes."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Lotes/piquetes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{lots.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Animais com lote</p>
          <p className="mt-2 text-2xl font-semibold text-field-700">
            {animals.filter((animal) => animal.lot_id).length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Animais filtrados</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{animalsByLot.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Áreas de manejo</h3>
          <p className="text-sm text-slate-500">Registros e movimentações salvos no IndexedDB local.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          <Plus size={18} aria-hidden="true" />
          Novo lote/piquete
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
              Excluir {pendingDelete.name}? Existem {countAnimalsInLot(pendingDelete)} animais vinculados a este lote.
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
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                {editingLot ? 'Editar lote/piquete' : 'Cadastrar lote/piquete'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">Use nomes curtos e fáceis de reconhecer no campo.</p>
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
              <span className="text-sm font-medium text-slate-700">Nome do lote/piquete *</span>
              <input
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder="Ex.: Piquete 01"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tipo</span>
              <select
                value={form.type}
                onChange={(event) => updateForm('type', event.target.value as LotType)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {lotTypeOptions.map((option) => (
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
                onChange={(event) => updateForm('status', event.target.value as LotStatus)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {lotStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tipo de pastagem</span>
              <input
                value={form.pasture_type}
                onChange={(event) => updateForm('pasture_type', event.target.value)}
                placeholder="Ex.: Braquiária"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Área aproximada</span>
              <input
                value={form.area_hectares}
                onChange={(event) => updateForm('area_hectares', event.target.value)}
                inputMode="decimal"
                placeholder="hectares"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Observações</span>
              <textarea
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeForm} className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white disabled:opacity-70">
              <Save size={18} aria-hidden="true" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ArrowRightLeft size={18} aria-hidden="true" />
          Movimentar animal
        </div>
        <form onSubmit={handleMoveAnimal} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Animal</span>
            <select
              value={moveAnimalId}
              onChange={(event) => setMoveAnimalId(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
            >
              <option value="">Selecione</option>
              {animals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.identification} {animal.name ? `- ${animal.name}` : ''}{' '}
                  {animal.lot_id ? `(${lotLabel(lots, animal.lot_id)})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Destino</span>
            <select
              value={moveTargetLot}
              onChange={(event) => setMoveTargetLot(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
            >
              <option value="">Selecione</option>
              {[...lots]
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white md:mt-6"
          >
            <ArrowRightLeft size={18} aria-hidden="true" />
            Movimentar
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block max-w-md">
          <span className="text-sm font-medium text-slate-700">Filtrar animais por lote/piquete</span>
          <select
            value={selectedLotFilter}
            onChange={(event) => setSelectedLotFilter(event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            <option value="">Todos os animais</option>
            {lotFilterOptions.map((lot) => (
              <option key={lot.value} value={lot.value}>
                {lot.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          {animalsByLot.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Nenhum animal neste filtro.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {animalsByLot.map((animal) => (
                <div key={animal.id} className="grid gap-2 p-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <p className="font-semibold text-slate-950">{animal.identification}</p>
                    <p className="text-slate-500">
                      {animal.name || 'Sem nome'} · {getAnimalCategoryLabel(animal.category)}
                    </p>
                  </div>
                  <span className="text-slate-600">{lotLabel(lots, animal.lot_id)}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {getAnimalStatusLabel(animal.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando lotes/piquetes locais...</div>
        ) : lots.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">Nenhum lote/piquete cadastrado.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lots.map((lot) => {
              const status = lot.status ?? (lot.active === false ? 'inactive' : 'active');

              return (
                <article key={lot.id} className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">{lot.name}</h3>
                        <span className="rounded-full bg-field-50 px-2.5 py-1 text-xs font-semibold text-field-700">
                          {getLotTypeLabel(lot.type)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {getLotStatusLabel(status)}
                        </span>
                      </div>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Pastagem</dt>
                          <dd className="font-semibold text-slate-900">{lot.pasture_type || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Área</dt>
                          <dd className="font-semibold text-slate-900">{formatNumberPtBr(lot.area_hectares, 2)} ha</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Animais</dt>
                          <dd className="font-semibold text-slate-900">{countAnimalsInLot(lot)}</dd>
                        </div>
                      </dl>
                      {lot.description ? <p className="mt-3 text-sm text-slate-500">{lot.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(lot)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        aria-label={`Editar ${lot.name}`}
                        title="Editar"
                      >
                        <Edit size={17} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(lot)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                        aria-label={`Excluir ${lot.name}`}
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
