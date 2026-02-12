/**
 * v24-agent/audio/tts.ts - TTS (文字转语音) 引擎
 * 
 * V24: 语音能力
 * 支持多种 TTS 提供商
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import crypto from "crypto";
import type { 
  TTSRequest, 
  TTSResult, 
  TTSHistory, 
  AudioConfig, 
  VoiceOption 
} from "./types.js";
import { EDGE_VOICES, DEFAULT_AUDIO_FORMAT } from "./types.js";

/** TTS 引擎 */
export class TTSEngine {
  private config: AudioConfig;
  private history: TTSHistory[] = [];
  private historyFile: string;

  constructor(config: AudioConfig) {
    this.config = config;
    this.historyFile = path.join(config.outputDir, "tts-history.json");
    this.loadHistory();
    this.ensureOutputDir();
  }

  /** 确保输出目录存在 */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /** 加载历史记录 */
  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        this.history = JSON.parse(fs.readFileSync(this.historyFile, "utf-8"));
      }
    } catch {
      this.history = [];
    }
  }

  /** 保存历史记录 */
  private saveHistory(): void {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history.slice(-100), null, 2));
    } catch (error) {
      console.error("保存 TTS 历史失败:", error);
    }
  }

  /** 将文本转换为语音 */
  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const provider = request.provider || this.config.defaultProvider;
    const voice = request.voice || this.config.defaultVoice;
    const speed = request.speed || this.config.defaultSpeed;

    // 检查文本长度
    if (request.text.length > this.config.maxTextLength) {
      return {
        success: false,
        audioPath: "",
        format: DEFAULT_AUDIO_FORMAT,
        text: request.text,
        error: `文本过长 (${request.text.length} 字符), 最大支持 ${this.config.maxTextLength} 字符`,
      };
    }

    // 生成输出路径
    const outputPath = request.outputPath || this.generateOutputPath(request.text);

    // 检查缓存
    if (this.config.enableCache) {
      const cached = this.findInCache(request.text, voice);
      if (cached) {
        return {
          success: true,
          audioPath: cached,
          format: DEFAULT_AUDIO_FORMAT,
          text: request.text,
        };
      }
    }

    try {
      // 根据提供商执行不同的 TTS
      switch (provider) {
        case "edge":
          await this.synthesizeWithEdge(request.text, outputPath, voice, speed);
          break;
        case "local":
          await this.synthesizeWithLocal(request.text, outputPath);
          break;
        default:
          // 默认使用 Edge TTS
          await this.synthesizeWithEdge(request.text, outputPath, voice, speed);
      }

      // 获取音频信息
      const stats = fs.statSync(outputPath);
      const duration = await this.estimateDuration(outputPath);

      // 添加到历史
      const historyEntry: TTSHistory = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        text: request.text,
        audioPath: outputPath,
        duration,
        provider,
        voice,
      };
      this.history.push(historyEntry);
      this.saveHistory();

      return {
        success: true,
        audioPath: outputPath,
        duration,
        format: DEFAULT_AUDIO_FORMAT,
        text: request.text,
      };
    } catch (error) {
      return {
        success: false,
        audioPath: "",
        format: DEFAULT_AUDIO_FORMAT,
        text: request.text,
        error: `TTS 合成失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /** 使用 Edge TTS 合成 */
  private async synthesizeWithEdge(
    text: string, 
    outputPath: string, 
    voice: string,
    speed: number
  ): Promise<void> {
    // 检查 edge-tts 是否可用
    try {
      execSync("which edge-tts", { stdio: "ignore" });
    } catch {
      throw new Error("edge-tts 未安装。请运行: pip install edge-tts");
    }

    // 转义特殊字符
    const escapedText = text.replace(/"/g, '\\"');
    const rate = Math.round((speed - 1) * 100);
    const rateArg = rate !== 0 ? `--rate=${rate > 0 ? '+' : ''}${rate}%` : '';

    const command = `edge-tts --voice "${voice}" --text "${escapedText}" --write-media "${outputPath}" ${rateArg}`;
    
    execSync(command, { timeout: 60000 });

    if (!fs.existsSync(outputPath)) {
      throw new Error("TTS 合成失败: 未生成音频文件");
    }
  }

  /** 使用本地 TTS 合成 (macOS say 命令) */
  private async synthesizeWithLocal(text: string, outputPath: string): Promise<void> {
    const escapedText = text.replace(/"/g, '\\"');
    const command = `say "${escapedText}" -o "${outputPath}"`;
    
    execSync(command, { timeout: 60000 });

    if (!fs.existsSync(outputPath)) {
      throw new Error("本地 TTS 合成失败");
    }
  }

  /** 生成输出路径 */
  private generateOutputPath(text: string): string {
    const hash = crypto.createHash("md5").update(text).digest("hex").slice(0, 8);
    const timestamp = Date.now();
    return path.join(this.config.outputDir, `tts-${timestamp}-${hash}.mp3`);
  }

  /** 在缓存中查找 */
  private findInCache(text: string, voice: string): string | null {
    const hash = crypto.createHash("md5").update(text + voice).digest("hex");
    const cachedPath = path.join(this.config.outputDir, `cache-${hash}.mp3`);
    
    if (fs.existsSync(cachedPath)) {
      return cachedPath;
    }
    return null;
  }

  /** 估计音频时长 (粗略估算) */
  private async estimateDuration(audioPath: string): Promise<number> {
    try {
      // 使用 ffprobe 获取时长
      const result = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`, {
        encoding: "utf-8",
        timeout: 10000,
      });
      return parseFloat(result.trim()) || 0;
    } catch {
      // 粗略估算: 中文约 4 字/秒
      return 0;
    }
  }

  /** 获取可用的语音列表 */
  getAvailableVoices(): VoiceOption[] {
    return [...EDGE_VOICES];
  }

  /** 获取历史记录 */
  getHistory(limit?: number): TTSHistory[] {
    const sorted = [...this.history].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /** 清除历史 */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  /** 删除音频文件 */
  deleteAudio(audioPath: string): boolean {
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        // 从历史中移除
        this.history = this.history.filter(h => h.audioPath !== audioPath);
        this.saveHistory();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
