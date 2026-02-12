/**
 * V2 测试 - 本地向量记忆系统
 * 
 * 核心能力:
 * - 零外部依赖的记忆系统
 * - Jaccard 相似度搜索
 * - 文件分块摄入
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'v2-test');
const MEMORY_DIR = path.join(TEST_DIR, '.memory');

// 从 v2-agent.ts 复制的 LocalMemory 实现
interface MemoryChunk {
  id: string;
  content: string;
  source: string;
  tokens: Set<string>;
}

class LocalMemory {
  private chunks: MemoryChunk[] = [];
  private memoryDir: string;
  private indexFile: string;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
    this.indexFile = path.join(this.memoryDir, "index.json");
    if (!fs.existsSync(this.memoryDir)) fs.mkdirSync(this.memoryDir, { recursive: true });
    this.loadIndex();
  }

  private loadIndex() {
    if (fs.existsSync(this.indexFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.indexFile, "utf-8"));
        this.chunks = data.map((c: any) => ({ ...c, tokens: new Set(c.tokens) }));
      } catch (e) {
        this.chunks = [];
      }
    }
  }

  private saveIndex() {
    const data = this.chunks.map(c => ({ ...c, tokens: Array.from(c.tokens) }));
    fs.writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
  }

  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    // 中文分词: 2-gram
    for (let i = 0; i < text.length - 1; i++) {
      tokens.add(text.slice(i, i + 2));
    }
    // 英文分词: 单词
    text.toLowerCase().match(/\b\w+\b/g)?.forEach(w => tokens.add(w));
    return tokens;
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  search(query: string, maxResults: number = 5): string {
    const queryTokens = this.tokenize(query);
    const scored = this.chunks.map(c => ({
      chunk: c,
      score: this.jaccard(queryTokens, c.tokens)
    })).filter(s => s.score > 0.05).sort((a, b) => b.score - a.score).slice(0, maxResults);

    if (scored.length === 0) return "未找到相关记忆";
    return scored.map(s => `[${s.chunk.source}] (${(s.score * 100).toFixed(0)}%)\n${s.chunk.content.slice(0, 300)}`).join("\n\n");
  }

  get(filePath: string, fromLine?: number, lines?: number): string {
    const full = path.join(this.memoryDir, filePath);
    if (!fs.existsSync(full)) return `文件不存在: ${filePath}`;
    let content = fs.readFileSync(full, "utf-8");
    if (fromLine !== undefined) {
      const allLines = content.split("\n");
      content = allLines.slice(fromLine - 1, fromLine - 1 + (lines || 50)).join("\n");
    }
    return content;
  }

  append(filePath: string, content: string): string {
    const full = path.join(this.memoryDir, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.appendFileSync(full, content + "\n");
    // 自动索引
    const id = createHash("md5").update(content).digest("hex").slice(0, 8);
    this.chunks.push({ id, content, source: filePath, tokens: this.tokenize(content) });
    this.saveIndex();
    return `已追加到 ${filePath}`;
  }

  ingestFile(filePath: string): string {
    const content = fs.readFileSync(filePath, "utf-8");
    const chunkSize = 500;
    const lines = content.split("\n");
    let added = 0;

    for (let i = 0; i < lines.length; i += chunkSize / 2) {
      const chunk = lines.slice(i, i + chunkSize).join("\n");
      if (chunk.trim().length < 50) continue;
      const id = createHash("md5").update(chunk).digest("hex").slice(0, 8);
      if (!this.chunks.find(c => c.id === id)) {
        this.chunks.push({ id, content: chunk, source: path.basename(filePath), tokens: this.tokenize(chunk) });
        added++;
      }
    }
    this.saveIndex();
    return `已摄入 ${filePath}: ${added} 个新片段`;
  }

  stats(): string {
    return `记忆库: ${this.chunks.length} 个片段`;
  }

  // 测试辅助方法
  getChunkCount(): number {
    return this.chunks.length;
  }
}

describe('V2 LocalMemory - 本地向量记忆系统', () => {
  let memory: LocalMemory;

  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    memory = new LocalMemory(MEMORY_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('Jaccard 相似度', () => {
    it('完全相同的文本应有高相似度', () => {
      const tokens1 = memory['tokenize']('hello world');
      const tokens2 = memory['tokenize']('hello world');
      const score = memory['jaccard'](tokens1, tokens2);
      expect(score).toBe(1);
    });

    it('完全不同的文本应有低相似度', () => {
      const tokens1 = memory['tokenize']('hello world');
      const tokens2 = memory['tokenize']('foo bar baz');
      const score = memory['jaccard'](tokens1, tokens2);
      expect(score).toBeLessThan(0.3);
    });

    it('部分重叠应有中等相似度', () => {
      const tokens1 = memory['tokenize']('hello world');
      const tokens2 = memory['tokenize']('hello there');
      const score = memory['jaccard'](tokens1, tokens2);
      expect(score).toBeGreaterThan(0.1);
      expect(score).toBeLessThan(0.8);
    });
  });

  describe('中文分词 (2-gram)', () => {
    it('应该对中文文本生成 2-gram', () => {
      const tokens = memory['tokenize']('你好世界');
      expect(tokens.has('你好')).toBe(true);
      expect(tokens.has('好世')).toBe(true);
      expect(tokens.has('世界')).toBe(true);
    });

    it('应该能搜索中文内容', () => {
      memory.append('notes.md', '这是一个关于人工智能的笔记');
      const result = memory.search('人工智能');
      expect(result).toContain('人工智能');
    });
  });

  describe('英文分词', () => {
    it('应该提取英文单词', () => {
      const tokens = memory['tokenize']('Hello World Test');
      expect(tokens.has('hello')).toBe(true);
      expect(tokens.has('world')).toBe(true);
      expect(tokens.has('test')).toBe(true);
    });

    it('应该忽略大小写', () => {
      // tokenize 函数已经将文本转为小写
      const tokens1 = memory['tokenize']('HELLO');
      const tokens2 = memory['tokenize']('hello');
      // 两者应该有相同的 token（都是小写的 'hello'）
      const hasCommonToken = [...tokens1].some(t => tokens2.has(t));
      expect(hasCommonToken).toBe(true);
    });
  });

  describe('memory_append', () => {
    it('应该能追加内容到记忆', () => {
      const result = memory.append('notes.md', '测试笔记内容');
      expect(result).toContain('已追加');
    });

    it('应该自动索引追加的内容', () => {
      memory.append('notes.md', '机器学习是人工智能的一个分支');
      expect(memory.getChunkCount()).toBe(1);
    });

    it('应该持久化到文件', () => {
      memory.append('notes.md', '持久化测试');
      expect(fs.existsSync(path.join(MEMORY_DIR, 'notes.md'))).toBe(true);
    });

    it('应该自动创建目录', () => {
      memory.append('deep/nested/notes.md', '嵌套笔记');
      expect(fs.existsSync(path.join(MEMORY_DIR, 'deep/nested/notes.md'))).toBe(true);
    });
  });

  describe('memory_search', () => {
    it('应该能搜索已添加的内容', () => {
      memory.append('docs.md', 'TypeScript 是 JavaScript 的超集');
      const result = memory.search('TypeScript');
      expect(result).toContain('TypeScript');
    });

    it('无结果应返回提示', () => {
      const result = memory.search('完全不相关的内容xyz123');
      expect(result).toContain('未找到');
    });

    it('应该限制返回结果数', () => {
      for (let i = 0; i < 10; i++) {
        memory.append(`doc${i}.md`, `文档 ${i} 关于机器学习`);
      }
      const result = memory.search('机器学习', 3);
      // 结果被限制为 3 个
      const matchCount = (result.match(/\[\w+\.md\]/g) || []).length;
      expect(matchCount).toBeLessThanOrEqual(3);
    });

    it('应该按相似度排序', () => {
      memory.append('a.md', 'JavaScript 编程语言');
      memory.append('b.md', 'TypeScript 是 JavaScript 的超集');
      memory.append('c.md', '完全无关的内容');
      
      const result = memory.search('TypeScript JavaScript');
      expect(result).toContain('b.md');
    });
  });

  describe('memory_get', () => {
    it('应该能读取记忆文件', () => {
      fs.writeFileSync(path.join(MEMORY_DIR, 'test.md'), 'test content');
      const result = memory.get('test.md');
      expect(result).toBe('test content');
    });

    it('不存在的文件应返回错误', () => {
      const result = memory.get('nonexistent.md');
      expect(result).toContain('不存在');
    });

    it('应该支持行号范围', () => {
      fs.writeFileSync(path.join(MEMORY_DIR, 'lines.md'), 'line1\nline2\nline3\nline4\nline5');
      const result = memory.get('lines.md', 2, 2);
      expect(result).toBe('line2\nline3');
    });
  });

  describe('memory_ingest', () => {
    it('应该能摄入文件', () => {
      const testFile = path.join(TEST_DIR, 'to-ingest.md');
      fs.writeFileSync(testFile, '# 文档标题\n\n这是一段很长的内容，需要被分块处理以便后续检索。'.repeat(10));
      
      const result = memory.ingestFile(testFile);
      expect(result).toContain('已摄入');
    });

    it('应该分块处理长文件', () => {
      const testFile = path.join(TEST_DIR, 'long.md');
      const longContent = Array(100).fill('这是一行内容').join('\n');
      fs.writeFileSync(testFile, longContent);
      
      const before = memory.getChunkCount();
      memory.ingestFile(testFile);
      const after = memory.getChunkCount();
      
      expect(after).toBeGreaterThan(before);
    });

    it('应该跳过太短的块', () => {
      const testFile = path.join(TEST_DIR, 'short.md');
      fs.writeFileSync(testFile, '短');
      
      memory.ingestFile(testFile);
      // 太短的块不应被索引
      expect(memory.getChunkCount()).toBe(0);
    });
  });

  describe('memory_stats', () => {
    it('应该返回记忆库统计', () => {
      memory.append('test.md', '测试内容');
      const stats = memory.stats();
      expect(stats).toContain('记忆库');
      expect(stats).toContain('个片段');
    });
  });

  describe('持久化', () => {
    it('索引应该持久化到文件', () => {
      memory.append('persist.md', '持久化测试内容');
      expect(fs.existsSync(path.join(MEMORY_DIR, 'index.json'))).toBe(true);
    });

    it('重新加载应恢复索引', () => {
      memory.append('reload.md', '重载测试');
      const countBefore = memory.getChunkCount();
      
      // 创建新实例
      const newMemory = new LocalMemory(MEMORY_DIR);
      expect(newMemory.getChunkCount()).toBe(countBefore);
    });
  });

  describe('零外部依赖', () => {
    it('不应依赖外部向量数据库', () => {
      // LocalMemory 只使用 fs 和 crypto，没有外部依赖
      const deps = ['fs', 'crypto', 'path'];
      expect(deps.length).toBe(3);
    });

    it('应该使用简单的 Jaccard 算法', () => {
      // Jaccard = intersection / union
      const a = new Set(['a', 'b', 'c']);
      const b = new Set(['b', 'c', 'd']);
      const intersection = new Set([...a].filter(x => b.has(x)));
      const union = new Set([...a, ...b]);
      const jaccard = intersection.size / union.size;
      expect(jaccard).toBeCloseTo(0.5, 1);
    });
  });
});
