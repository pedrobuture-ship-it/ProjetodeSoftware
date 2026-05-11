export function nowIso() {
  return new Date().toISOString();
}

export function isValidDateString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isFutureDate(value: string) {
  return value > todayDateString();
}

export function isBeforeDate(value: string, minimumDate: string) {
  return value < minimumDate;
}

export function daysBetweenDateStrings(startDate: string, endDate: string) {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay);
}

export function monthKeyFromDateString(value: string) {
  return value.slice(0, 7);
}
