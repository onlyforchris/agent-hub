export type AppViewMode = "finance" | "sap" | "dms" | "admin";

export type WorkbenchUrlTab = "overview" | "todo" | "confirm" | "list" | "progress" | "cases" | "compare" | "governance";

export type RbacSection = "users" | "departments" | "menus" | "resources" | "roles";

export interface AppUrlParams {
  view: AppViewMode | null;
  workbenchTab: WorkbenchUrlTab | null;
  billNo: string | null;
  rbacSection: RbacSection | null;
}

const VALID_TABS = new Set<string>(["overview", "todo", "confirm", "list", "progress", "cases", "compare", "governance"]);
const VALID_RBAC_SECTIONS = new Set<string>(["users", "departments", "menus", "resources", "roles"]);

export function rbacSectionFromPath(pathname: string): RbacSection | null {
  const map: Record<string, RbacSection> = {
    "/settings/rbac/users": "users",
    "/settings/rbac/departments": "departments",
    "/settings/rbac/menus": "menus",
    "/settings/rbac/resources": "resources",
    "/settings/rbac/roles": "roles",
  };
  return map[pathname] ?? null;
}

export function readAppUrlParams(): AppUrlParams {
  const params = new URLSearchParams(window.location.search);
  const viewRaw = params.get("view");
  const tabRaw = params.get("tab");
  const billNoRaw = params.get("billNo");

  const sectionRaw = params.get("section");

  return {
    view:
      viewRaw === "admin" || viewRaw === "finance" || viewRaw === "sap" || viewRaw === "dms"
        ? viewRaw
        : viewRaw === "business"
          ? "finance"
          : null,
    workbenchTab: tabRaw && VALID_TABS.has(tabRaw) ? (tabRaw as WorkbenchUrlTab) : null,
    billNo: billNoRaw?.trim() || null,
    rbacSection:
      sectionRaw && VALID_RBAC_SECTIONS.has(sectionRaw) ? (sectionRaw as RbacSection) : rbacSectionFromPath(window.location.pathname),
  };
}

export function syncAppUrlParams(patch: {
  view?: AppViewMode;
  workbenchTab?: WorkbenchUrlTab | null;
  billNo?: string | null;
  rbacSection?: RbacSection | null;
}) {
  const params = new URLSearchParams(window.location.search);

  if (patch.view !== undefined) {
    params.set("view", patch.view);
  }
  if (patch.workbenchTab !== undefined) {
    if (patch.workbenchTab) {
      params.set("tab", patch.workbenchTab);
    } else {
      params.delete("tab");
    }
  }
  if (patch.billNo !== undefined) {
    if (patch.billNo) {
      params.set("billNo", patch.billNo);
    } else {
      params.delete("billNo");
    }
  }
  if (patch.rbacSection !== undefined) {
    if (patch.rbacSection) {
      params.set("section", patch.rbacSection);
    } else {
      params.delete("section");
    }
  }

  const query = params.toString();
  const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, "", next);
}
