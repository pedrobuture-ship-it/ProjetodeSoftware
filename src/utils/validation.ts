import { isValidDateString } from './date';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function assertRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} é obrigatório.`);
  }
}

export function assertOptionalDate(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (typeof value !== 'string' || !isValidDateString(value)) {
    throw new ValidationError(`${fieldName} deve ser uma data válida.`);
  }
}

export function assertRequiredDate(value: unknown, fieldName: string) {
  assertRequiredText(value, fieldName);
  assertOptionalDate(value, fieldName);
}

export function assertOptionalPositiveNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'number' || value < 0) {
    throw new ValidationError(`${fieldName} deve ser um número positivo.`);
  }
}

export function normalizeText(value: string) {
  return value.trim();
}

export function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeIdentifier(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR');
}
