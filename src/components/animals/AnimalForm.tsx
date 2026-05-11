import { Save, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  animalCategoryOptions,
  animalSexOptions,
  animalStatusOptions,
} from '../../constants/animalOptions';
import type { Animal, AnimalCategory, AnimalSex, AnimalStatus, Lot } from '../../types';

export interface AnimalFormPayload {
  identification: string;
  name?: string;
  category: AnimalCategory;
  breed?: string;
  sex: AnimalSex;
  birth_date?: string;
  weight_kg?: number;
  lot_id?: string;
  status: AnimalStatus;
  mother_id?: string;
  father_id?: string;
  notes?: string;
}

interface AnimalFormState {
  identification: string;
  name: string;
  category: AnimalCategory;
  breed: string;
  sex: AnimalSex;
  birth_date: string;
  weight_kg: string;
  lot_id: string;
  status: AnimalStatus;
  mother_id: string;
  father_id: string;
  notes: string;
}

interface AnimalFormProps {
  animal?: Animal | null;
  animals: Animal[];
  lots: Lot[];
  error?: string | null;
  saving?: boolean;
  onSubmit: (payload: AnimalFormPayload) => Promise<void>;
  onCancel: () => void;
}

const emptyForm: AnimalFormState = {
  identification: '',
  name: '',
  category: 'matrix',
  breed: '',
  sex: 'female',
  birth_date: '',
  weight_kg: '',
  lot_id: '',
  status: 'active',
  mother_id: '',
  father_id: '',
  notes: '',
};

function animalToForm(animal?: Animal | null): AnimalFormState {
  if (!animal) {
    return emptyForm;
  }

  return {
    identification: animal.identification,
    name: animal.name ?? '',
    category: animal.category,
    breed: animal.breed ?? '',
    sex: animal.sex,
    birth_date: animal.birth_date ?? '',
    weight_kg: animal.weight_kg?.toString() ?? '',
    lot_id: animal.lot_id ?? '',
    status: animal.status,
    mother_id: animal.mother_id ?? '',
    father_id: animal.father_id ?? '',
    notes: animal.notes ?? '',
  };
}

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseWeight(value: string) {
  const normalized = value.trim().replace(',', '.');
  return normalized ? Number(normalized) : undefined;
}

function animalOptionLabel(animal: Animal) {
  return `${animal.identification}${animal.name ? ` - ${animal.name}` : ''}`;
}

export function AnimalForm({
  animal,
  animals,
  lots,
  error,
  saving,
  onSubmit,
  onCancel,
}: AnimalFormProps) {
  const [form, setForm] = useState<AnimalFormState>(() => animalToForm(animal));
  const [clientError, setClientError] = useState<string | null>(null);
  const isEditing = Boolean(animal);

  useEffect(() => {
    setForm(animalToForm(animal));
    setClientError(null);
  }, [animal]);

  const lotOptions = useMemo(
    () =>
      [...lots].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [lots],
  );

  const animalReferenceOptions = useMemo(
    () =>
      animals
        .filter((item) => item.id !== animal?.id)
        .sort((a, b) => a.identification.localeCompare(b.identification, 'pt-BR')),
    [animal?.id, animals],
  );

  function updateField<K extends keyof AnimalFormState>(field: K, value: AnimalFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);

    if (!form.identification.trim()) {
      setClientError('Informe o brinco/identificação antes de salvar.');
      return;
    }

    const weight = parseWeight(form.weight_kg);

    if (weight !== undefined && Number.isNaN(weight)) {
      setClientError('Informe um peso válido.');
      return;
    }

    if (weight !== undefined && weight < 0) {
      setClientError('O peso deve ser um número positivo.');
      return;
    }

    await onSubmit({
      identification: form.identification,
      name: cleanText(form.name),
      category: form.category,
      breed: cleanText(form.breed),
      sex: form.sex,
      birth_date: cleanText(form.birth_date),
      weight_kg: weight,
      lot_id: cleanText(form.lot_id),
      status: form.status,
      mother_id: cleanText(form.mother_id),
      father_id: cleanText(form.father_id),
      notes: cleanText(form.notes),
    });
  }

  const visibleError = clientError ?? error;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            {isEditing ? 'Editar animal' : 'Cadastrar animal'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Os dados ficam salvos no banco local do dispositivo.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
          aria-label="Fechar formulário"
          title="Fechar"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {visibleError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {visibleError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Identificação/brinco *</span>
          <input
            value={form.identification}
            onChange={(event) => updateField('identification', event.target.value)}
            placeholder="Ex.: 0234"
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Nome</span>
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Opcional"
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Raça</span>
          <input
            value={form.breed}
            onChange={(event) => updateField('breed', event.target.value)}
            placeholder="Ex.: Nelore"
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Categoria</span>
          <select
            value={form.category}
            onChange={(event) => updateField('category', event.target.value as AnimalCategory)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
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
            value={form.sex}
            onChange={(event) => updateField('sex', event.target.value as AnimalSex)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            {animalSexOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Data de nascimento</span>
          <input
            type="date"
            value={form.birth_date}
            onChange={(event) => updateField('birth_date', event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Peso</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.weight_kg}
            onChange={(event) => updateField('weight_kg', event.target.value)}
            placeholder="kg"
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Lote/piquete</span>
          <select
            value={form.lot_id}
            onChange={(event) => updateField('lot_id', event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            <option value="">Sem lote</option>
            {lotOptions.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
            {form.lot_id && !lotOptions.some((lot) => lot.id === form.lot_id) ? (
              <option value={form.lot_id}>{form.lot_id}</option>
            ) : null}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            value={form.status}
            onChange={(event) => updateField('status', event.target.value as AnimalStatus)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            {animalStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Mãe</span>
          <select
            value={form.mother_id}
            onChange={(event) => updateField('mother_id', event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            <option value="">Não informado</option>
            {animalReferenceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {animalOptionLabel(option)}
              </option>
            ))}
            {form.mother_id && !animalReferenceOptions.some((option) => option.id === form.mother_id) ? (
              <option value={form.mother_id}>{form.mother_id}</option>
            ) : null}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Pai</span>
          <select
            value={form.father_id}
            onChange={(event) => updateField('father_id', event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          >
            <option value="">Não informado</option>
            {animalReferenceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {animalOptionLabel(option)}
              </option>
            ))}
            {form.father_id && !animalReferenceOptions.some((option) => option.id === form.father_id) ? (
              <option value={form.father_id}>{form.father_id}</option>
            ) : null}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Observações</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            rows={4}
            placeholder="Informações úteis para o manejo no campo"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Save size={18} aria-hidden="true" />
          {saving ? 'Salvando...' : 'Salvar animal'}
        </button>
      </div>
    </form>
  );
}
