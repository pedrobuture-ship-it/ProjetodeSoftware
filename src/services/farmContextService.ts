export interface ActiveFarmContext {
  id?: string;
  name?: string;
}

const ACTIVE_FARM_ID_KEY = 'fazenda-cria:selected-farm-id';
const ACTIVE_FARM_NAME_KEY = 'fazenda-cria:selected-farm-name';
export const ACTIVE_FARM_CHANGED_EVENT = 'fazenda-cria:active-farm-changed';

function dispatchFarmChange() {
  window.dispatchEvent(new CustomEvent(ACTIVE_FARM_CHANGED_EVENT, { detail: getActiveFarmContext() }));
}

export function getActiveFarmId() {
  try {
    return window.localStorage.getItem(ACTIVE_FARM_ID_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function getActiveFarmName() {
  try {
    return window.localStorage.getItem(ACTIVE_FARM_NAME_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function getActiveFarmContext(): ActiveFarmContext {
  return {
    id: getActiveFarmId(),
    name: getActiveFarmName(),
  };
}

export function setActiveFarmContext(context: ActiveFarmContext) {
  if (context.id) {
    window.localStorage.setItem(ACTIVE_FARM_ID_KEY, context.id);
  } else {
    window.localStorage.removeItem(ACTIVE_FARM_ID_KEY);
  }

  if (context.name) {
    window.localStorage.setItem(ACTIVE_FARM_NAME_KEY, context.name);
  } else if (!context.id) {
    window.localStorage.removeItem(ACTIVE_FARM_NAME_KEY);
  }

  dispatchFarmChange();
}

export function setActiveFarmName(name: string) {
  const normalizedName = name.trim();

  if (normalizedName) {
    window.localStorage.setItem(ACTIVE_FARM_NAME_KEY, normalizedName);
    dispatchFarmChange();
  }
}

export function subscribeActiveFarmChange(callback: (context: ActiveFarmContext) => void) {
  function handler() {
    callback(getActiveFarmContext());
  }

  window.addEventListener(ACTIVE_FARM_CHANGED_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(ACTIVE_FARM_CHANGED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
