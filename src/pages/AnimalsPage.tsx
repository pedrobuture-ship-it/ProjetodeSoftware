import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AnimalFilters, type AnimalFiltersState } from '../components/animals/AnimalFilters';
import { AnimalForm, type AnimalFormPayload } from '../components/animals/AnimalForm';
import { AnimalList } from '../components/animals/AnimalList';
import { PageShell } from '../components/layout/PageShell';
import * as animalsService from '../services/animalsService';
import * as lotsService from '../services/lotsService';
import type { Animal, Lot } from '../types';

export function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [animalPendingDelete, setAnimalPendingDelete] = useState<Animal | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<AnimalFiltersState>({
    search: '',
    category: '',
    sex: '',
    lot: '',
    status: '',
  });

  async function loadAnimals() {
    setLoading(true);

    try {
      const [animalRecords, lotRecords] = await Promise.all([
        animalsService.list(),
        lotsService.list(),
      ]);
      setAnimals(animalRecords);
      setLots(lotRecords);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível carregar os animais.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnimals();
  }, []);

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

  const filteredAnimals = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase('pt-BR');

    return animals.filter((animal) => {
      const matchesSearch =
        !search ||
        [animal.identification, animal.name, animal.breed]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase('pt-BR').includes(search));
      const matchesCategory = !filters.category || animal.category === filters.category;
      const matchesSex = !filters.sex || animal.sex === filters.sex;
      const selectedLot = filters.lot ? lots.find((lot) => lot.id === filters.lot) : undefined;
      const matchesLot =
        !filters.lot ||
        animal.lot_id === filters.lot ||
        (selectedLot ? animal.lot_id === selectedLot.name : false);
      const matchesStatus = !filters.status || animal.status === filters.status;

      return matchesSearch && matchesCategory && matchesSex && matchesLot && matchesStatus;
    });
  }, [animals, filters, lots]);

  const activeCount = useMemo(
    () => animals.filter((animal) => animal.status === 'active').length,
    [animals],
  );

  function getLotLabel(lotId?: string) {
    if (!lotId) {
      return '-';
    }

    const lot = lots.find((item) => item.id === lotId || item.name === lotId);
    return lot?.name ?? lotId;
  }

  function openCreateForm() {
    setEditingAnimal(null);
    setAnimalPendingDelete(null);
    setFormError(null);
    setNotice(null);
    setFormOpen(true);
  }

  function openEditForm(animal: Animal) {
    setEditingAnimal(animal);
    setAnimalPendingDelete(null);
    setFormError(null);
    setNotice(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingAnimal(null);
    setFormError(null);
  }

  async function handleSubmit(payload: AnimalFormPayload) {
    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      if (editingAnimal) {
        await animalsService.update(editingAnimal.id, payload);
        setNotice('Animal atualizado com sucesso.');
      } else {
        await animalsService.create(payload);
        setNotice('Animal cadastrado com sucesso.');
      }

      closeForm();
      await loadAnimals();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o animal.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(animal: Animal) {
    setAnimalPendingDelete(animal);
    setNotice(null);
    setFormError(null);
  }

  async function confirmDelete() {
    if (!animalPendingDelete) {
      return;
    }

    try {
      await animalsService.deleteAnimal(animalPendingDelete.id);
      setAnimalPendingDelete(null);
      await loadAnimals();
      setNotice('Animal excluído com sucesso.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível excluir o animal.');
    }
  }

  function clearFilters() {
    setFilters({
      search: '',
      category: '',
      sex: '',
      lot: '',
      status: '',
    });
  }

  return (
    <PageShell
      title="Animais"
      description="Cadastro offline do rebanho com identificação, categoria, lote, peso e status."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Animais cadastrados</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{animals.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ativos</p>
          <p className="mt-2 text-2xl font-semibold text-field-700">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Resultado filtrado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{filteredAnimals.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Rebanho local</h3>
          <p className="text-sm text-slate-500">
            Funciona sem internet e salva diretamente no IndexedDB do dispositivo.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          <Plus size={18} aria-hidden="true" />
          Novo animal
        </button>
      </div>

      {notice ? (
        <div className="rounded-lg border border-field-100 bg-field-50 px-4 py-3 text-sm font-medium text-field-700">
          {notice}
        </div>
      ) : null}

      {animalPendingDelete ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-red-800">Confirmar exclusão</h3>
              <p className="mt-1 text-sm text-red-700">
                O animal {animalPendingDelete.identification} será marcado como excluído no banco
                local.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setAnimalPendingDelete(null)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Excluir animal
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!formOpen && formError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {formError}
        </div>
      ) : null}

      {formOpen ? (
        <AnimalForm
          animal={editingAnimal}
          animals={animals}
          lots={lots}
          error={formError}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      ) : null}

      <AnimalFilters filters={filters} lots={lotOptions} onChange={setFilters} onClear={clearFilters} />

      <AnimalList
        animals={filteredAnimals}
        loading={loading}
        getLotLabel={getLotLabel}
        onEdit={openEditForm}
        onDelete={handleDelete}
      />
    </PageShell>
  );
}
