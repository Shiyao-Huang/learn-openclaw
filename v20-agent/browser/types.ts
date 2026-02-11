/**
 * browser/types.ts - V20 浏览器自动化类型定义
 */

export interface BrowserConfig {
  headless?: boolean;
  viewport?: { width: number; height: number };
  userDataDir?: string;
  args?: string[];
}

export interface BrowserSession {
  id: string;
  pid?: number;
  cdpPort?: number;
  wsUrl?: string;
  currentUrl?: string;
  status: 'starting' | 'ready' | 'navigating' | 'error' | 'closed';
  startedAt: number;
  lastActivity: number;
  config: BrowserConfig;
}

export interface PageSnapshot {
  url: string;
  title: string;
  elements: PageElement[];
  text: string;
  timestamp: number;
}

export interface PageElement {
  tag: string;
  text?: string;
  attributes: Record<string, string>;
  rect?: DOMRect;
  children?: PageElement[];
}

export interface DOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  selector?: string;
}

export interface BrowserAction {
  type: 'click' | 'type' | 'press' | 'scroll' | 'wait';
  target?: string;
  value?: string;
  options?: Record<string, any>;
}

export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export type BrowserTool = 
  | 'browser_start'
  | 'browser_stop'
  | 'browser_navigate'
  | 'browser_snapshot'
  | 'browser_screenshot'
  | 'browser_click'
  | 'browser_type'
  | 'browser_press'
  | 'browser_evaluate'
  | 'browser_list';
