#!/usr/bin/env node
/**
 * 将 frontend/docs/document_skills.zip 解压后的 *\_SKILL.md
 * 转为平台标准 Skill 包：{skill-code}/SKILL.md
 *
 * 用法:
 *   node scripts/convert-document-skills.mjs
 *   node scripts/convert-document-skills.mjs --input frontend/docs/document_skills_extracted --output backend/agent-server-runtime/src/main/resources/skills
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SKILL_META = {
  docx: {
    skillName: "Word 文档处理",
    category: "document",
    tags: ["document", "office", "docx", "word"],
    paths: ["**/*.docx", "**/*.doc"],
    sideEffectLevel: "high",
  },
  pdf: {
    skillName: "PDF 文档处理",
    category: "document",
    tags: ["document", "office", "pdf"],
    paths: ["**/*.pdf"],
    sideEffectLevel: "medium",
  },
  pptx: {
    skillName: "演示文稿处理",
    category: "document",
    tags: ["document", "office", "pptx", "slides"],
    paths: ["**/*.pptx", "**/*.ppt"],
    sideEffectLevel: "high",
  },
  xlsx: {
    skillName: "Excel 表格处理",
    category: "document",
    tags: ["document", "office", "xlsx", "spreadsheet", "excel"],
    paths: ["**/*.xlsx", "**/*.xlsm", "**/*.csv", "**/*.tsv"],
    sideEffectLevel: "high",
  },
};

const DEFAULT_POLICY = {
  network: { mode: "allow_with_confirm", allowlist: [] },
  filesystem_write: { mode: "allow_with_confirm", paths: ["**"] },
  scripts: { mode: "allow_with_confirm", sandbox: "strict" },
  tools: { mode: "inherit", allowlist: [], denylist: [] },
  side_effect_level: "medium",
  auto_invoke: true,
  context: "inline",
};

function parseArgs(argv) {
  const opts = {
    input: path.join(ROOT, "frontend/docs/document_skills_extracted"),
    output: path.join(ROOT, "backend/agent-server-runtime/src/main/resources/skills"),
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) opts.input = path.resolve(argv[++i]);
    if (argv[i] === "--output" && argv[i + 1]) opts.output = path.resolve(argv[++i]);
  }
  return opts;
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) throw new Error("缺少 YAML frontmatter");
  const yamlBlock = m[1];
  const body = m[2].trim();
  const fm = {};
  for (const line of yamlBlock.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return { fm, body };
}

function buildFrontmatter(code, fm, meta) {
  const policy = {
    ...DEFAULT_POLICY,
    side_effect_level: meta.sideEffectLevel,
  };
  const description = fm.description ?? "";
  const lines = [
    "---",
    `name: ${code}`,
    `description: ${JSON.stringify(description)}`,
    "metadata:",
    "  author: document-skills-pack",
    '  version: "1.0.0"',
    `  category: ${meta.category}`,
    "  execution_policy:",
    "    network:",
    "      mode: allow_with_confirm",
    "      allowlist: []",
    "    filesystem_write:",
    "      mode: allow_with_confirm",
    '      paths: ["**"]',
    "    scripts:",
    "      mode: allow_with_confirm",
    "      sandbox: strict",
    "    tools:",
    "      mode: inherit",
    "      allowlist: []",
    "      denylist: []",
    `    side_effect_level: ${meta.sideEffectLevel}`,
    "    auto_invoke: true",
    "    context: inline",
    "paths:",
    ...meta.paths.map((p) => `  - ${JSON.stringify(p)}`),
    `tags: [${meta.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    "---",
    "",
  ];
  return lines.join("\n");
}

function convertFile(inputPath, outputDir) {
  const base = path.basename(inputPath);
  const code = base.replace(/_SKILL\.md$/i, "").toLowerCase();
  const meta = SKILL_META[code];
  if (!meta) {
    console.warn(`跳过未知 Skill 文件: ${base}`);
    return null;
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const { fm, body } = parseFrontmatter(raw);
  const skillDir = path.join(outputDir, code);
  fs.mkdirSync(skillDir, { recursive: true });

  const out = buildFrontmatter(code, fm, meta) + body + "\n";
  const outPath = path.join(skillDir, "SKILL.md");
  fs.writeFileSync(outPath, out, "utf8");

  return {
    code,
    skillName: meta.skillName,
    description: fm.description ?? "",
    descriptionLen: (fm.description ?? "").length,
    bodyLines: body.split("\n").length,
    outPath,
  };
}

function main() {
  const { input, output } = parseArgs(process.argv);
  if (!fs.existsSync(input)) {
    console.error(`输入目录不存在: ${input}`);
    console.error("请先解压: Expand-Archive frontend/docs/document_skills.zip -DestinationPath frontend/docs/document_skills_extracted");
    process.exit(1);
  }

  const files = fs.readdirSync(input).filter((f) => f.endsWith("_SKILL.md"));
  if (files.length === 0) {
    console.error(`未找到 *_SKILL.md: ${input}`);
    process.exit(1);
  }

  fs.mkdirSync(output, { recursive: true });
  const results = [];
  for (const f of files) {
    results.push(convertFile(path.join(input, f), output));
  }

  console.log("\n转化完成:\n");
  for (const r of results.filter(Boolean)) {
    const warn = r.descriptionLen > 1024 ? " ⚠ description 超过 1024，导入前需截断" : "";
    console.log(`  ${r.code.padEnd(6)} → ${r.outPath}`);
    console.log(`         展示名: ${r.skillName} | 正文 ${r.bodyLines} 行${warn}`);
  }

  console.log(`
下一步:
  1. 管理台 Skill 管理 → 逐个「导入 SKILL.md」(${results.length} 个)
  2. 或调用 POST /api/skills/import (multipart file=SKILL.md)
  3. 导入后编辑 skill_name 为中文展示名（import 接口目前用 name 作 skillName）
  4. 发布 Skill 并挂载到目标 Agent（建议单独 document Agent，勿默认挂 cashflow）

注意:
  - zip 内仅有指令正文，不含 scripts/references；正文引用的 scripts/office/* 需另行提供或改写为平台 Tool
  - frontmatter 含 license: Proprietary，商用前请确认授权
`);
}

main();
