import {
  Activity,
  BarChart3,
  Beef,
  CalendarCheck,
  ClipboardList,
  Cog,
  DatabaseBackup,
  Gauge,
  HeartPulse,
  Map,
  Milk,
  Syringe,
} from 'lucide-react';
import type { AppRouteDefinition } from '../types';
import { AnimalsPage } from '../pages/AnimalsPage';
import { BackupPage } from '../pages/BackupPage';
import { BirthsPage } from '../pages/BirthsPage';
import { BullsSemenPage } from '../pages/BullsSemenPage';
import { DashboardPage } from '../pages/DashboardPage';
import { HealthManagementPage } from '../pages/HealthManagementPage';
import { InseminationsPage } from '../pages/InseminationsPage';
import { LotsPaddocksPage } from '../pages/LotsPaddocksPage';
import { MatricesPage } from '../pages/MatricesPage';
import { PregnancyDiagnosisPage } from '../pages/PregnancyDiagnosisPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';

export const appRoutes: AppRouteDefinition[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    shortLabel: 'Início',
    icon: Gauge,
    Component: DashboardPage,
  },
  {
    id: 'animais',
    path: '/animais',
    label: 'Animais',
    shortLabel: 'Animais',
    icon: Beef,
    Component: AnimalsPage,
  },
  {
    id: 'matrizes',
    path: '/matrizes',
    label: 'Matrizes',
    shortLabel: 'Matrizes',
    icon: Milk,
    Component: MatricesPage,
  },
  {
    id: 'inseminacoes',
    path: '/inseminacoes',
    label: 'Inseminações',
    shortLabel: 'IA',
    icon: Syringe,
    Component: InseminationsPage,
  },
  {
    id: 'diagnostico-gestacao',
    path: '/diagnostico-gestacao',
    label: 'Diagnóstico de Gestação',
    shortLabel: 'Diag.',
    icon: CalendarCheck,
    Component: PregnancyDiagnosisPage,
  },
  {
    id: 'partos',
    path: '/partos',
    label: 'Partos',
    shortLabel: 'Partos',
    icon: ClipboardList,
    Component: BirthsPage,
  },
  {
    id: 'touros-semen',
    path: '/touros-semen',
    label: 'Touros/Sêmen',
    shortLabel: 'Sêmen',
    icon: Activity,
    Component: BullsSemenPage,
  },
  {
    id: 'manejo-sanitario',
    path: '/manejo-sanitario',
    label: 'Manejo Sanitário',
    shortLabel: 'Sanitário',
    icon: HeartPulse,
    Component: HealthManagementPage,
  },
  {
    id: 'lotes-piquetes',
    path: '/lotes-piquetes',
    label: 'Lotes/Piquetes',
    shortLabel: 'Lotes',
    icon: Map,
    Component: LotsPaddocksPage,
  },
  {
    id: 'relatorios',
    path: '/relatorios',
    label: 'Relatórios',
    shortLabel: 'Relatórios',
    icon: BarChart3,
    Component: ReportsPage,
  },
  {
    id: 'configuracoes',
    path: '/configuracoes',
    label: 'Configurações',
    shortLabel: 'Config.',
    icon: Cog,
    Component: SettingsPage,
  },
  {
    id: 'backup',
    path: '/backup',
    label: 'Backup',
    shortLabel: 'Backup',
    icon: DatabaseBackup,
    Component: BackupPage,
  },
];
