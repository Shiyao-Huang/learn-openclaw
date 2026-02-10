/**
 * v11-agent/utils/terminal-cards.ts - 终端卡片日志系统
 *
 * Rick and Morty 科幻风格的终端日志展示
 * 使用 ANSI 颜色和 Unicode 字符绘制卡片
 */

// ============================================================================
// ANSI 颜色定义 - Portal Gun 配色方案
// ============================================================================

const C = {
  // 重置
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Portal Green 主色调
  portalGreen: "\x1b[38;5;48m",      // 亮绿色 - 主色
  portalCyan: "\x1b[38;5;51m",       // 青色 - 强调
  portalDark: "\x1b[38;5;22m",       // 深绿 - 边框

  // 功能色
  mortyYellow: "\x1b[38;5;220m",     // Morty 黄 - 警告/工具
  rickBlue: "\x1b[38;5;39m",         // Rick 蓝 - 信息
  plumbusRed: "\x1b[38;5;196m",      // 红色 - 错误
  spacePurple: "\x1b[38;5;135m",     // 紫色 - 特殊

  // 中性色
  white: "\x1b[38;5;255m",
  gray: "\x1b[38;5;245m",
  darkGray: "\x1b[38;5;238m",

  // 背景色
  bgPortal: "\x1b[48;5;22m",
  bgDark: "\x1b[48;5;233m",
  bgBlack: "\x1b[48;5;16m",
};

// ============================================================================
// Unicode 字符
// ============================================================================

const BOX = {
  // 圆角边框
  tl: "╭", tr: "╮", bl: "╰", br: "╯",
  h: "─", v: "│",
  // 双线边框（用于重要卡片）
  dtl: "╔", dtr: "╗", dbl: "╚", dbr: "╝",
  dh: "═", dv: "║",
  // 分隔符
  lt: "├", rt: "┤", cross: "┼",
  // 图标
  bullet: "●", arrow: "▶", check: "✓", cross_mark: "✗",
  star: "★", diamond: "◆", circle: "○",
  lightning: "⚡", gear: "⚙", clock: "⏱",
  send: "➤", receive: "◀", portal: "◎",
};

// ============================================================================
// 渠道图标
// ============================================================================

const CHANNEL_ICONS: Record<string, string> = {
  feishu: "🪶",
  telegram: "✈️",
  discord: "🎮",
  console: "💻",
  slack: "💬",
  default: "📡",
};

// ============================================================================
// 辅助函数
// ============================================================================

function getWidth(): number {
  return process.stdout.columns || 80;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

function pad(str: string, len: number, char: string = " "): string {
  const visibleLen = stripAnsi(str).length;
  if (visibleLen >= len) return str;
  return str + char.repeat(len - visibleLen);
}

function center(str: string, len: number): string {
  const visibleLen = stripAnsi(str).length;
  if (visibleLen >= len) return str;
  const left = Math.floor((len - visibleLen) / 2);
  const right = len - visibleLen - left;
  return " ".repeat(left) + str + " ".repeat(right);
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ============================================================================
// 卡片渲染器
// ============================================================================

export class TerminalCards {
  private width: number;

  constructor() {
    this.width = Math.min(getWidth(), 100);
  }

  // --------------------------------------------------------------------------
  // 基础卡片框架
  // --------------------------------------------------------------------------

  private drawBox(
    lines: string[],
    options: {
      title?: string;
      titleColor?: string;
      borderColor?: string;
      width?: number;
      double?: boolean;
      icon?: string;
    } = {}
  ): string {
    const {
      title,
      titleColor = C.portalGreen,
      borderColor = C.portalDark,
      width = this.width - 4,
      double = false,
      icon = "",
    } = options;

    const box = double
      ? { tl: BOX.dtl, tr: BOX.dtr, bl: BOX.dbl, br: BOX.dbr, h: BOX.dh, v: BOX.dv }
      : { tl: BOX.tl, tr: BOX.tr, bl: BOX.bl, br: BOX.br, h: BOX.h, v: BOX.v };

    const innerWidth = width - 2;
    const result: string[] = [];

    // 顶部边框
    if (title) {
      const titleText = icon ? `${icon} ${title}` : title;
      const titleLen = stripAnsi(titleText).length;
      const leftPad = 2;
      const rightPad = innerWidth - titleLen - leftPad - 2;
      result.push(
        `${borderColor}${box.tl}${box.h.repeat(leftPad)}${C.reset}` +
        `${titleColor}${C.bold}${titleText}${C.reset}` +
        `${borderColor}${box.h.repeat(Math.max(0, rightPad))}${box.tr}${C.reset}`
      );
    } else {
      result.push(`${borderColor}${box.tl}${box.h.repeat(innerWidth)}${box.tr}${C.reset}`);
    }

    // 内容行
    for (const line of lines) {
      const visibleLen = stripAnsi(line).length;
      const padding = innerWidth - visibleLen;
      result.push(
        `${borderColor}${box.v}${C.reset}` +
        `${line}${" ".repeat(Math.max(0, padding))}` +
        `${borderColor}${box.v}${C.reset}`
      );
    }

    // 底部边框
    result.push(`${borderColor}${box.bl}${box.h.repeat(innerWidth)}${box.br}${C.reset}`);

    return result.join("\n");
  }

  // --------------------------------------------------------------------------
  // 渠道消息卡片
  // --------------------------------------------------------------------------

  channelReceive(channel: string, userId: string, message: string, userName?: string): string {
    const icon = CHANNEL_ICONS[channel] || CHANNEL_ICONS.default;
    const time = formatTime();
    const displayName = userName || userId.slice(0, 12);
    const innerWidth = this.width - 6;

    const lines = [
      `${C.dim}${time}${C.reset}  ${C.rickBlue}${BOX.receive}${C.reset} ${C.white}${displayName}${C.reset}`,
      `${C.portalGreen}${truncate(message, innerWidth)}${C.reset}`,
    ];

    return this.drawBox(lines, {
      title: `${channel.toUpperCase()} 收到`,
      titleColor: C.rickBlue,
      borderColor: C.rickBlue,
      icon,
    });
  }

  channelSend(channel: string, chatId: string, message: string): string {
    const icon = CHANNEL_ICONS[channel] || CHANNEL_ICONS.default;
    const time = formatTime();
    const innerWidth = this.width - 6;

    const lines = [
      `${C.dim}${time}${C.reset}  ${C.portalGreen}${BOX.send}${C.reset} ${C.gray}${chatId.slice(0, 16)}${C.reset}`,
      `${C.white}${truncate(message, innerWidth)}${C.reset}`,
    ];

    return this.drawBox(lines, {
      title: `${channel.toUpperCase()} 发送`,
      titleColor: C.portalGreen,
      borderColor: C.portalGreen,
      icon,
    });
  }

  // --------------------------------------------------------------------------
  // 控制台输入卡片
  // --------------------------------------------------------------------------

  consoleInput(input: string): string {
    const time = formatTime();
    const innerWidth = this.width - 6;

    const lines = [
      `${C.dim}${time}${C.reset}  ${C.spacePurple}${BOX.arrow}${C.reset} ${C.gray}USER${C.reset}`,
      `${C.white}${truncate(input, innerWidth)}${C.reset}`,
    ];

    return this.drawBox(lines, {
      title: "CONSOLE INPUT",
      titleColor: C.spacePurple,
      borderColor: C.spacePurple,
      icon: "💻",
    });
  }

  // --------------------------------------------------------------------------
  // 工具调用卡片 - 显示参数和目的
  // --------------------------------------------------------------------------

  toolCall(toolName: string, args?: Record<string, any>, status: "running" | "success" | "error" = "running"): string {
    const statusIcon = {
      running: `${C.mortyYellow}${BOX.gear}${C.reset}`,
      success: `${C.portalGreen}${BOX.check}${C.reset}`,
      error: `${C.plumbusRed}${BOX.cross_mark}${C.reset}`,
    }[status];

    const statusColor = {
      running: C.mortyYellow,
      success: C.portalGreen,
      error: C.plumbusRed,
    }[status];

    const innerWidth = this.width - 6;
    const lines: string[] = [];

    // 工具名称行
    lines.push(`${statusIcon} ${statusColor}${C.bold}${toolName}${C.reset}`);

    // 显示关键参数
    if (args) {
      const argPreview = this.formatToolArgs(toolName, args, innerWidth - 4);
      if (argPreview) {
        lines.push(`${C.dim}  ${argPreview}${C.reset}`);
      }
    }

    return this.drawBox(lines, {
      title: "TOOL",
      titleColor: C.mortyYellow,
      borderColor: C.darkGray,
      icon: "⚡",
      width: Math.min(60, this.width - 4),
    });
  }

  // 格式化工具参数 - 根据工具类型显示关键信息
  private formatToolArgs(toolName: string, args: Record<string, any>, maxLen: number): string {
    const formatters: Record<string, (args: Record<string, any>) => string> = {
      bash: (a) => `$ ${truncate(a.command || "", maxLen - 2)}`,
      read_file: (a) => `📄 ${truncate(a.path || a.file_path || "", maxLen - 2)}`,
      write_file: (a) => `📝 ${truncate(a.path || a.file_path || "", maxLen - 2)}`,
      edit_file: (a) => `✏️ ${truncate(a.path || a.file_path || "", maxLen - 2)}`,
      grep: (a) => `🔍 "${truncate(a.pattern || "", 20)}" in ${truncate(a.path || ".", 20)}`,
      memory_search: (a) => `🧠 "${truncate(a.query || "", maxLen - 4)}"`,
      memory_search_all: (a) => `🧠 "${truncate(a.query || "", maxLen - 4)}"`,
      daily_write: (a) => `📔 ${truncate(a.content || "", maxLen - 4)}`,
      daily_read: (a) => `📖 ${a.date || "today"}`,
      daily_recent: (a) => `📖 最近 ${a.days || 3} 天`,
      longterm_read: (a) => `📚 长期记忆`,
      longterm_append: (a) => `📚+ ${truncate(a.content || "", maxLen - 4)}`,
      TodoWrite: (a) => this.formatTodoArgs(a, maxLen),
      session_list: () => `📋 列出会话`,
      channel_send: (a) => `📤 -> ${a.channel}:${truncate(a.target || "", 15)}`,
      channel_list: () => `📡 列出渠道`,
      introspect_stats: () => `📊 内省统计`,
      introspect_reflect: () => `🪞 自我反思`,
      Claw: (a) => `🦞 ${a.name || "skill"}`,
    };

    const formatter = formatters[toolName];
    if (formatter) {
      try {
        return formatter(args);
      } catch {
        return "";
      }
    }

    // 默认：显示第一个参数
    const firstKey = Object.keys(args)[0];
    if (firstKey) {
      const val = args[firstKey];
      const valStr = typeof val === "string" ? val : JSON.stringify(val);
      return `${firstKey}: ${truncate(valStr, maxLen - firstKey.length - 2)}`;
    }
    return "";
  }

  // 格式化 TodoWrite 参数
  private formatTodoArgs(args: Record<string, any>, maxLen: number): string {
    const todos = args.todos || [];
    if (!Array.isArray(todos) || todos.length === 0) return "📋 更新任务";

    const summary: string[] = [];
    let pending = 0, inProgress = 0, completed = 0;

    for (const todo of todos) {
      if (todo.status === "pending") pending++;
      else if (todo.status === "in_progress") inProgress++;
      else if (todo.status === "completed") completed++;
    }

    if (pending > 0) summary.push(`${pending} 待办`);
    if (inProgress > 0) summary.push(`${inProgress} 进行中`);
    if (completed > 0) summary.push(`${completed} 完成`);

    return `📋 ${summary.join(" | ")}`;
  }

  // 紧凑版工具调用（单行，带参数预览）
  toolCallCompact(toolName: string, args?: Record<string, any>): string {
    const argPreview = args ? this.formatToolArgs(toolName, args, 40) : "";
    const preview = argPreview ? ` ${C.dim}${argPreview}${C.reset}` : "";
    return `${C.darkGray}${BOX.v}${C.reset} ${C.mortyYellow}${BOX.lightning}${C.reset} ${C.white}${toolName}${C.reset}${preview}`;
  }

  // --------------------------------------------------------------------------
  // Token 统计卡片
  // --------------------------------------------------------------------------

  tokenStats(stats: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requestCount: number;
    toolCallCount: number;
    sessionStart: string;
  }): string {
    const start = new Date(stats.sessionStart);
    const elapsed = (Date.now() - start.getTime()) / 1000;
    const rate = elapsed > 0 ? (stats.totalTokens / elapsed).toFixed(1) : "0";
    const duration = `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`;

    const innerWidth = this.width - 6;
    const col1 = Math.floor(innerWidth / 2);

    const lines = [
      `${C.portalCyan}${BOX.diamond}${C.reset} ${C.gray}INPUT${C.reset}  ${C.white}${formatNumber(stats.inputTokens)}${C.reset}` +
      `${" ".repeat(Math.max(2, col1 - 20))}` +
      `${C.portalGreen}${BOX.diamond}${C.reset} ${C.gray}OUTPUT${C.reset} ${C.white}${formatNumber(stats.outputTokens)}${C.reset}`,

      `${C.mortyYellow}${BOX.star}${C.reset} ${C.gray}TOTAL${C.reset}  ${C.bold}${C.white}${formatNumber(stats.totalTokens)}${C.reset}` +
      `${" ".repeat(Math.max(2, col1 - 20))}` +
      `${C.rickBlue}${BOX.lightning}${C.reset} ${C.gray}RATE${C.reset}   ${C.white}${rate}/s${C.reset}`,

      `${C.spacePurple}${BOX.gear}${C.reset} ${C.gray}CALLS${C.reset}  ${C.white}${stats.requestCount}${C.reset}` +
      `${" ".repeat(Math.max(2, col1 - 18))}` +
      `${C.mortyYellow}${BOX.gear}${C.reset} ${C.gray}TOOLS${C.reset}  ${C.white}${stats.toolCallCount}${C.reset}`,

      `${C.dim}${BOX.clock} ${duration}${C.reset}`,
    ];

    return this.drawBox(lines, {
      title: "TOKEN STATS",
      titleColor: C.portalGreen,
      borderColor: C.portalGreen,
      icon: "📊",
      double: true,
    });
  }

  // --------------------------------------------------------------------------
  // Todo 常驻显示卡片
  // --------------------------------------------------------------------------

  todoList(todos: Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }>): string {
    if (!todos || todos.length === 0) {
      return this.drawBox([`${C.dim}暂无任务${C.reset}`], {
        title: "TODO",
        titleColor: C.spacePurple,
        borderColor: C.darkGray,
        icon: "📋",
      });
    }

    const innerWidth = this.width - 6;
    const lines: string[] = [];

    // 统计
    const pending = todos.filter(t => t.status === "pending").length;
    const inProgress = todos.filter(t => t.status === "in_progress").length;
    const completed = todos.filter(t => t.status === "completed").length;

    lines.push(
      `${C.gray}待办${C.reset} ${C.white}${pending}${C.reset}  ` +
      `${C.mortyYellow}进行中${C.reset} ${C.white}${inProgress}${C.reset}  ` +
      `${C.portalGreen}完成${C.reset} ${C.white}${completed}${C.reset}`
    );
    lines.push(`${C.darkGray}${BOX.h.repeat(innerWidth)}${C.reset}`);

    // 显示任务（优先显示进行中和待办）
    const sortedTodos = [
      ...todos.filter(t => t.status === "in_progress"),
      ...todos.filter(t => t.status === "pending"),
      ...todos.filter(t => t.status === "completed"),
    ].slice(0, 8); // 最多显示 8 条

    for (const todo of sortedTodos) {
      const statusIcon = {
        pending: `${C.gray}${BOX.circle}${C.reset}`,
        in_progress: `${C.mortyYellow}${BOX.gear}${C.reset}`,
        completed: `${C.portalGreen}${BOX.check}${C.reset}`,
      }[todo.status];

      const statusColor = {
        pending: C.white,
        in_progress: C.mortyYellow,
        completed: C.dim,
      }[todo.status];

      lines.push(`${statusIcon} ${statusColor}${truncate(todo.content, innerWidth - 4)}${C.reset}`);
    }

    if (todos.length > 8) {
      lines.push(`${C.dim}  +${todos.length - 8} more...${C.reset}`);
    }

    return this.drawBox(lines, {
      title: "TODO LIST",
      titleColor: C.spacePurple,
      borderColor: C.spacePurple,
      icon: "📋",
    });
  }

  // 紧凑版 Todo 状态栏（单行）
  todoStatusBar(todos: Array<{ status: string }>): string {
    if (!todos || todos.length === 0) return "";

    const pending = todos.filter(t => t.status === "pending").length;
    const inProgress = todos.filter(t => t.status === "in_progress").length;
    const completed = todos.filter(t => t.status === "completed").length;

    return `${C.darkGray}${BOX.v}${C.reset} ${C.spacePurple}📋${C.reset} ` +
      `${C.gray}P:${C.reset}${C.white}${pending}${C.reset} ` +
      `${C.mortyYellow}I:${C.reset}${C.white}${inProgress}${C.reset} ` +
      `${C.portalGreen}C:${C.reset}${C.white}${completed}${C.reset}`;
  }

  // --------------------------------------------------------------------------
  // 对话卡片
  // --------------------------------------------------------------------------

  conversation(userInput: string, response: string, toolCalls: string[] = []): string {
    const innerWidth = this.width - 6;
    const lines: string[] = [];

    // 用户输入
    lines.push(`${C.spacePurple}${BOX.arrow} USER${C.reset}`);
    lines.push(`${C.white}${truncate(userInput, innerWidth)}${C.reset}`);

    // 工具调用（如果有）
    if (toolCalls.length > 0) {
      lines.push(`${C.darkGray}${BOX.h.repeat(innerWidth)}${C.reset}`);
      lines.push(`${C.mortyYellow}${BOX.lightning} TOOLS (${toolCalls.length})${C.reset}`);
      const toolsStr = toolCalls.slice(0, 5).join(", ");
      lines.push(`${C.dim}${truncate(toolsStr, innerWidth)}${C.reset}`);
      if (toolCalls.length > 5) {
        lines.push(`${C.dim}  +${toolCalls.length - 5} more...${C.reset}`);
      }
    }

    // AI 响应
    lines.push(`${C.darkGray}${BOX.h.repeat(innerWidth)}${C.reset}`);
    lines.push(`${C.portalGreen}${BOX.arrow} RICK${C.reset}`);

    // 多行响应处理
    const responseLines = response.split("\n").slice(0, 5);
    for (const line of responseLines) {
      lines.push(`${C.white}${truncate(line, innerWidth)}${C.reset}`);
    }
    if (response.split("\n").length > 5) {
      lines.push(`${C.dim}  ... (${response.split("\n").length - 5} more lines)${C.reset}`);
    }

    return this.drawBox(lines, {
      title: "CONVERSATION",
      titleColor: C.portalCyan,
      borderColor: C.portalCyan,
      icon: "💬",
    });
  }

  // --------------------------------------------------------------------------
  // 错误卡片
  // --------------------------------------------------------------------------

  error(message: string): string {
    const innerWidth = this.width - 6;
    const lines = [
      `${C.plumbusRed}${BOX.cross_mark} ${truncate(message, innerWidth - 2)}${C.reset}`,
    ];

    return this.drawBox(lines, {
      title: "ERROR",
      titleColor: C.plumbusRed,
      borderColor: C.plumbusRed,
      icon: "⚠️",
    });
  }

  // --------------------------------------------------------------------------
  // 信息卡片
  // --------------------------------------------------------------------------

  info(message: string): string {
    const innerWidth = this.width - 6;
    const lines = [
      `${C.rickBlue}${BOX.bullet} ${truncate(message, innerWidth - 2)}${C.reset}`,
    ];

    return this.drawBox(lines, {
      title: "INFO",
      titleColor: C.rickBlue,
      borderColor: C.rickBlue,
      icon: "ℹ️",
    });
  }

  // --------------------------------------------------------------------------
  // 去重提示（紧凑）
  // --------------------------------------------------------------------------

  dedup(messageId: string): string {
    return `${C.dim}${BOX.circle} 跳过重复: ${messageId.slice(0, 30)}${C.reset}`;
  }

  // --------------------------------------------------------------------------
  // 请求日志（紧凑）
  // --------------------------------------------------------------------------

  requestLog(filePath: string): string {
    const fileName = filePath.split("/").pop() || filePath;
    return `${C.dim}${BOX.bullet} LOG: ${fileName}${C.reset}`;
  }

  // --------------------------------------------------------------------------
  // 启动横幅
  // --------------------------------------------------------------------------

  banner(name: string, stats: { memory: string; sessions: string; claws: number }): string {
    const innerWidth = this.width - 6;

    const portalArt = [
      `${C.portalGreen}    ◎ ═══════════════════ ◎${C.reset}`,
      `${C.portalCyan}   ╱                         ╲${C.reset}`,
      `${C.portalGreen}  ║  ${C.bold}${C.white}OpenClaw V11${C.reset}${C.portalGreen}           ║${C.reset}`,
      `${C.portalCyan}  ║  ${C.dim}${name}${C.reset}${C.portalCyan}${" ".repeat(Math.max(0, 20 - name.length))}║${C.reset}`,
      `${C.portalGreen}   ╲                         ╱${C.reset}`,
      `${C.portalGreen}    ◎ ═══════════════════ ◎${C.reset}`,
    ];

    const lines = [
      ...portalArt,
      "",
      `${C.gray}${stats.memory} │ ${stats.sessions} │ Claw: ${stats.claws}${C.reset}`,
      `${C.dim}输入 'q' 退出 │ '/stats' Token 统计${C.reset}`,
    ];

    return this.drawBox(lines, {
      title: "PORTAL ACTIVATED",
      titleColor: C.portalGreen,
      borderColor: C.portalGreen,
      double: true,
      icon: "🌀",
    });
  }

  // --------------------------------------------------------------------------
  // 退出横幅
  // --------------------------------------------------------------------------

  goodbye(stats: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requestCount: number;
    toolCallCount: number;
    sessionStart: string;
  }): string {
    const start = new Date(stats.sessionStart);
    const elapsed = (Date.now() - start.getTime()) / 1000;
    const duration = `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`;

    const lines = [
      `${C.portalGreen}${C.bold}Wubba Lubba Dub Dub!${C.reset}`,
      "",
      `${C.gray}Session Duration:${C.reset} ${C.white}${duration}${C.reset}`,
      `${C.gray}Total Tokens:${C.reset}     ${C.white}${formatNumber(stats.totalTokens)}${C.reset}`,
      `${C.gray}API Calls:${C.reset}        ${C.white}${stats.requestCount}${C.reset}`,
      `${C.gray}Tool Calls:${C.reset}       ${C.white}${stats.toolCallCount}${C.reset}`,
      "",
      `${C.dim}Portal closed. See you next time, Morty!${C.reset}`,
    ];

    return this.drawBox(lines, {
      title: "PORTAL CLOSED",
      titleColor: C.portalCyan,
      borderColor: C.portalCyan,
      double: true,
      icon: "🌀",
    });
  }
}

// ============================================================================
// 导出单例
// ============================================================================

export const cards = new TerminalCards();
