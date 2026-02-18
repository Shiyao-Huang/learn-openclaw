/**
 * V38: 命令执行审批引擎
 * 
 * 基于 OpenClaw infra/exec-approvals.ts
 * 
 * 功能:
 * - 命令解析 (支持 &&, ||, ;, |)
 * - 白名单管理
 * - 安全策略配置
 * - 命令执行审批
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ============================================================================
// Types
// ============================================================================

export type ExecHost = "sandbox" | "gateway" | "node";
export type ExecSecurity = "deny" | "allowlist" | "full";
export type ExecAsk = "off" | "on-miss" | "always";

export type ApprovalPolicy = {
  security: ExecSecurity;
  ask: ExecAsk;
  askFallback: ExecSecurity;
  autoAllowSkills: boolean;
};

export type AllowlistEntry = {
  id?: string;
  pattern: string;
  description?: string;
  createdAt?: number;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
  useCount?: number;
};

export type ApprovalConfig = {
  configFile: string;
  defaults: ApprovalPolicy;
  allowlist: AllowlistEntry[];
  safeBins: string[];
};

export type CommandSegment = {
  raw: string;
  argv: string[];
  executable: string;
  resolvedPath?: string;
  isPathBased: boolean;
};

export type CommandAnalysis = {
  ok: boolean;
  reason?: string;
  segments: CommandSegment[];
  chains?: CommandSegment[][];
};

export type ApprovalDecision = "allow-once" | "allow-always" | "deny";

export type ApprovalResult = {
  allowed: boolean;
  reason: string;
  matchedEntries: AllowlistEntry[];
  analysis: CommandAnalysis;
  decision?: ApprovalDecision;
};

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  security: "deny",
  ask: "on-miss",
  askFallback: "deny",
  autoAllowSkills: false,
};

export const DEFAULT_SAFE_BINS = [
  "jq", "grep", "cut", "sort", "uniq", "head", "tail",
  "tr", "wc", "cat", "echo", "ls", "pwd", "date",
  "which", "whoami", "id", "uname", "hostname",
];

const DEFAULT_CONFIG_FILE = "~/.openclaw/approvals.json";

// ============================================================================
// Utilities
// ============================================================================

function expandHome(value: string): string {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function isExecutable(filePath: string): boolean {
  try {
    if (process.platform !== "win32") {
      fs.accessSync(filePath, fs.constants.X_OK);
    }
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function resolveExecutablePath(
  rawExecutable: string,
  cwd?: string,
  env?: NodeJS.ProcessEnv
): string | undefined {
  const expanded = rawExecutable.startsWith("~") 
    ? expandHome(rawExecutable) 
    : rawExecutable;
    
  if (expanded.includes("/") || expanded.includes("\\")) {
    if (path.isAbsolute(expanded)) {
      return isExecutable(expanded) ? expanded : undefined;
    }
    const base = cwd?.trim() || process.cwd();
    const candidate = path.resolve(base, expanded);
    return isExecutable(candidate) ? candidate : undefined;
  }
  
  // Search in PATH
  const envPath = env?.PATH ?? env?.Path ?? process.env.PATH ?? process.env.Path ?? "";
  const entries = envPath.split(path.delimiter).filter(Boolean);
  
  const extensions = process.platform === "win32"
    ? (env?.PATHEXT ?? process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
        .split(";")
        .map(ext => ext.toLowerCase())
    : [""];
    
  for (const entry of entries) {
    for (const ext of extensions) {
      const candidate = path.join(entry, expanded + ext);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }
  
  return undefined;
}

// ============================================================================
// Command Parsing
// ============================================================================

const DISALLOWED_TOKENS = new Set([">", "<", "`", "\n", "\r", "(", ")"]);
const DOUBLE_QUOTE_ESCAPES = new Set(["\\", '"', "$", "`", "\n", "\r"]);

type IteratorAction = "split" | "skip" | "include" | { reject: string };

function iterateQuoteAware(
  command: string,
  onChar: (ch: string, next: string | undefined, index: number) => IteratorAction
): { ok: true; parts: string[]; hasSplit: boolean } | { ok: false; reason: string } {
  const parts: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let hasSplit = false;

  const pushPart = () => {
    const trimmed = buf.trim();
    if (trimmed) parts.push(trimmed);
    buf = "";
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    const next = command[i + 1];

    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }

    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      buf += ch;
      continue;
    }

    if (inSingle) {
      if (ch === "'") inSingle = false;
      buf += ch;
      continue;
    }

    if (inDouble) {
      if (ch === "\\" && DOUBLE_QUOTE_ESCAPES.has(next ?? "")) {
        buf += ch + next;
        i++;
        continue;
      }
      if (ch === "$" && next === "(") {
        return { ok: false, reason: "unsupported shell token: $()" };
      }
      if (ch === "`") {
        return { ok: false, reason: "unsupported shell token: `" };
      }
      if (ch === "\n" || ch === "\r") {
        return { ok: false, reason: "unsupported shell token: newline" };
      }
      if (ch === '"') inDouble = false;
      buf += ch;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      buf += ch;
      continue;
    }

    const action = onChar(ch, next, i);
    if (typeof action === "object" && "reject" in action) {
      return { ok: false, reason: action.reject };
    }
    if (action === "split") {
      pushPart();
      hasSplit = true;
      continue;
    }
    if (action === "skip") continue;
    buf += ch;
  }

  if (escaped || inSingle || inDouble) {
    return { ok: false, reason: "unterminated shell quote/escape" };
  }

  pushPart();
  return { ok: true, parts, hasSplit };
}

function splitByPipeline(command: string): { ok: boolean; reason?: string; segments: string[] } {
  let emptySegment = false;
  const result = iterateQuoteAware(command, (ch, next) => {
    if (ch === "|" && next === "|") {
      return { reject: "unsupported shell token: ||" };
    }
    if (ch === "|" && next === "&") {
      return { reject: "unsupported shell token: |&" };
    }
    if (ch === "|") {
      emptySegment = true;
      return "split";
    }
    if (ch === "&" || ch === ";") {
      return { reject: `unsupported shell token: ${ch}` };
    }
    if (DISALLOWED_TOKENS.has(ch)) {
      return { reject: `unsupported shell token: ${ch}` };
    }
    if (ch === "$" && next === "(") {
      return { reject: "unsupported shell token: $()" };
    }
    emptySegment = false;
    return "include";
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, segments: [] };
  }
  if (emptySegment || result.parts.length === 0) {
    return {
      ok: false,
      reason: result.parts.length === 0 ? "empty command" : "empty pipeline segment",
      segments: [],
    };
  }
  return { ok: true, segments: result.parts };
}

function splitByChain(command: string): string[] | null {
  const parts: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let foundChain = false;

  const pushPart = () => {
    const trimmed = buf.trim();
    if (trimmed) {
      parts.push(trimmed);
      buf = "";
      return true;
    }
    buf = "";
    return false;
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    const next = command[i + 1];

    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }

    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      buf += ch;
      continue;
    }

    if (inSingle) {
      if (ch === "'") inSingle = false;
      buf += ch;
      continue;
    }

    if (inDouble) {
      if (ch === "\\" && DOUBLE_QUOTE_ESCAPES.has(next ?? "")) {
        buf += ch + next;
        i++;
        continue;
      }
      if (ch === '"') inDouble = false;
      buf += ch;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      buf += ch;
      continue;
    }

    if (ch === "&" && next === "&") {
      if (!pushPart()) return null;
      i++;
      foundChain = true;
      continue;
    }

    if (ch === "|" && next === "|") {
      if (!pushPart()) return null;
      i++;
      foundChain = true;
      continue;
    }

    if (ch === ";") {
      if (!pushPart()) return null;
      foundChain = true;
      continue;
    }

    buf += ch;
  }

  pushPart();
  return foundChain && parts.length > 0 ? parts : null;
}

function tokenizeSegment(segment: string): string[] | null {
  const tokens: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  const pushToken = () => {
    if (buf.length > 0) {
      tokens.push(buf);
      buf = "";
    }
  };

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    const next = segment[i + 1];

    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }

    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      continue;
    }

    if (inSingle) {
      if (ch === "'") inSingle = false;
      else buf += ch;
      continue;
    }

    if (inDouble) {
      if (ch === "\\" && DOUBLE_QUOTE_ESCAPES.has(next ?? "")) {
        buf += next;
        i++;
        continue;
      }
      if (ch === '"') inDouble = false;
      else buf += ch;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (/\s/.test(ch)) {
      pushToken();
      continue;
    }

    buf += ch;
  }

  if (escaped || inSingle || inDouble) return null;
  pushToken();
  return tokens.length > 0 ? tokens : null;
}

function parseSegment(
  raw: string,
  cwd?: string,
  env?: NodeJS.ProcessEnv
): CommandSegment | null {
  const argv = tokenizeSegment(raw);
  if (!argv || argv.length === 0) return null;

  const executable = argv[0] ?? "";
  const resolvedPath = resolveExecutablePath(executable, cwd, env);
  const isPathBased = executable.includes("/") || executable.includes("\\");

  return {
    raw,
    argv,
    executable,
    resolvedPath,
    isPathBased,
  };
}

// ============================================================================
// Pattern Matching
// ============================================================================

function normalizePath(value: string): string {
  if (process.platform === "win32") {
    return value.replace(/^\\\\[?.]\\/, "").replace(/\\/g, "/").toLowerCase();
  }
  return value.replace(/\\/g, "/").toLowerCase();
}

function globToRegExp(pattern: string): RegExp {
  let regex = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      const next = pattern[i + 1];
      if (next === "*") {
        regex += ".*";
        i += 2;
        continue;
      }
      regex += "[^/]*";
      i++;
      continue;
    }
    if (ch === "?") {
      regex += ".";
      i++;
      continue;
    }
    regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    i++;
  }
  regex += "$";
  return new RegExp(regex, "i");
}

function matchesPattern(pattern: string, target: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;

  const expanded = trimmed.startsWith("~") ? expandHome(trimmed) : trimmed;
  const normalizedPattern = normalizePath(expanded);
  const normalizedTarget = normalizePath(target);

  const regex = globToRegExp(normalizedPattern);
  return regex.test(normalizedTarget);
}

// ============================================================================
// Approval Engine
// ============================================================================

export class ApprovalEngine {
  private config: ApprovalConfig;
  private configFile: string;

  constructor(config?: Partial<ApprovalConfig>) {
    this.configFile = expandHome(config?.configFile ?? DEFAULT_CONFIG_FILE);
    this.config = this.loadConfig(config);
  }

  private loadConfig(overrides?: Partial<ApprovalConfig>): ApprovalConfig {
    let loaded: Partial<ApprovalConfig> = {};

    try {
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, "utf-8");
        loaded = JSON.parse(raw);
      }
    } catch {
      // ignore
    }

    return {
      configFile: this.configFile,
      defaults: {
        security: overrides?.defaults?.security ?? loaded.defaults?.security ?? DEFAULT_APPROVAL_POLICY.security,
        ask: overrides?.defaults?.ask ?? loaded.defaults?.ask ?? DEFAULT_APPROVAL_POLICY.ask,
        askFallback: overrides?.defaults?.askFallback ?? loaded.defaults?.askFallback ?? DEFAULT_APPROVAL_POLICY.askFallback,
        autoAllowSkills: overrides?.defaults?.autoAllowSkills ?? loaded.defaults?.autoAllowSkills ?? DEFAULT_APPROVAL_POLICY.autoAllowSkills,
      },
      allowlist: this.normalizeAllowlist(overrides?.allowlist ?? loaded.allowlist ?? []),
      safeBins: overrides?.safeBins ?? loaded.safeBins ?? DEFAULT_SAFE_BINS,
    };
  }

  private normalizeAllowlist(entries: unknown[]): AllowlistEntry[] {
    const result: AllowlistEntry[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          result.push({
            id: crypto.randomUUID(),
            pattern: trimmed,
            createdAt: Date.now(),
          });
        }
      } else if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const pattern = typeof obj.pattern === "string" ? obj.pattern.trim() : "";
        if (pattern && !seen.has(pattern.toLowerCase())) {
          seen.add(pattern.toLowerCase());
          result.push({
            id: (typeof obj.id === "string" ? obj.id : undefined) ?? crypto.randomUUID(),
            pattern,
            description: typeof obj.description === "string" ? obj.description : undefined,
            createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
            lastUsedAt: typeof obj.lastUsedAt === "number" ? obj.lastUsedAt : undefined,
            lastUsedCommand: typeof obj.lastUsedCommand === "string" ? obj.lastUsedCommand : undefined,
            lastResolvedPath: typeof obj.lastResolvedPath === "string" ? obj.lastResolvedPath : undefined,
            useCount: typeof obj.useCount === "number" ? obj.useCount : undefined,
          });
        }
      }
    }

    return result;
  }

  private saveConfig(): void {
    const dir = path.dirname(this.configFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2) + "\n", { mode: 0o600 });
    try {
      fs.chmodSync(this.configFile, 0o600);
    } catch {
      // best-effort
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  getConfig(): ApprovalConfig {
    return { ...this.config };
  }

  getPolicy(): ApprovalPolicy {
    return { ...this.config.defaults };
  }

  setPolicy(policy: Partial<ApprovalPolicy>): void {
    this.config.defaults = { ...this.config.defaults, ...policy };
    this.saveConfig();
  }

  getAllowlist(): AllowlistEntry[] {
    return [...this.config.allowlist];
  }

  addAllowlist(pattern: string, description?: string): AllowlistEntry {
    const trimmed = pattern.trim();
    if (!trimmed) {
      throw new Error("pattern cannot be empty");
    }

    const normalized = trimmed.toLowerCase();
    const existing = this.config.allowlist.find(
      e => e.pattern.toLowerCase() === normalized
    );
    if (existing) return existing;

    const entry: AllowlistEntry = {
      id: crypto.randomUUID(),
      pattern: trimmed,
      description,
      createdAt: Date.now(),
    };
    this.config.allowlist.push(entry);
    this.saveConfig();
    return entry;
  }

  removeAllowlist(idOrPattern: string): boolean {
    const normalized = idOrPattern.toLowerCase();
    const index = this.config.allowlist.findIndex(
      e => e.id === idOrPattern || e.pattern.toLowerCase() === normalized
    );
    if (index === -1) return false;
    this.config.allowlist.splice(index, 1);
    this.saveConfig();
    return true;
  }

  updateAllowlist(id: string, updates: Partial<AllowlistEntry>): AllowlistEntry | null {
    const entry = this.config.allowlist.find(e => e.id === id);
    if (!entry) return null;
    Object.assign(entry, updates);
    this.saveConfig();
    return entry;
  }

  getSafeBins(): string[] {
    return [...this.config.safeBins];
  }

  setSafeBins(bins: string[]): void {
    this.config.safeBins = bins.map(b => b.trim().toLowerCase()).filter(Boolean);
    this.saveConfig();
  }

  addSafeBin(bin: string): void {
    const normalized = bin.trim().toLowerCase();
    if (!normalized) return;
    if (!this.config.safeBins.includes(normalized)) {
      this.config.safeBins.push(normalized);
      this.saveConfig();
    }
  }

  removeSafeBin(bin: string): void {
    const normalized = bin.trim().toLowerCase();
    this.config.safeBins = this.config.safeBins.filter(b => b !== normalized);
    this.saveConfig();
  }

  // -------------------------------------------------------------------------
  // Command Analysis
  // -------------------------------------------------------------------------

  analyzeCommand(
    command: string,
    options?: { cwd?: string; env?: NodeJS.ProcessEnv }
  ): CommandAnalysis {
    const { cwd, env } = options ?? {};

    // Try splitting by chain operators first
    const chainParts = splitByChain(command);
    if (chainParts) {
      const chains: CommandSegment[][] = [];
      const allSegments: CommandSegment[] = [];

      for (const part of chainParts) {
        const pipeline = splitByPipeline(part);
        if (!pipeline.ok) {
          return { ok: false, reason: pipeline.reason, segments: [] };
        }

        const segments: CommandSegment[] = [];
        for (const seg of pipeline.segments) {
          const parsed = parseSegment(seg, cwd, env);
          if (!parsed) {
            return { ok: false, reason: `failed to parse segment: ${seg}`, segments: [] };
          }
          segments.push(parsed);
        }

        chains.push(segments);
        allSegments.push(...segments);
      }

      return { ok: true, segments: allSegments, chains };
    }

    // No chain operators, parse as simple pipeline
    const pipeline = splitByPipeline(command);
    if (!pipeline.ok) {
      return { ok: false, reason: pipeline.reason, segments: [] };
    }

    const segments: CommandSegment[] = [];
    for (const seg of pipeline.segments) {
      const parsed = parseSegment(seg, cwd, env);
      if (!parsed) {
        return { ok: false, reason: `failed to parse segment: ${seg}`, segments: [] };
      }
      segments.push(parsed);
    }

    return { ok: true, segments };
  }

  // -------------------------------------------------------------------------
  // Approval Check
  // -------------------------------------------------------------------------

  private isSafeBin(segment: CommandSegment): boolean {
    const execName = segment.executable.toLowerCase();
    if (!this.config.safeBins.includes(execName)) return false;
    if (!segment.resolvedPath) return false;

    // Check if any argument is a file path
    for (const arg of segment.argv.slice(1)) {
      if (arg === "-") continue;
      if (arg.startsWith("-")) continue;
      if (arg.includes("/") || arg.includes("\\")) return false;
      // Could check if file exists, but simpler to just block
    }

    return true;
  }

  private matchAllowlist(segment: CommandSegment): AllowlistEntry | null {
    if (!segment.resolvedPath) return null;

    for (const entry of this.config.allowlist) {
      const pattern = entry.pattern.trim();
      if (!pattern) continue;

      // Must be a path-based pattern
      if (!pattern.includes("/") && !pattern.includes("\\") && !pattern.includes("~")) {
        continue;
      }

      if (matchesPattern(pattern, segment.resolvedPath)) {
        return entry;
      }
    }

    return null;
  }

  checkApproval(
    command: string,
    options?: { cwd?: string; env?: NodeJS.ProcessEnv }
  ): ApprovalResult {
    const analysis = this.analyzeCommand(command, options);

    if (!analysis.ok) {
      return {
        allowed: false,
        reason: analysis.reason ?? "failed to parse command",
        matchedEntries: [],
        analysis,
      };
    }

    const matchedEntries: AllowlistEntry[] = [];
    const { security } = this.config.defaults;

    // If security is "deny", always deny unless explicitly allowed
    if (security === "deny") {
      return {
        allowed: false,
        reason: "security policy is set to deny",
        matchedEntries: [],
        analysis,
      };
    }

    // If security is "full", always allow
    if (security === "full") {
      return {
        allowed: true,
        reason: "security policy is set to full",
        matchedEntries: [],
        analysis,
      };
    }

    // Security is "allowlist" - check each segment
    const checkSegments = (segments: CommandSegment[]): boolean => {
      for (const segment of segments) {
        // Check allowlist first
        const match = this.matchAllowlist(segment);
        if (match) {
          matchedEntries.push(match);
          continue;
        }

        // Check safe bins
        if (this.isSafeBin(segment)) {
          continue;
        }

        // Not allowed
        return false;
      }
      return true;
    };

    // Handle chains
    if (analysis.chains) {
      for (const chain of analysis.chains) {
        if (!checkSegments(chain)) {
          return {
            allowed: false,
            reason: "command not in allowlist or safe bins",
            matchedEntries,
            analysis,
          };
        }
      }
    } else {
      if (!checkSegments(analysis.segments)) {
        return {
          allowed: false,
          reason: "command not in allowlist or safe bins",
          matchedEntries,
          analysis,
        };
      }
    }

    return {
      allowed: true,
      reason: "command approved",
      matchedEntries,
      analysis,
    };
  }

  requiresApproval(result: ApprovalResult): boolean {
    const { ask } = this.config.defaults;
    const { security } = this.config.defaults;

    if (ask === "always") return true;
    if (ask === "on-miss" && security === "allowlist") {
      return !result.analysis.ok || !result.allowed;
    }
    return false;
  }

  recordUse(entryId: string, command: string, resolvedPath?: string): void {
    const entry = this.config.allowlist.find(e => e.id === entryId);
    if (!entry) return;

    entry.lastUsedAt = Date.now();
    entry.lastUsedCommand = command;
    entry.lastResolvedPath = resolvedPath;
    entry.useCount = (entry.useCount ?? 0) + 1;
    this.saveConfig();
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  getStats(): {
    allowlistCount: number;
    safeBinCount: number;
    policy: ApprovalPolicy;
  } {
    return {
      allowlistCount: this.config.allowlist.length,
      safeBinCount: this.config.safeBins.length,
      policy: this.config.defaults,
    };
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(json: string): void {
    const parsed = JSON.parse(json);
    this.config = {
      ...this.config,
      ...parsed,
      allowlist: this.normalizeAllowlist(parsed.allowlist ?? []),
    };
    this.saveConfig();
  }

  reset(): void {
    this.config = {
      configFile: this.configFile,
      defaults: { ...DEFAULT_APPROVAL_POLICY },
      allowlist: [],
      safeBins: [...DEFAULT_SAFE_BINS],
    };
    this.saveConfig();
  }
}

// Singleton instance
let engineInstance: ApprovalEngine | null = null;

export function getApprovalEngine(config?: Partial<ApprovalConfig>): ApprovalEngine {
  if (!engineInstance) {
    engineInstance = new ApprovalEngine(config);
  }
  return engineInstance;
}

export function resetApprovalEngine(): void {
  engineInstance = null;
}
