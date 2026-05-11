export function formatDatePtBr(value?: string) {
  if (!value) {
    return '-';
  }

  const [year, month, day] = value.slice(0, 10).split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export function formatWeightKg(value?: number) {
  if (value === undefined || value === null) {
    return '-';
  }

  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} kg`;
}

export function formatNumberPtBr(value?: number, maximumFractionDigits = 2) {
  if (value === undefined || value === null) {
    return '-';
  }

  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(value);
}

export function formatCurrencyPtBr(value?: number) {
  if (value === undefined || value === null) {
    return '-';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
