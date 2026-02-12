/**
 * V25: STT 管理器
 * 
 * 统一管理本地和云端语音识别引擎
 */

import { join } from 'path';
import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { v4 as uuidv4 } from 'crypto';
import { WhisperLocalEngine } from './local.js';
import { WhisperAPIEngine } from './api.js';
import type { 
  STTConfig, 
  STTEngineType, 
  STTRequest, 
  STTResult,
  STTHistoryEntry,
  STTEngine,
  RecordParams,
  ConvertParams,
} from './types.js';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

export class STTManager {
  private localEngine: WhisperLocalEngine;
  private apiEngine: WhisperAPIEngine;
  private config: STTConfig;
  private history: STTHistoryEntry[] = [];
  private historyLoaded = false;
  
  constructor(config?: Partial<STTConfig>) {
    this.config = {
      preferredEngine: 'local',
      local: {},
      api: {},
      historyPath: '.stt-history.json',
      maxHistory: 100,
      ...config,
    };
    
    this.localEngine = new WhisperLocalEngine(this.config.local);
    this.apiEngine = new WhisperAPIEngine(this.config.api);
  }
  
  /**
   * 获取引擎
   */
  getEngine(type?: STTEngineType): STTEngine {
    const engineType = type || this.config.preferredEngine;
    return engineType === 'api' ? this.apiEngine : this.localEngine;
  }
  
  /**
   * 转录音频
   */
  async transcribe(request: STTRequest, engineType?: STTEngineType): Promise<STTResult> {
    const engine = this.getEngine(engineType);
    
    // 如果首选引擎不可用，尝试另一个
    if (!await engine.isAvailable()) {
      const fallback = engineType === 'local' ? this.apiEngine : this.localEngine;
      if (await fallback.isAvailable()) {
        console.log(`Primary engine (${engine.type}) not available, using fallback (${fallback.type})`);
        const result = await fallback.transcribe(request);
        await this.recordHistory(request, result);
        return result;
      }
    }
    
    const result = await engine.transcribe(request);
    
    // 记录历史
    await this.recordHistory(request, result);
    
    return result;
  }
  
  /**
   * 检查引擎状态
   */
  async getStatus(): Promise<{
    local: { available: boolean; name: string };
    api: { available: boolean; name: string };
    preferred: STTEngineType;
  }> {
    const [localAvailable, apiAvailable] = await Promise.all([
      this.localEngine.isAvailable(),
      this.apiEngine.isAvailable(),
    ]);
    
    return {
      local: { available: localAvailable, name: this.localEngine.name },
      api: { available: apiAvailable, name: this.apiEngine.name },
      preferred: this.config.preferredEngine,
    };
  }
  
  /**
   * 获取支持的语言
   */
  async getLanguages(engineType?: STTEngineType): Promise<string[]> {
    const engine = this.getEngine(engineType);
    return engine.getSupportedLanguages();
  }
  
  /**
   * 获取历史记录
   */
  async getHistory(limit = 20): Promise<STTHistoryEntry[]> {
    if (!this.historyLoaded) {
      await this.loadHistory();
    }
    return this.history.slice(0, limit);
  }
  
  /**
   * 清除历史记录
   */
  async clearHistory(): Promise<void> {
    this.history = [];
    await this.saveHistory();
  }
  
  /**
   * 录制音频 (使用 sox 或 ffmpeg)
   */
  async record(params: RecordParams): Promise<{ success: boolean; path?: string; error?: string }> {
    const duration = params.duration || 10;
    const outputPath = params.output || `/tmp/recording-${Date.now()}.wav`;
    
    try {
      // 尝试使用 sox (rec 命令)
      const hasSox = await this.checkCommand('rec');
      
      if (hasSox) {
        await exec(`rec -r 16000 -c 1 "${outputPath}" trim 0 ${duration}`, {
          timeout: (duration + 5) * 1000,
        });
        return { success: true, path: outputPath };
      }
      
      // 尝试使用 ffmpeg
      const hasFfmpeg = await this.checkCommand('ffmpeg');
      
      if (hasFfmpeg) {
        await exec(`ffmpeg -f avfoundation -i ":0" -t ${duration} -ar 16000 -ac 1 "${outputPath}"`, {
          timeout: (duration + 5) * 1000,
        });
        return { success: true, path: outputPath };
      }
      
      return { 
        success: false, 
        error: 'No audio recording tool found. Install sox (brew install sox) or ffmpeg.',
      };
      
    } catch (err: any) {
      return { success: false, error: `Recording failed: ${err.message}` };
    }
  }
  
  /**
   * 转换音频格式
   */
  async convert(params: ConvertParams): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const hasFfmpeg = await this.checkCommand('ffmpeg');
      
      if (!hasFfmpeg) {
        return { 
          success: false, 
          error: 'ffmpeg not found. Install with: brew install ffmpeg',
        };
      }
      
      await exec(`ffmpeg -i "${params.input}" -ar 16000 -ac 1 "${params.output}"`, {
        timeout: 60000,
      });
      
      return { success: true, path: params.output };
      
    } catch (err: any) {
      return { success: false, error: `Conversion failed: ${err.message}` };
    }
  }
  
  // ============ 私有方法 ============
  
  private async recordHistory(request: STTRequest, result: STTResult): Promise<void> {
    if (!this.historyLoaded) {
      await this.loadHistory();
    }
    
    const entry: STTHistoryEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      request,
      result,
    };
    
    this.history.unshift(entry);
    
    // 限制历史记录数量
    if (this.history.length > (this.config.maxHistory || 100)) {
      this.history = this.history.slice(0, this.config.maxHistory);
    }
    
    await this.saveHistory();
  }
  
  private async loadHistory(): Promise<void> {
    if (!this.config.historyPath) return;
    
    try {
      const content = await readFile(this.config.historyPath, 'utf-8');
      this.history = JSON.parse(content);
    } catch {
      this.history = [];
    }
    
    this.historyLoaded = true;
  }
  
  private async saveHistory(): Promise<void> {
    if (!this.config.historyPath) return;
    
    try {
      await mkdir(dirname(this.config.historyPath), { recursive: true });
      await writeFile(this.config.historyPath, JSON.stringify(this.history, null, 2));
    } catch (err) {
      console.error('Failed to save STT history:', err);
    }
  }
  
  private generateId(): string {
    return `stt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async checkCommand(cmd: string): Promise<boolean> {
    try {
      await exec(`which ${cmd}`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// 默认配置
export function createDefaultConfig(): STTConfig {
  return {
    preferredEngine: 'local',
    local: {
      whisperPath: 'whisper',
      defaultModel: 'turbo',
      cacheDir: process.env.HOME 
        ? join(process.env.HOME, '.cache', 'whisper') 
        : '/tmp/whisper-cache',
    },
    api: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      timeout: 60000,
    },
    historyPath: '.stt-history.json',
    maxHistory: 100,
  };
}

// 单例
let defaultManager: STTManager | null = null;

export function getSTTManager(config?: Partial<STTConfig>): STTManager {
  if (!defaultManager) {
    defaultManager = new STTManager(config);
  }
  return defaultManager;
}
