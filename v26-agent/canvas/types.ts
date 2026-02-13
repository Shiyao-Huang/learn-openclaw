/**
 * V26: Canvas 显示系统 - 类型定义
 * 
 * 轻量级 Canvas 实现，提供 UI 展示能力
 */

// ============ 核心类型 ============

/** Canvas 配置 */
export interface CanvasConfig {
  /** HTTP 服务器端口 */
  port: number;
  /** 监听地址 */
  host: string;
  /** 根目录 (用于提供静态文件) */
  rootDir: string;
  /** 是否启用热重载 */
  liveReload: boolean;
  /** 截图输出目录 */
  screenshotDir: string;
  /** 默认视口宽度 */
  viewportWidth: number;
  /** 默认视口高度 */
  viewportHeight: number;
}

/** 默认 Canvas 配置 */
export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  port: 3777,
  host: "127.0.0.1",
  rootDir: "./canvas",
  liveReload: true,
  screenshotDir: "./screenshots",
  viewportWidth: 1280,
  viewportHeight: 720,
};

// ============ Present 操作 ============

/** Canvas 展示请求 */
export interface CanvasPresentRequest {
  /** 目标 URL 或 HTML 内容 */
  content: string;
  /** 内容类型: 'url' | 'html' */
  contentType: "url" | "html";
  /** 标题 */
  title?: string;
  /** X 坐标 (用于窗口定位) */
  x?: number;
  /** Y 坐标 */
  y?: number;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
}

/** Canvas 展示结果 */
export interface CanvasPresentResult {
  success: boolean;
  url: string;
  title?: string;
  error?: string;
}

// ============ Navigate 操作 ============

/** 导航请求 */
export interface CanvasNavigateRequest {
  /** 目标 URL */
  url: string;
  /** 等待时间 (毫秒) */
  waitMs?: number;
}

/** 导航结果 */
export interface CanvasNavigateResult {
  success: boolean;
  url: string;
  title?: string;
  error?: string;
}

// ============ Eval 操作 ============

/** JavaScript 执行请求 */
export interface CanvasEvalRequest {
  /** JavaScript 代码 */
  code: string;
  /** 超时时间 (毫秒) */
  timeout?: number;
}

/** JavaScript 执行结果 */
export interface CanvasEvalResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// ============ Snapshot 操作 ============

/** 快照请求 */
export interface CanvasSnapshotRequest {
  /** 输出格式: 'png' | 'jpeg' */
  format?: "png" | "jpeg";
  /** 最大宽度 */
  maxWidth?: number;
  /** 质量 (仅 jpeg, 0-100) */
  quality?: number;
  /** 全页面截图 */
  fullPage?: boolean;
  /** 选择器 (只截取指定元素) */
  selector?: string;
  /** 输出路径 (可选) */
  outputPath?: string;
}

/** 快照结果 */
export interface CanvasSnapshotResult {
  success: boolean;
  /** 图片路径 */
  path?: string;
  /** Base64 编码的图片数据 */
  data?: string;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  error?: string;
}

// ============ Hide 操作 ============

/** 隐藏请求 */
export interface CanvasHideRequest {
  /** 是否关闭服务器 */
  shutdown?: boolean;
}

/** 隐藏结果 */
export interface CanvasHideResult {
  success: boolean;
  message: string;
}

// ============ Status 操作 ============

/** 状态结果 */
export interface CanvasStatusResult {
  /** 服务器是否运行中 */
  running: boolean;
  /** 当前 URL */
  currentUrl?: string;
  /** 页面标题 */
  title?: string;
  /** 端口 */
  port: number;
  /** 活跃连接数 */
  connections?: number;
  /** 截图历史数量 */
  screenshotCount: number;
}

// ============ 历史记录 ============

/** Canvas 操作历史 */
export interface CanvasHistory {
  /** 操作 ID */
  id: string;
  /** 操作类型 */
  action: "present" | "navigate" | "eval" | "snapshot" | "hide";
  /** 时间戳 */
  timestamp: number;
  /** 是否成功 */
  success: boolean;
  /** 详情 */
  details?: Record<string, unknown>;
}

/** 截图记录 */
export interface ScreenshotRecord {
  /** ID */
  id: string;
  /** 文件路径 */
  path: string;
  /** 创建时间 */
  createdAt: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 格式 */
  format: "png" | "jpeg";
  /** 大小 (字节) */
  size: number;
}
