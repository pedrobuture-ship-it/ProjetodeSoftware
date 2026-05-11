import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

export * from './offline';

export type AppRouteId =
  | 'dashboard'
  | 'animais'
  | 'matrizes'
  | 'inseminacoes'
  | 'diagnostico-gestacao'
  | 'partos'
  | 'touros-semen'
  | 'manejo-sanitario'
  | 'lotes-piquetes'
  | 'relatorios'
  | 'configuracoes'
  | 'backup';

export interface AppRouteDefinition {
  id: AppRouteId;
  path: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  Component: ComponentType;
}
