import { Search, SlidersHorizontal, X } from 'lucide-react';
import {
  animalCategoryOptions,
  animalSexOptions,
  animalStatusOptions,
} from '../../constants/animalOptions';
import type { AnimalCategory, AnimalSex, AnimalStatus } from '../../types';

export interface AnimalFiltersState {
  search: string;
  category: AnimalCategory | '';
  sex: AnimalSex | '';
  lot: string;
  status: AnimalStatus | '';
}

export interface LotFilterOption {
  value: string;
  label: string;
}

interface AnimalFiltersProps {
  filters: AnimalFiltersState;
  lots: LotFilterOption[];
  onChange: (filters: AnimalFiltersState) => void;
  onClear: () => void;
}

export function AnimalFilters({ filters, lots, onChange, onClear }: AnimalFiltersProps) {
  function updateFilter<K extends keyof AnimalFiltersState>(
    key: K,
    value: AnimalFiltersState[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filtros
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          <X size={16} aria-hidden="true" />
          Limpar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="block md:col-span-2 xl:col-span-1">
          <span className="text-sm font-medium text-slate-700">Buscar</span>
          <div className="relative mt-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Brinco, nome ou raça"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Categoria</span>
          <select
            value={filters.category}
            onChange={(event) => updateFilter('category', event.target.value as AnimalCategory | '')}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            <option value="">Todas</option>
            {animalCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Sexo</span>
          <select
            value={filters.sex}
            onChange={(event) => updateFilter('sex', event.target.value as AnimalSex | '')}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            <option value="">Todos</option>
            {animalSexOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Lote/piquete</span>
          <select
            value={filters.lot}
            onChange={(event) => updateFilter('lot', event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            <option value="">Todos</option>
            {lots.map((lot) => (
              <option key={lot.value} value={lot.value}>
                {lot.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value as AnimalStatus | '')}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            <option value="">Todos</option>
            {animalStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
