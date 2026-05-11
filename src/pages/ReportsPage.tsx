import { Download, FileDown, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import {
  buildCsvReport,
  buildPdfReport,
  csvReportOptions,
  getAnimalOptionLabel,
  getAnimalOptions,
  getMatrixOptions,
  getReportSummary,
  loadReportDataset,
  type CsvReportKey,
  type PdfReportKey,
  type ReportDataset,
} from '../services/reportService';
import { downloadBlob, downloadTextFile } from '../utils/download';

interface SummaryCardProps {
  label: string;
  value: number;
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function ReportsPage() {
  const [dataset, setDataset] = useState<ReportDataset | null>(null);
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [selectedMatrixId, setSelectedMatrixId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const loadedDataset = await loadReportDataset();
      const animalOptions = getAnimalOptions(loadedDataset);
      const matrixOptions = getMatrixOptions(loadedDataset);

      setDataset(loadedDataset);
      setSelectedAnimalId((current) => current || animalOptions[0]?.id || '');
      setSelectedMatrixId((current) => current || matrixOptions[0]?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar relatórios.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const summary = useMemo(() => (dataset ? getReportSummary(dataset) : undefined), [dataset]);
  const animalOptions = useMemo(() => (dataset ? getAnimalOptions(dataset) : []), [dataset]);
  const matrixOptions = useMemo(() => (dataset ? getMatrixOptions(dataset) : []), [dataset]);

  function assertDataset() {
    if (!dataset) {
      throw new Error('Os dados locais ainda não foram carregados.');
    }

    return dataset;
  }

  function handleCsvExport(key: CsvReportKey) {
    setNotice(null);
    setError(null);
    setBusyReport(`csv-${key}`);

    try {
      const report = buildCsvReport(key, assertDataset());
      downloadTextFile(report.content, report.filename, 'text/csv;charset=utf-8');
      setNotice('CSV exportado com sucesso.');
    } catch (csvError) {
      setError(csvError instanceof Error ? csvError.message : 'Não foi possível exportar o CSV.');
    } finally {
      setBusyReport(null);
    }
  }

  function handlePdfExport(key: PdfReportKey) {
    setNotice(null);
    setError(null);
    setBusyReport(`pdf-${key}`);

    try {
      const report = buildPdfReport(key, assertDataset(), {
        animalId: selectedAnimalId,
        matrixId: selectedMatrixId,
      });

      downloadBlob(report.blob, report.filename);
      setNotice('PDF gerado com sucesso.');
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : 'Não foi possível gerar o PDF.');
    } finally {
      setBusyReport(null);
    }
  }

  return (
    <PageShell
      title="Relatórios"
      description="Exportações offline em CSV e PDFs simples gerados com os dados locais deste dispositivo."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Base local para relatórios</h3>
          <p className="text-sm text-slate-500">
            Atualize a leitura após cadastrar ou editar dados em outros módulos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={18} aria-hidden="true" />
          Atualizar dados
        </button>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Animais" value={summary.animals} />
          <SummaryCard label="Matrizes" value={summary.matrices} />
          <SummaryCard label="Inseminações" value={summary.inseminations} />
          <SummaryCard label="Partos" value={summary.births} />
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-field-100 bg-field-50 px-4 py-3 text-sm font-medium text-field-700">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-field-50 p-2 text-field-700">
            <FileSpreadsheet size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-950">Exportar CSV</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Arquivos separados por ponto e vírgula, com BOM UTF-8 para abrir bem em planilhas.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {csvReportOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleCsvExport(option.key)}
              disabled={loading || Boolean(busyReport)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={17} aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-sky-50 p-2 text-sky-700">
            <FileDown size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-950">Gerar PDF</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              PDFs simples e locais, úteis para salvar, imprimir ou compartilhar fora do app.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Relatórios gerais</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <button
                type="button"
                onClick={() => handlePdfExport('general')}
                disabled={loading || Boolean(busyReport)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-field-600 px-3 text-sm font-semibold text-white transition hover:bg-field-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Relatório geral
              </button>
              <button
                type="button"
                onClick={() => handlePdfExport('expectedBirths')}
                disabled={loading || Boolean(busyReport)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Partos previstos
              </button>
              <button
                type="button"
                onClick={() => handlePdfExport('pendingSanitary')}
                disabled={loading || Boolean(busyReport)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Manejos pendentes
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Ficha individual do animal</h4>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedAnimalId}
                onChange={(event) => setSelectedAnimalId(event.target.value)}
                disabled={loading || animalOptions.length === 0}
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {animalOptions.length === 0 ? (
                  <option value="">Nenhum animal cadastrado</option>
                ) : (
                  animalOptions.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {getAnimalOptionLabel(animal)}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => handlePdfExport('animalCard')}
                disabled={loading || Boolean(busyReport) || !selectedAnimalId}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-field-600 px-3 text-sm font-semibold text-white transition hover:bg-field-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Gerar ficha
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
            <h4 className="text-sm font-semibold text-slate-950">Histórico da matriz</h4>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedMatrixId}
                onChange={(event) => setSelectedMatrixId(event.target.value)}
                disabled={loading || matrixOptions.length === 0}
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-field-600 focus:ring-2 focus:ring-field-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {matrixOptions.length === 0 ? (
                  <option value="">Nenhuma matriz ou novilha cadastrada</option>
                ) : (
                  matrixOptions.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {getAnimalOptionLabel(animal)}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => handlePdfExport('matrixHistory')}
                disabled={loading || Boolean(busyReport) || !selectedMatrixId}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-field-600 px-3 text-sm font-semibold text-white transition hover:bg-field-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Gerar histórico
              </button>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Carregando dados locais para relatórios...
        </div>
      ) : null}
    </PageShell>
  );
}
