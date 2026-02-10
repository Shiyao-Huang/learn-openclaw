/**
 * tools/executor.ts - 工具执行器
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { MemoryManager } from "../memory/index.js";
import type { SessionManager } from "../session/manager.js";
import type { ChannelManager } from "../channel/index.js";
import type { IdentitySystem } from "../identity/system.js";
import type { IntrospectionTracker } from "../introspect/tracker.js";
import type { ClawLoader } from "../claw/loader.js";

export interface ExecutorContext {
  workDir: string;
  bashTimeout?: number;
  memoryManager: MemoryManager;
  sessionManager: SessionManager;
  channelManager: ChannelManager;
  identitySystem: IdentitySystem;
  introspection: IntrospectionTracker;
  clawLoader: ClawLoader;
}

let currentTodos: any[] = [];

export function createExecutor(ctx: ExecutorContext) {
  const {
    workDir,
    bashTimeout = 30000,
    memoryManager,
    sessionManager,
    channelManager,
    identitySystem,
    introspection,
    clawLoader,
  } = ctx;

  return async function executeTool(name: string, args: Record<string, any>): Promise<string> {
    const startTime = Date.now();
    let result: string;

    try {
      switch (name) {
        // 基础工具
        case "bash":
          result = execSync(args.command, {
            encoding: "utf-8",
            cwd: workDir,
            timeout: bashTimeout
          }).trim();
          break;

        case "read_file": {
          const fullPath = path.resolve(workDir, args.path);
          if (!fs.existsSync(fullPath)) {
            result = `错误: 文件不存在 ${args.path}`;
          } else {
            let content = await fsp.readFile(fullPath, "utf-8");
            if (args.limit) {
              content = content.split("\n").slice(0, args.limit).join("\n");
            }
            result = content;
          }
          break;
        }

        case "write_file": {
          const fullPath = path.resolve(workDir, args.path);
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            await fsp.mkdir(dir, { recursive: true });
          }
          await fsp.writeFile(fullPath, args.content);
          result = `已写入: ${args.path}`;
          break;
        }

        case "edit_file": {
          const fullPath = path.resolve(workDir, args.path);
          if (!fs.existsSync(fullPath)) {
            result = `错误: 文件不存在 ${args.path}`;
          } else {
            let content = await fsp.readFile(fullPath, "utf-8");
            if (!content.includes(args.old_text)) {
              result = `错误: 未找到要替换的文本`;
            } else {
              content = content.replace(args.old_text, args.new_text);
              await fsp.writeFile(fullPath, content);
              result = `已编辑: ${args.path}`;
            }
          }
          break;
        }

        case "grep": {
          const flags = args.recursive ? "-rn" : "-n";
          try {
            // macOS 兼容：使用 grep -E (扩展正则) 而非 grep -P (Perl正则)
            result = execSync(
              `grep -E ${flags} "${args.pattern}" "${args.path}" 2>/dev/null || true`,
              { encoding: "utf-8", cwd: workDir }
            ).trim();
            if (!result) {
              result = "未找到匹配";
            }
          } catch (e: any) {
            result = e.stdout?.trim() || "未找到匹配";
          }
          break;
        }

        // 记忆工具
        case "memory_search":
          result = memoryManager.local.search(args.query, args.max_results || 5);
          break;

        case "daily_write":
          result = memoryManager.daily.write(args.content);
          break;

        case "daily_read":
          result = memoryManager.daily.read(args.date);
          break;

        case "daily_recent":
          result = memoryManager.daily.recent(args.days || 3);
          break;

        case "longterm_read":
          result = memoryManager.longterm.read();
          break;

        case "longterm_append":
          result = memoryManager.longterm.append(args.section, args.content);
          break;

        case "memory_search_all":
          result = memoryManager.searchAll(args.query);
          break;

        // 会话工具
        case "session_list": {
          const sessions = sessionManager.list();
          if (sessions.length === 0) {
            result = "暂无会话";
          } else {
            result = sessions.map(s =>
              `- ${s.key} (${s.type}) - 消息: ${s.history.length}, 最后活跃: ${new Date(s.lastActiveAt).toLocaleString()}`
            ).join("\n");
          }
          break;
        }

        case "session_cleanup": {
          const cleaned = await sessionManager.cleanup();
          result = `已清理 ${cleaned} 个过期会话`;
          break;
        }

        // 渠道工具
        case "channel_list":
          result = channelManager.list();
          break;

        case "channel_send":
          result = await channelManager.send(args.channel, args.target, args.message);
          break;

        case "channel_status":
          result = channelManager.status(args.channel);
          break;

        case "channel_config":
          result = await channelManager.configure(args.channel, {
            enabled: args.enabled,
            groupPolicy: args.groupPolicy,
            dmPolicy: args.dmPolicy,
            trustedUsers: args.trustedUsers,
          });
          break;

        case "channel_start":
          result = await channelManager.startAll();
          break;

        case "channel_stop":
          await channelManager.stopAll();
          result = "所有渠道已停止";
          break;

        // 身份工具
        case "identity_load":
          identitySystem.load();
          result = "身份信息已重新加载";
          break;

        case "identity_get":
          result = identitySystem.getSummary();
          break;

        // 内省工具
        case "introspect_stats":
          result = introspection.formatStats();
          break;

        case "introspect_patterns":
          result = introspection.formatPatterns();
          break;

        case "introspect_reflect":
          result = await introspection.reflect();
          break;

        case "introspect_logs": {
          const logs = introspection.getLogs();
          if (logs.length === 0) {
            result = "当前会话暂无行为记录";
          } else {
            result = logs.slice(-20).map(l =>
              `[${new Date(l.timestamp).toLocaleTimeString('zh-CN')}] ${l.tool}(${JSON.stringify(l.args).slice(0, 50)}...) -> ${(l.result || '').slice(0, 100)}...`
            ).join('\n');
          }
          break;
        }

        // Claw 工具
        case "Claw":
          result = clawLoader.load(args.claw);
          break;

        // 任务规划
        case "TodoWrite": {
          currentTodos = args.items;
          const lines: string[] = [];
          let pending = 0, inProgress = 0, completed = 0;

          for (let i = 0; i < args.items.length; i++) {
            const item = args.items[i];
            let icon = "○";
            if (item.status === "completed") {
              icon = "✓";
              completed++;
            } else if (item.status === "in_progress") {
              icon = "▶";
              inProgress++;
            } else {
              pending++;
            }
            lines.push(`${i + 1}. [${icon}] ${item.content}`);
          }

          lines.push(`\n总计: ${args.items.length} | 待办: ${pending} | 进行中: ${inProgress} | 完成: ${completed}`);
          result = lines.join("\n");
          break;
        }

        default:
          result = `未知工具: ${name}`;
      }
    } catch (e: any) {
      result = `错误: ${e.message}`;
    }

    // 记录内省
    const duration = Date.now() - startTime;
    introspection.record(name, args, result, duration);

    return result;
  };
}

export function getCurrentTodos() {
  return currentTodos;
}
