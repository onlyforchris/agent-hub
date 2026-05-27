// Model Gateway：脱敏 → 模型调用 → 兜底模板
// 对应方案 V3.0 第 8 章
//
// POC 阶段支持的 Provider：DeepSeek V4 Flash（默认）/ Qwen（阿里云 DashScope 兼容 OpenAI 模式）。
// 两者均使用 OpenAI Chat Completions 协议，调用统一封装在 callOpenAICompatible。
// 两个 Key 都未配置时，自动降级到本地确定性兜底模板（仍能完整跑通 Demo）。

import type { EvidenceItem } from "../runtime/types.js";

export interface ModelGatewayInput {
  runId: string;
  agentCode: string;
  skillCode: string;
  desensitizedSummary: Record<string, unknown>;
  evidence: EvidenceItem[];
  reviewSuggestionSeed: { reviewRoutes: string[] };
}

export type GatewayProvider = "deepseek" | "qwen" | "fallback_template";

export interface ModelGatewayOutput {
  reportText: string;
  mode: "model" | "fallback";
  gatewayDebug: {
    payloadToModel: Record<string, unknown>;
    desensitized: boolean;
    provider: GatewayProvider;
    model: string;
    durationMs: number;
  };
}

interface ResolvedProvider {
  provider: GatewayProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * 当前 Gateway 实际会使用的 Provider，受 MODEL_PROVIDER 控制：
 *  - "deepseek"：强制 DeepSeek，缺 Key 时降级到 fallback。
 *  - "qwen"    ：强制 Qwen，缺 Key 时降级到 fallback。
 *  - "auto"（默认）：优先 DeepSeek，再 Qwen，再 fallback。
 */
export function resolveProvider(): ResolvedProvider {
  const mode = (process.env.MODEL_PROVIDER || "auto").toLowerCase();
  const deepseekKey = (process.env.DEEPSEEK_API_KEY || "").trim();
  const qwenKey = (process.env.QWEN_API_KEY || "").trim();
  const deepseekModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const qwenModel = process.env.QWEN_MODEL || "qwen-max";
  const deepseekBase = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  const qwenBase =
    process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

  const isValidKey = (k: string) => k !== "" && !k.includes("YOUR_") && !k.includes("MY_");

  if (mode === "deepseek") {
    return isValidKey(deepseekKey)
      ? { provider: "deepseek", model: deepseekModel, apiKey: deepseekKey, baseUrl: deepseekBase }
      : { provider: "fallback_template", model: "fallback_template" };
  }
  if (mode === "qwen") {
    return isValidKey(qwenKey)
      ? { provider: "qwen", model: qwenModel, apiKey: qwenKey, baseUrl: qwenBase }
      : { provider: "fallback_template", model: "fallback_template" };
  }
  if (isValidKey(deepseekKey)) {
    return { provider: "deepseek", model: deepseekModel, apiKey: deepseekKey, baseUrl: deepseekBase };
  }
  if (isValidKey(qwenKey)) {
    return { provider: "qwen", model: qwenModel, apiKey: qwenKey, baseUrl: qwenBase };
  }
  return { provider: "fallback_template", model: "fallback_template" };
}

// 极简脱敏：单据号/MDM 整段已经在 desensitizedSummary 中处理，这里只做兜底兼容
function desensitize(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(payload));
}

function buildFallbackReport(input: ModelGatewayInput): string {
  const lines: string[] = [];
  lines.push("#### 根因结论");
  lines.push(String(input.desensitizedSummary.root_cause ?? ""));
  lines.push("");
  lines.push("#### 异常首次发生环节");
  lines.push(String(input.desensitizedSummary.first_abnormal_node ?? ""));
  lines.push("");
  lines.push("#### 证据链摘要");
  input.evidence.forEach((e, i) => {
    lines.push(
      `${i + 1}. ${e.sourceSystem}｜${e.checkField}：期望「${e.expected}」，实际「${e.actual}」，判断：${e.result}。`,
    );
  });
  lines.push("");
  lines.push("#### 复核建议");
  lines.push(`建议路由到：${input.reviewSuggestionSeed.reviewRoutes.join("、")}。`);
  lines.push("");
  lines.push("#### 边界说明");
  lines.push(
    "本平台采用「确定性规则计算在前，模型辅助解释在后」的方式。模型仅接收脱敏摘要和证据模板，不直接访问数据库；平台不自动修复数据、不自动过账、不替代 SAP/DMS/帆软。",
  );
  return lines.join("\n");
}

function buildPrompt(payloadToModel: Record<string, unknown>): string {
  return `你是财务对账差异归因平台的报告助手。
只能基于以下脱敏摘要 + 证据撰写中文报告，不得提出自动修复、自动过账、替代 SAP/DMS/帆软的建议。
不要回填任何具体单号、MDM ID 或金额数字（如出现请使用占位符 A/Y/X）。

请用以下五个二级标题输出，标题与正文之间换一行：
#### 根因结论
#### 异常首次发生环节
#### 证据链摘要
#### 复核建议
#### 边界说明

输入数据：
${JSON.stringify(payloadToModel, null, 2)}`;
}

/**
 * DeepSeek 与 Qwen（DashScope 兼容模式）都使用 OpenAI Chat Completions 协议，
 * 通过 baseUrl + model 区分即可。Node 18+ 已内置 fetch。
 */
async function callOpenAICompatible(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是财务对账差异归因平台的报告助手。严格基于脱敏证据撰写中文报告，禁止提出自动修复/自动过账/替代外部系统的建议。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      stream: false,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty content from model");
  return content;
}

export async function runModelGateway(input: ModelGatewayInput): Promise<ModelGatewayOutput> {
  const start = Date.now();
  const payloadToModel = desensitize({
    task: "generate_attribution_report",
    skill: input.skillCode,
    summary: input.desensitizedSummary,
    evidence: input.evidence.map((e) => ({
      source: e.sourceSystem,
      field: e.checkField,
      result: e.result,
    })),
    review_routes: input.reviewSuggestionSeed.reviewRoutes,
  });

  const resolved = resolveProvider();

  if (resolved.provider === "fallback_template") {
    return {
      reportText: buildFallbackReport(input),
      mode: "fallback",
      gatewayDebug: {
        payloadToModel,
        desensitized: true,
        provider: "fallback_template",
        model: "fallback_template",
        durationMs: Date.now() - start,
      },
    };
  }

  const prompt = buildPrompt(payloadToModel);

  try {
    const text = await callOpenAICompatible(
      resolved.apiKey!,
      resolved.baseUrl!,
      resolved.model,
      prompt,
    );
    return {
      reportText: text,
      mode: "model",
      gatewayDebug: {
        payloadToModel,
        desensitized: true,
        provider: resolved.provider,
        model: resolved.model,
        durationMs: Date.now() - start,
      },
    };
  } catch (err) {
    console.warn(`[ModelGateway] ${resolved.provider} 调用失败，降级到兜底模板：`, err);
    return {
      reportText: buildFallbackReport(input),
      mode: "fallback",
      gatewayDebug: {
        payloadToModel,
        desensitized: true,
        provider: "fallback_template",
        model: `${resolved.provider}_failed`,
        durationMs: Date.now() - start,
      },
    };
  }
}
