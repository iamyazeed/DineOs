import {
  AlertTriangle, ArrowLeftRight, Armchair, Bell, Building2, CalendarDays, ChartColumn, Check, ChefHat, Clock,
  FileText, History, House, LayoutGrid, Leaf, LogOut, Menu, MessageSquare, Moon, Package, Settings, ShieldCheck,
  Star, Sun, Truck, Users, Wrench, X, type LucideIcon,
} from "lucide-react";

const ICONS = {
  home: House,
  building: Building2,
  chart: ChartColumn,
  file: FileText,
  chat: MessageSquare,
  settings: Settings,
  clock: Clock,
  menu: Menu,
  users: Users,
  grid: LayoutGrid,
  check: Check,
  star: Star,
  flame: ChefHat,
  truck: Truck,
  box: Package,
  wrench: Wrench,
  bell: Bell,
  x: X,
  alert: AlertTriangle,
  calendar: CalendarDays,
  swap: ArrowLeftRight,
  history: History,
  shield: ShieldCheck,
  sun: Sun,
  moon: Moon,
  logout: LogOut,
  leaf: Leaf,
  seat: Armchair,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const C = ICONS[name];
  return <C className={className} size={size} strokeWidth={2} aria-hidden="true" />;
}
