#!/usr/bin/env tsx
/**
 * V2 本地向量记忆系统 - 独立测试
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

interface MemoryDoc {
  id: string;
  content: string;
  source: string;
  chunk: number;
  timestamp: number;
}

class LocalMemory {
  private memoryDir: string;
  private indexFile: string;
  private docs: Map<string, MemoryDoc> = new Map();

  constructor() {
    this.memoryDir = path.join(process.cwd(), "memory");
    this.indexFile = path.join(this.memoryDir, ".index.json");
    this.load();
  }

  // Jaccard 相似度 - 对中文更友好
  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase());
    const setB = new Set(b.toLowerCase());
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  private load() {
    if (fs.existsSync(this.indexFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.indexFile, "utf-8"));
        for (const doc of data.docs || []) this.docs.set(doc.id, doc);
      } catch (e) {
        console.log("索引文件损坏，重新创建");
      }
    }
  }

  private save() {
    if (!fs.existsSync(this.memoryDir)) fs.mkdirSync(this.memoryDir, { recursive: true });
    fs.writeFileSync(this.indexFile, JSON.stringify({ docs: Array.from(this.docs.values()) }, null, 2));
  }

  ingestFile(filePath: string): string {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return `错误: 文件不存在 ${filePath}`;

    const content = fs.readFileSync(fullPath, "utf-8");
    const chunks = content.split(/\n\n+/).filter(c => c.trim());
    let added = 0;

    for (let i = 0; i < chunks.length; i++) {
      const id = createHash("md5").update(`${fullPath}:${i}:${chunks[i]}`).digest("hex");
      if (!this.docs.has(id)) {
        this.docs.set(id, {
          id, content: chunks[i],
          source: path.relative(process.cwd(), fullPath),
          chunk: i, timestamp: Date.now()
        });
        added++;
      }
    }
    this.save();
    return `已摄入: ${filePath} (${added} 新块)`;
  }

  search(query: string, maxResults = 5): string {
    if (this.docs.size === 0) return "记忆库为空";

    const results = Array.from(this.docs.values())
      .map(doc => ({ doc, score: this.jaccardSimilarity(query, doc.content) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .filter(r => r.score > 0.01);

    if (results.length === 0) return "未找到相关记忆";

    return results
      .map(({ doc, score }) => `[${doc.source}:${doc.chunk}] (相似度: ${(score * 100).toFixed(1)}%)\n${doc.content.slice(0, 150)}`)
      .join("\n---\n");
  }

  stats(): string { return `记忆库: ${this.docs.size} 个片段`; }
}

// 测试
const memory = new LocalMemory();
console.log("=== V2 本地向量记忆系统测试 ===\n");
console.log("📊", memory.stats());

// 摄入
console.log("\n📥", memory.ingestFile("./memory/project.md"));
console.log("📊", memory.stats());

// 搜索测试
console.log("\n🔍 搜索 '数据库':");
console.log(memory.search("数据库"));

console.log("\n🔍 搜索 'React':");
console.log(memory.search("React"));

console.log("\n🔍 搜索 '命名规范':");
console.log(memory.search("命名规范"));

console.log("\n🔍 搜索 '缓存 Redis':");
console.log(memory.search("缓存 Redis"));
