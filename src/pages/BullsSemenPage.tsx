import { AlertTriangle, Edit, Plus, Save, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getSemenStatusLabel,
  isLowSemenStock,
  semenStatusOptions,
} from '../constants/semenOptions';
import { PageShell } from '../components/layout/PageShell';
import * as semenService from '../services/semenService';
import type { Semen, SemenStatus } from '../types';
import { formatCurrencyPtBr, formatNumberPtBr } from '../utils/format';

interface SemenFormState {
  bull_name: string;
  breed: string;
  semen_center: string;
  doses_available: string;
  price_per_dose: string;
  genetic_traits: string;
  notes: string;
  status: SemenStatus;
}

const emptySemenForm: SemenFormState = {
  bull_name: '',
  breed: '',
  semen_center: '',
  doses_available: '',
  price_per_dose: '',
  genetic_traits: '',
  notes: '',
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

function semenToForm(semen?: Semen | null): SemenFormState {
  if (!semen) {
    return emptySemenForm;
  }

  return {
    bull_name: semen.bull_name,
    breed: semen.breed ?? '',
    semen_center: semen.semen_center ?? semen.supplier ?? '',
    doses_available: (semen.doses_available ?? semen.quantity)?.toString() ?? '',
    price_per_dose: semen.price_per_dose?.toString() ?? '',
    genetic_traits: semen.genetic_traits ?? '',
    notes: semen.notes ?? '',
    status: semen.status ?? 'active',
  };
}

export function BullsSemenPage() {
  const [semenRecords, setSemenRecords] = useState<Semen[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSemen, setEditingSemen] = useState<Semen | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Semen | null>(null);
  const [form, setForm] = useState<SemenFormState>(emptySemenForm);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSemen() {
    setLoading(true);

    try {
      setSemenRecords(await semenService.list());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar sêmen.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSemen();
  }, []);

  const filteredSemen = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

    if (!normalizedSearch) {
      return semenRecords;
    }

    return semenRecords.filter((semen) =>
      [semen.bull_name, semen.code, semen.breed, semen.semen_center, semen.supplier]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedSearch)),
    );
  }, [search, semenRecords]);

  const lowStockCount = useMemo(
    () =>
      semenRecords.filter((semen) =>
        isLowSemenStock(semen.doses_available ?? semen.quantity ?? 0),
      ).length,
    [semenRecords],
  );

  function openCreateForm() {
    setEditingSemen(null);
    setPendingDelete(null);
    setForm(emptySemenForm);
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(semen: Semen) {
    setEditingSemen(semen);
    setPendingDelete(null);
    setForm(semenToForm(semen));
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingSemen(null);
    setForm(emptySemenForm);
    setError(null);
  }

  function updateForm<K extends keyof SemenFormState>(field: K, value: SemenFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const doses = parseDecimal(form.doses_available);
    const price = parseDecimal(form.price_per_dose);

    if (!form.bull_name.trim()) {
      setError('Informe o nome ou código do touro.');
      setSaving(false);
      return;
    }

    if ((doses !== undefined && Number.isNaN(doses)) || (price !== undefined && Number.isNaN(price))) {
      setError('Informe valores numéricos válidos para doses e valor por dose.');
      setSaving(false);
      return;
    }

    if ((doses !== undefined && doses < 0) || (price !== undefined && price < 0)) {
      setError('Doses e valor por dose não podem ser negativos.');
      setSaving(false);
      return;
    }

    const payload = {
      bull_name: form.bull_name,
      code: cleanText(form.bull_name),
      breed: cleanText(form.breed),
      supplier: cleanText(form.semen_center),
      semen_center: cleanText(form.semen_center),
      doses_available: doses ?? 0,
      quantity: doses ?? 0,
      price_per_dose: price,
      genetic_traits: cleanText(form.genetic_traits),
      notes: cleanText(form.notes),
      status: doses === 0 && form.status === 'active' ? 'sold_out' : form.status,
    } satisfies semenService.CreateSemenInput;

    try {
      if (editingSemen) {
        await semenService.update(editingSemen.id, payload);
        setMessage('Registro de touro/sêmen atualizado com sucesso.');
      } else {
        await semenService.create(payload);
        setMessage('Registro de touro/sêmen cadastrado com sucesso.');
      }

      closeForm();
      await loadSemen();
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
      await semenService.deleteSemen(pendingDelete.id);
      setPendingDelete(null);
      setMessage('Registro excluído com sucesso.');
      await loadSemen();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir.');
    }
  }

  return (
    <PageShell
      title="Touros/Sêmen"
      description="Controle offline de touros, centrais de sêmen, doses disponíveis e características genéticas."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Registros</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{semenRecords.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Estoque baixo</p>
          <p className="mt-2 text-2xl font-semibold text-clay-700">{lowStockCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Resultado filtrado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{filteredSemen.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full sm:max-w-md">
          <span className="text-sm font-medium text-slate-700">Buscar</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome/código, raça ou central"
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100"
          />
        </label>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-4 text-sm font-semibold text-white transition hover:bg-field-700 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
        >
          <Plus size={18} aria-hidden="true" />
          Novo registro
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
              Excluir {pendingDelete.bull_name}? O registro será marcado como excluído localmente.
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
                {editingSemen ? 'Editar touro/sêmen' : 'Cadastrar touro/sêmen'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">Tudo será salvo no IndexedDB local.</p>
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
              <span className="text-sm font-medium text-slate-700">Nome ou código do touro *</span>
              <input
                value={form.bull_name}
                onChange={(event) => updateForm('bull_name', event.target.value)}
                placeholder="Ex.: Touro 4532"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Raça</span>
              <input
                value={form.breed}
                onChange={(event) => updateForm('breed', event.target.value)}
                placeholder="Ex.: Nelore"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Central de sêmen</span>
              <input
                value={form.semen_center}
                onChange={(event) => updateForm('semen_center', event.target.value)}
                placeholder="Ex.: Central ABC"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Doses disponíveis</span>
              <input
                value={form.doses_available}
                onChange={(event) => updateForm('doses_available', event.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 12"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Valor por dose</span>
              <input
                value={form.price_per_dose}
                onChange={(event) => updateForm('price_per_dose', event.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 35,00"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value as SemenStatus)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
              >
                {semenStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Características genéticas</span>
              <textarea
                value={form.genetic_traits}
                onChange={(event) => updateForm('genetic_traits', event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-field-600 focus:ring-2 focus:ring-field-100"
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

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando registros locais...</div>
        ) : filteredSemen.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">Nenhum registro encontrado.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSemen.map((semen) => {
              const doses = semen.doses_available ?? semen.quantity ?? 0;
              const lowStock = isLowSemenStock(doses);

              return (
                <article key={semen.id} className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">{semen.bull_name}</h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {getSemenStatusLabel(semen.status ?? 'active')}
                        </span>
                        {lowStock ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-harvest-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                            <AlertTriangle size={14} aria-hidden="true" />
                            Doses baixas
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {semen.breed || 'Raça não informada'} · {semen.semen_center || semen.supplier || 'Central não informada'}
                      </p>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Doses</dt>
                          <dd className="font-semibold text-slate-900">{formatNumberPtBr(doses, 1)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Valor por dose</dt>
                          <dd className="font-semibold text-slate-900">{formatCurrencyPtBr(semen.price_per_dose)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Genética</dt>
                          <dd className="font-semibold text-slate-900">{semen.genetic_traits || '-'}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="flex shrink-0 justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(semen)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        aria-label={`Editar ${semen.bull_name}`}
                        title="Editar"
                      >
                        <Edit size={17} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(semen)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                        aria-label={`Excluir ${semen.bull_name}`}
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
