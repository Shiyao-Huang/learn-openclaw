/**
 * V27: 向量嵌入增强 - 提供者实现
 * 
 * 支持:
 * - OpenAI Embeddings API
 * - 本地 Jaccard 相似度 (继承 V2)
 * - 自动选择和 fallback
 */

import type {
  EmbeddingProvider,
  EmbeddingProviderType,
  ProviderStats,
} from "./types.js";

// ============================================================================
// OpenAI Embeddings 提供者
// ============================================================================

export interface OpenAIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai";
  readonly name = "OpenAI Embeddings";
  readonly type: EmbeddingProviderType = "openai";
  
  private apiKey: string;
  private baseUrl: string;
  private stats: ProviderStats = {
    requestCount: 0,
    tokenCount: 0,
  };

  constructor(config: OpenAIConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api.openai.com/v1";
  }

  get model(): string {
    return "text-embedding-3-small";
  }

  get dimensions(): number {
    return 1536;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      // 尝试从环境变量获取
      this.apiKey = process.env.OPENAI_API_KEY || "";
    }
    return !!this.apiKey;
  }

  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embedBatch([text]);
    return vectors[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[]; index: number }>;
        usage: { total_tokens: number };
      };

      // 更新统计
      this.stats.requestCount++;
      this.stats.tokenCount += data.usage.total_tokens;
      this.stats.lastRequest = new Date();
      this.stats.avgLatency = 
        (this.stats.avgLatency || 0) + (Date.now() - startTime) / 2;

      // 按索引排序返回
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map(item => item.embedding);
    } catch (error) {
      throw new Error(`Failed to get embeddings from OpenAI: ${error}`);
    }
  }

  async getStats(): Promise<ProviderStats> {
    return { ...this.stats };
  }
}

// ============================================================================
// 本地向量提供者 (基于 Jaccard 相似度)
// ============================================================================

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = "local";
  readonly name = "Local (Jaccard)";
  readonly type: EmbeddingProviderType = "local";
  
  private stats: ProviderStats = {
    requestCount: 0,
    tokenCount: 0,
  };

  get model(): string {
    return "jaccard-v1";
  }

  get dimensions(): number {
    return 0; // Jaccard 不产生向量，只用于相似度计算
  }

  async isAvailable(): Promise<boolean> {
    return true; // 本地提供者始终可用
  }

  /**
   * 将文本转换为 token 集合
   * 注意: 这个方法不产生真正的向量，而是返回一个"虚拟向量"
   * 用于兼容接口。实际相似度计算应该使用 jaccardSimilarity
   */
  async embedQuery(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);
    // 返回 token hash 作为"虚拟向量"
    // 这不是一个真正的嵌入向量，但可以用于一致性
    return this.tokensToHashVector(tokens);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    this.stats.requestCount++;
    this.stats.tokenCount += texts.reduce((sum, t) => sum + t.length, 0);
    this.stats.lastRequest = new Date();
    
    return Promise.all(texts.map(text => this.embedQuery(text)));
  }

  /**
   * 计算 Jaccard 相似度
   */
  jaccardSimilarity(tokens1: Set<string>, tokens2: Set<string>): number {
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * 文本分词 (简单实现)
   */
  tokenize(text: string): Set<string> {
    // 中文分词: 按字符
    // 英文分词: 按空格
    const tokens = new Set<string>();
    
    // 移除标点符号，转小写
    const cleaned = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
    
    // 分词
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    
    for (const word of words) {
      if (/[\u4e00-\u9fa5]/.test(word)) {
        // 中文: 按字符分割
        for (const char of word) {
          tokens.add(char);
        }
      } else {
        // 英文: 整个单词
        tokens.add(word);
      }
    }
    
    return tokens;
  }

  /**
   * 将 token 集合转换为 hash 向量 (用于存储一致性)
   */
  private tokensToHashVector(tokens: Set<string>): number[] {
    // 创建一个简单的 hash 向量 (128 维)
    const vector = new Array(128).fill(0);
    
    for (const token of tokens) {
      // 简单的 hash 函数
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        const char = token.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      // 将 hash 映射到向量位置
      const pos = Math.abs(hash) % 128;
      vector[pos] = 1;
    }
    
    return vector;
  }

  async getStats(): Promise<ProviderStats> {
    return { ...this.stats };
  }
}

// ============================================================================
// 提供者工厂
// ============================================================================

export interface CreateProviderOptions {
  type: EmbeddingProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fallback?: EmbeddingProviderType;
}

export async function createEmbeddingProvider(
  options: CreateProviderOptions
): Promise<EmbeddingProvider> {
  const { type, fallback } = options;

  // 自动选择
  if (type === "auto") {
    // 优先尝试 OpenAI
    const openai = new OpenAIEmbeddingProvider({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
    });
    
    if (await openai.isAvailable()) {
      return openai;
    }
    
    // 降级到本地
    console.log("[Embedding] OpenAI not available, falling back to local (Jaccard)");
    return new LocalEmbeddingProvider();
  }

  // 指定 OpenAI
  if (type === "openai") {
    const openai = new OpenAIEmbeddingProvider({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
    });
    
    if (!await openai.isAvailable()) {
      if (fallback === "local") {
        console.log("[Embedding] OpenAI not available, using local fallback");
        return new LocalEmbeddingProvider();
      }
      throw new Error("OpenAI API key not configured and no fallback specified");
    }
    
    return openai;
  }

  // 指定本地
  if (type === "local") {
    return new LocalEmbeddingProvider();
  }

  throw new Error(`Unknown embedding provider type: ${type}`);
}
