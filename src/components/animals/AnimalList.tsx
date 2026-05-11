import { Edit, Trash2 } from 'lucide-react';
import {
  getAnimalCategoryLabel,
  getAnimalSexLabel,
  getAnimalStatusLabel,
} from '../../constants/animalOptions';
import type { Animal } from '../../types';
import { formatDatePtBr, formatWeightKg } from '../../utils/format';

interface AnimalListProps {
  animals: Animal[];
  loading?: boolean;
  getLotLabel?: (lotId?: string) => string;
  onEdit: (animal: Animal) => void;
  onDelete: (animal: Animal) => void;
}

function StatusBadge({ animal }: { animal: Animal }) {
  const tone =
    animal.status === 'active'
      ? 'bg-field-50 text-field-700'
      : animal.status === 'sold'
        ? 'bg-skyfield-100 text-skyfield-700'
        : 'bg-clay-100 text-clay-700';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {getAnimalStatusLabel(animal.status)}
    </span>
  );
}

function ActionButtons({
  animal,
  onEdit,
  onDelete,
}: Pick<AnimalListProps, 'onEdit' | 'onDelete'> & { animal: Animal }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onEdit(animal)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        aria-label={`Editar animal ${animal.identification}`}
        title="Editar"
      >
        <Edit size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(animal)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        aria-label={`Excluir animal ${animal.identification}`}
        title="Excluir"
      >
        <Trash2 size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

export function AnimalList({ animals, loading, getLotLabel, onEdit, onDelete }: AnimalListProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Carregando animais salvos neste dispositivo...
      </div>
    );
  }

  if (animals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
        <h3 className="text-base font-semibold text-slate-950">Nenhum animal encontrado</h3>
        <p className="mt-2 text-sm text-slate-500">
          Cadastre um animal ou ajuste os filtros para visualizar os registros locais.
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Brinco</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Animal</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Sexo</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Lote</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Peso</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {animals.map((animal) => (
              <tr key={animal.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                  {animal.identification}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{animal.name || '-'}</p>
                  <p className="text-xs text-slate-500">{animal.breed || 'Raça não informada'}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {getAnimalCategoryLabel(animal.category)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {getAnimalSexLabel(animal.sex)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {getLotLabel ? getLotLabel(animal.lot_id) : animal.lot_id || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatWeightKg(animal.weight_kg)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge animal={animal} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <ActionButtons animal={animal} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {animals.map((animal) => (
          <article key={animal.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-field-700">
                  {animal.identification}
                </p>
                <h3 className="mt-1 truncate text-base font-semibold text-slate-950">
                  {animal.name || animal.breed || 'Animal sem nome'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {getAnimalCategoryLabel(animal.category)} · {getAnimalSexLabel(animal.sex)}
                </p>
              </div>
              <StatusBadge animal={animal} />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Raça</dt>
                <dd className="font-medium text-slate-800">{animal.breed || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Lote</dt>
                <dd className="font-medium text-slate-800">
                  {getLotLabel ? getLotLabel(animal.lot_id) : animal.lot_id || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Nascimento</dt>
                <dd className="font-medium text-slate-800">{formatDatePtBr(animal.birth_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Peso</dt>
                <dd className="font-medium text-slate-800">{formatWeightKg(animal.weight_kg)}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <ActionButtons animal={animal} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
