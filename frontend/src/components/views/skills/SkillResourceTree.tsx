import React, { useMemo, useState } from "react";
import { ChevronRight, File, FileCode, FileText, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import type { SkillResource } from "@/src/api/skills.ts";
import { MarkdownPreview } from "@/src/components/ui/MarkdownPreview.tsx";

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  resource?: SkillResource;
};

function kindIcon(kind?: string, isDir?: boolean) {
  if (isDir) return Folder;
  if (kind === "script") return FileCode;
  if (kind === "reference") return FileText;
  return File;
}

function insertPath(root: TreeNode[], segments: string[], resource: SkillResource) {
  let current = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    let node = current.find((n) => n.name === seg);
    if (!node) {
      node = {
        name: seg,
        path: segments.slice(0, i + 1).join("/"),
        isDir: !isLast,
        children: [],
        resource: isLast ? resource : undefined,
      };
      current.push(node);
    }
    if (isLast) {
      node.isDir = false;
      node.resource = resource;
    } else {
      node.isDir = true;
    }
    current = node.children;
  }
}

function buildTree(resources: SkillResource[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const r of resources) {
    const path = r.resourcePath.replace(/\\/g, "/");
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) continue;
    insertPath(root, segments, r);
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root);
  return root;
}

function TreeRow({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string, resource?: SkillResource) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const Icon = kindIcon(node.resource?.resourceKind, node.isDir);
  const active = selectedPath === node.path;

  if (node.isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-50",
            active && "bg-indigo-50 text-indigo-700",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform", open && "rotate-90")} />
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}
          <span className="truncate font-medium text-slate-700">{node.name}</span>
        </button>
        {open &&
          node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path, node.resource)}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-50",
        active && "bg-indigo-50 font-medium text-indigo-700",
      )}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{node.name}</span>
      {node.resource?.resourceKind && (
        <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
          {node.resource.resourceKind}
        </span>
      )}
    </button>
  );
}

export function SkillResourceTree({ resources }: { resources: SkillResource[] }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<SkillResource | null>(null);

  const tree = useMemo(() => buildTree(resources), [resources]);

  const handleSelect = (path: string, resource?: SkillResource) => {
    setSelectedPath(path);
    setSelectedResource(resource ?? null);
  };

  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
        暂无附属资源。导入 ZIP 包（含 scripts/、references/）后会显示在此。
      </div>
    );
  }

  const previewText = selectedResource?.contentText;
  const isMarkdown =
    selectedResource?.resourcePath?.endsWith(".md") ||
    selectedResource?.resourceKind === "reference";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(200px,240px)_1fr]">
      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          包内文件 ({resources.length})
        </p>
        <div className="scrollbar-default max-h-[min(48vh,400px)] overflow-y-auto">
          {tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
      <div className="min-h-[200px] rounded-xl border border-slate-100 bg-white">
        {!selectedResource ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-slate-400">
            选择左侧文件查看内容
          </div>
        ) : (
          <>
            <div className="border-b border-slate-100 px-4 py-2.5 font-mono text-xs text-slate-600">
              {selectedResource.resourcePath}
            </div>
            <div className="scrollbar-default max-h-[min(48vh,400px)] overflow-auto p-4">
              {previewText ? (
                isMarkdown ? (
                  <MarkdownPreview content={previewText} />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-slate-700">
                    {previewText}
                  </pre>
                )
              ) : selectedResource.storageUri ? (
                <p className="text-sm text-slate-500">大文件已存对象存储：{selectedResource.storageUri}</p>
              ) : (
                <p className="text-sm text-slate-400">（无文本预览）</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
