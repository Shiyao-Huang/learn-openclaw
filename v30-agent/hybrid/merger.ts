/**
 * V30: 混合搜索系统 - 结果合并器
 * 
 * 合并向量搜索和关键词搜索的结果
 */

import type { HybridSearchResult, HybridSearchOptions } from "./types.js";

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  id: string;
  path: string;
  snippet: string;
  score: number;
  startLine: number;
  endLine: number;
  source: string;
}

/**
 * 关键词搜索结果
 */
export interface KeywordSearchResult {
  id: string;
  path: string;
  snippet: string;
  score: number;
  startLine: number;
  endLine: number;
  source: string;
}

/**
 * 混合搜索合并参数
 */
export interface MergeParams {
  vectorResults: VectorSearchResult[];
  keywordResults: KeywordSearchResult[];
  vectorWeight: number;
  keywordWeight: number;
}

/**
 * 合并向量和关键词搜索结果
 */
export function mergeHybridResults(params: MergeParams): HybridSearchResult[] {
  const { vectorResults, keywordResults, vectorWeight, keywordWeight } = params;

  // 使用 Map 合并结果
  const mergedMap = new Map<
    string,
    {
      id: string;
      path: string;
      snippet: string;
      vectorScore: number;
      keywordScore: number;
      startLine: number;
      endLine: number;
      source: string;
      matchedBy: ("vector" | "keyword")[];
    }
  >();

  // 添加向量搜索结果
  for (const result of vectorResults) {
    mergedMap.set(result.id, {
      id: result.id,
      path: result.path,
      snippet: result.snippet,
      vectorScore: result.score,
      keywordScore: 0,
      startLine: result.startLine,
      endLine: result.endLine,
      source: result.source,
      matchedBy: ["vector"],
    });
  }

  // 添加/更新关键词搜索结果
  for (const result of keywordResults) {
    const existing = mergedMap.get(result.id);
    if (existing) {
      // 合并
      existing.keywordScore = result.score;
      existing.matchedBy.push("keyword");
      // 使用更长的片段
      if (result.snippet.length > existing.snippet.length) {
        existing.snippet = result.snippet;
      }
    } else {
      // 新增
      mergedMap.set(result.id, {
        id: result.id,
        path: result.path,
        snippet: result.snippet,
        vectorScore: 0,
        keywordScore: result.score,
        startLine: result.startLine,
        endLine: result.endLine,
        source: result.source,
        matchedBy: ["keyword"],
      });
    }
  }

  // 计算混合分数并排序
  const results: HybridSearchResult[] = [];

  for (const entry of mergedMap.values()) {
    // 归一化分数计算
    const hybridScore =
      vectorWeight * entry.vectorScore + keywordWeight * entry.keywordScore;

    results.push({
      id: entry.id,
      path: entry.path,
      snippet: entry.snippet,
      vectorScore: entry.vectorScore,
      keywordScore: entry.keywordScore,
      hybridScore,
      startLine: entry.startLine,
      endLine: entry.endLine,
      source: entry.source,
      matchedBy: entry.matchedBy,
    });
  }

  // 按混合分数降序排序
  results.sort((a, b) => b.hybridScore - a.hybridScore);

  return results;
}

/**
 * 归一化分数 (Min-Max 归一化)
 */
export function normalizeScores(
  results: { score: number }[],
  minScore = 0,
  maxScore = 1
): void {
  if (results.length === 0) return;

  const scores = results.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  for (const result of results) {
    result.score = minScore + ((result.score - min) / range) * (maxScore - minScore);
  }
}

/**
 * 计算查询词的多样性分数
 * 用于动态调整权重
 */
export function calculateQueryDiversity(query: string): {
  technicalTerms: number;
  naturalLanguage: number;
  specificity: number;
} {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  // 技术术语特征 (代码、变量名、文件路径等)
  const technicalPatterns = [
    /[a-z]+[A-Z][a-z]*/, // camelCase
    /[a-z]+_[a-z]+/, // snake_case
    /[a-z]+-[a-z]+/, // kebab-case
    /\.[a-z]+/, // 文件扩展名
    /\/[a-z]+/, // 路径
    /[a-z]+\(\)/, // 函数调用
    /\$\{/, // 模板字符串
  ];

  let technicalCount = 0;
  for (const token of tokens) {
    if (technicalPatterns.some((p) => p.test(token))) {
      technicalCount++;
    }
  }

  // 自然语言特征 (疑问词、介词等)
  const naturalPatterns = [
    /^(what|how|why|when|where|who|which)$/i,
    /^(is|are|was|were|do|does|did|can|could|should|would)$/i,
    /^(the|a|an|this|that|these|those)$/i,
    /^(of|to|in|for|on|with|at|by|from)$/i,
  ];

  let naturalCount = 0;
  for (const token of tokens) {
    if (naturalPatterns.some((p) => p.test(token))) {
      naturalCount++;
    }
  }

  // 特异性 (查询长度和独特词汇)
  const uniqueTokens = new Set(tokens);
  const specificity = Math.min(1, (uniqueTokens.size / 5) * (tokens.length / 3));

  return {
    technicalTerms: tokens.length > 0 ? technicalCount / tokens.length : 0,
    naturalLanguage: tokens.length > 0 ? naturalCount / tokens.length : 0,
    specificity: Math.min(1, specificity),
  };
}

/**
 * 根据查询特征动态调整权重
 */
export function adjustWeights(query: string): {
  vectorWeight: number;
  keywordWeight: number;
} {
  const diversity = calculateQueryDiversity(query);

  // 技术术语多 → 提高关键词权重
  // 自然语言多 → 提高向量权重
  const technicalAdjustment = diversity.technicalTerms * 0.2;
  const naturalAdjustment = diversity.naturalLanguage * 0.1;

  let vectorWeight = 0.7 - technicalAdjustment + naturalAdjustment;
  let keywordWeight = 0.3 + technicalAdjustment - naturalAdjustment;

  // 确保权重在合理范围内
  vectorWeight = Math.max(0.3, Math.min(0.9, vectorWeight));
  keywordWeight = Math.max(0.1, Math.min(0.7, keywordWeight));

  // 归一化
  const total = vectorWeight + keywordWeight;
  vectorWeight /= total;
  keywordWeight /= total;

  return { vectorWeight, keywordWeight };
}

/**
 * 计算结果多样性
 */
export function calculateResultDiversity(results: HybridSearchResult[]): number {
  if (results.length <= 1) return 0;

  const sources = new Set(results.map((r) => r.source));
  const paths = new Set(results.map((r) => r.path));

  // 基于来源和路径的多样性
  const sourceDiversity = sources.size / results.length;
  const pathDiversity = paths.size / results.length;

  return (sourceDiversity + pathDiversity) / 2;
}

/**
 * 重排序结果 (基于多样性和相关性)
 */
export function rerankResults(
  results: HybridSearchResult[],
  options: { diversityBoost?: number } = {}
): HybridSearchResult[] {
  if (results.length <= 1) return results;

  const diversityBoost = options.diversityBoost ?? 0.1;
  const selected: HybridSearchResult[] = [];
  const remaining = [...results];

  while (remaining.length > 0 && selected.length < results.length) {
    // 找到最佳候选
    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let score = candidate.hybridScore;

      // 如果与已选择的结果来源不同，给予多样性加成
      if (selected.length > 0) {
        const selectedSources = new Set(selected.map((s) => s.source));
        if (!selectedSources.has(candidate.source)) {
          score += diversityBoost;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}
