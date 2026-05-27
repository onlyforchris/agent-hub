import type { ElementType } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Building2,
  Cable,
  ClipboardList,
  Cpu,
  Database,
  FileKey2,
  FolderTree,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Lock,
  MessageSquare,
  Network,
  Plug,
  Server,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCog,
  UsersRound,
  Waypoints,
  Wrench,
} from "lucide-react";

/**
 * 将 sys_menu.icon（Ant Design Outlined 命名）映射为 Lucide 图标。
 * 对齐 database/init 中菜单种子数据的 icon 字段。
 */
const MENU_ICON_MAP: Record<string, ElementType> = {
  // Ant Design Outlined（去后缀与完整名均支持）
  Robot: Bot,
  RobotOutlined: Bot,
  Api: Network,
  ApiOutlined: Network,
  Bell: Bell,
  BellOutlined: Bell,
  Database: Database,
  DatabaseOutlined: Database,
  Setting: Settings,
  SettingOutlined: Settings,
  Settings: Settings,
  SettingsOutlined: Settings,
  Lock: ShieldCheck,
  LockOutlined: ShieldCheck,
  ShieldCheck: ShieldCheck,
  ShieldCheckOutlined: ShieldCheck,
  User: UsersRound,
  UserOutlined: UsersRound,
  Apartment: Building2,
  ApartmentOutlined: Building2,
  Menu: FolderTree,
  MenuOutlined: FolderTree,
  Key: KeyRound,
  KeyOutlined: KeyRound,
  Dashboard: LayoutDashboard,
  DashboardOutlined: LayoutDashboard,
  BarChart: BarChart3,
  BarChartOutlined: BarChart3,
  LineChart: TrendingUp,
  LineChartOutlined: TrendingUp,
  FileText: ClipboardList,
  FileTextOutlined: ClipboardList,
  Book: BookOpen,
  BookOutlined: BookOpen,
  Tool: Wrench,
  ToolOutlined: Wrench,
  CloudServer: Server,
  CloudServerOutlined: Server,
  Thunderbolt: Activity,
  ThunderboltOutlined: Activity,
  Message: MessageSquare,
  MessageOutlined: MessageSquare,
  LayoutGrid: LayoutGrid,
  Plug: Plug,
  Cable: Cable,
  HardDrive: HardDrive,
  Cpu: Cpu,
  Brain: Brain,
  Waypoints: Waypoints,
  WaypointsOutlined: Waypoints,
  BotOutlined: Bot,
  ListChecks: ListChecks,
  FileKey2: FileKey2,
  UserCog: UserCog,
};

export function resolveMenuIcon(icon?: string | null): ElementType {
  const raw = (icon || "").trim();
  if (!raw) return LayoutGrid;
  if (MENU_ICON_MAP[raw]) return MENU_ICON_MAP[raw];
  const normalized = raw.replace(/Outlined$/i, "");
  if (MENU_ICON_MAP[normalized]) return MENU_ICON_MAP[normalized];
  return LayoutGrid;
}

/** RBAC 子路径菜单不再出现在侧栏，仅页内 Tab 切换 */
export function isRbacSubMenuPath(path?: string | null): boolean {
  const p = (path || "").trim();
  return p.startsWith("/settings/rbac/") && p !== "/settings/rbac";
}
