/**
 * v25-agent/stt/stt.ts - STT (语音转文字) 引擎
 * 
 * V25: 语音识别
 * 支持多种 STT 提供商
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import crypto from "crypto";
import type {
  STTConfig,
  TranscribeRequest,
  TranscribeResult,
  STTHistory,
  STTProvider,
} from "./types.js";
import {
  DEFAULT_STT_CONFIG,
  SUPPORTED_AUDIO_FORMATS,
} from "./types.js";

/** STT 引擎 */
export class STTEngine {
  private config: STTConfig;
  private history: STTHistory[] = [];
  private historyFile: string;

  constructor(config: STTConfig) {
    this.config = config;
    this.historyFile = path.join(config.tempDir, "stt-history.json");
    this.loadHistory();
    this.ensureTempDir();
  }

  /** 确保临时目录存在 */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.config.tempDir)) {
      fs.mkdirSync(this.config.tempDir, { recursive: true });
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
      console.error("保存 STT 历史失败:", error);
    }
  }

  /** 转录音频 */
  async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    // 解析提供商
    const provider = this.resolveProvider(request.provider);
    const model = request.model || (provider === "openai" ? "whisper-1" : "base");

    // 准备音频文件
    let audioPath: string;
    try {
      audioPath = await this.prepareAudioFile(request);
    } catch (error) {
      return {
        success: false,
        text: "",
        provider,
        model,
        error: `音频文件准备失败: ${error}`,
      };
    }

    // 检查文件大小
    const stats = fs.statSync(audioPath);
    if (stats.size > this.config.maxFileSize) {
      return {
        success: false,
        text: "",
        provider,
        model,
        error: `文件过大 (${(stats.size / 1024 / 1024).toFixed(2)} MB), 最大支持 ${this.config.maxFileSize / 1024 / 1024} MB`,
      };
    }

    // 检查文件格式
    const ext = path.extname(audioPath).toLowerCase();
    if (!SUPPORTED_AUDIO_FORMATS.includes(ext)) {
      return {
        success: false,
        text: "",
        provider,
        model,
        error: `不支持的音频格式: ${ext}`,
      };
    }

    try {
      let result: TranscribeResult;

      switch (provider) {
        case "openai":
          result = await this.transcribeWithOpenAI(audioPath, request, model);
          break;
        case "local":
          result = await this.transcribeWithLocal(audioPath, request, model);
          break;
        default:
          return {
            success: false,
            text: "",
            provider,
            model,
            error: `不支持的提供商: ${provider}`,
          };
      }

      // 记录历史
      if (result.success) {
        this.addHistory({
          source: request.source,
          sourceType: request.sourceType,
          text: result.text,
          language: result.language,
          duration: result.duration,
          provider,
          model,
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        text: "",
        provider,
        model,
        error: `转录失败: ${error}`,
      };
    } finally {
      // 清理临时文件
      if (request.sourceType !== "file" && fs.existsSync(audioPath)) {
        try {
          fs.unlinkSync(audioPath);
        } catch {
          // 忽略清理错误
        }
      }
    }
  }

  /** 解析提供商 */
  private resolveProvider(requested?: STTProvider): STTProvider {
    if (requested && requested !== "auto") {
      return requested;
    }

    // 检查是否有 OpenAI API Key
    if (this.config.openaiApiKey) {
      return "openai";
    }

    // 检查是否有本地 Whisper
    if (this.checkLocalWhisper()) {
      return "local";
    }

    // 默认尝试 OpenAI
    return "openai";
  }

  /** 检查本地 Whisper 是否可用 */
  private checkLocalWhisper(): boolean {
    try {
      execSync("which whisper", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /** 准备音频文件 */
  private async prepareAudioFile(request: TranscribeRequest): Promise<string> {
    switch (request.sourceType) {
      case "file":
        if (!fs.existsSync(request.source)) {
          throw new Error(`文件不存在: ${request.source}`);
        }
        return request.source;

      case "url":
        return await this.downloadAudio(request.source);

      case "base64":
        return this.decodeBase64Audio(request.source);

      default:
        throw new Error(`不支持的源类型: ${request.sourceType}`);
    }
  }

  /** 下载音频文件 */
  private async downloadAudio(url: string): Promise<string> {
    const tempPath = path.join(
      this.config.tempDir,
      `audio-${Date.now()}.mp3`
    );

    // 使用 curl 下载
    execSync(`curl -sL "${url}" -o "${tempPath}"`, {
      timeout: 60000,
    });

    if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
      throw new Error("下载音频文件失败");
    }

    return tempPath;
  }

  /** 解码 Base64 音频 */
  private decodeBase64Audio(base64: string): string {
    const buffer = Buffer.from(base64, "base64");
    const tempPath = path.join(
      this.config.tempDir,
      `audio-${Date.now()}.mp3`
    );
    fs.writeFileSync(tempPath, buffer);
    return tempPath;
  }

  /** 使用 OpenAI Whisper API 转录 */
  private async transcribeWithOpenAI(
    audioPath: string,
    request: TranscribeRequest,
    model: string
  ): Promise<TranscribeResult> {
    if (!this.config.openaiApiKey) {
      return {
        success: false,
        text: "",
        provider: "openai",
        model,
        error: "未配置 OpenAI API Key",
      };
    }

    const formData = new FormData();
    formData.append("file", fs.createReadStream(audioPath));
    formData.append("model", model);

    if (request.language && request.language !== "auto") {
      formData.append("language", request.language);
    }

    if (request.outputFormat) {
      formData.append("response_format", request.outputFormat);
    }

    if (request.enableTimestamps) {
      formData.append("timestamp_granularities[]", "segment");
    }

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.openaiApiKey}`,
        },
        body: formData as any,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        text: "",
        provider: "openai",
        model,
        error: `OpenAI API 错误: ${response.status} - ${error}`,
      };
    }

    const data = await response.json();

    // 解析响应
    let text: string;
    let language: string | undefined;
    let duration: number | undefined;
    let segments: any[] | undefined;

    if (typeof data === "string") {
      text = data;
    } else {
      text = data.text || "";
      language = data.language;
      duration = data.duration;

      if (data.segments) {
        segments = data.segments.map((seg: any, i: number) => ({
          id: i,
          start: seg.start,
          end: seg.end,
          text: seg.text,
        }));
      }
    }

    return {
      success: true,
      text,
      language,
      duration,
      segments,
      provider: "openai",
      model,
    };
  }

  /** 使用本地 Whisper 转录 */
  private async transcribeWithLocal(
    audioPath: string,
    request: TranscribeRequest,
    model: string
  ): Promise<TranscribeResult> {
    if (!this.checkLocalWhisper()) {
      return {
        success: false,
        text: "",
        provider: "local",
        model,
        error: "本地 Whisper 未安装，请运行: pip install openai-whisper",
      };
    }

    const outputPath = path.join(
      this.config.tempDir,
      `transcript-${Date.now()}`
    );

    // 构建 whisper 命令
    const args = [
      "whisper",
      audioPath,
      "--model", model,
      "--output_dir", this.config.tempDir,
      "--output_format", request.enableTimestamps ? "json" : "txt",
    ];

    if (request.language && request.language !== "auto") {
      args.push("--language", request.language);
    }

    try {
      const output = execSync(args.join(" "), {
        timeout: 300000,  // 5 分钟
        encoding: "utf-8",
      });

      // 读取输出文件
      const txtPath = audioPath.replace(/\.[^.]+$/, ".txt");
      const jsonPath = audioPath.replace(/\.[^.]+$/, ".json");

      let text: string;
      let segments: any[] | undefined;

      if (fs.existsSync(jsonPath) && request.enableTimestamps) {
        const json = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        text = json.text || "";
        segments = json.segments?.map((seg: any, i: number) => ({
          id: i,
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        }));
      } else if (fs.existsSync(txtPath)) {
        text = fs.readFileSync(txtPath, "utf-8").trim();
      } else {
        text = output.trim();
      }

      // 清理输出文件
      [txtPath, jsonPath].forEach((p) => {
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p);
          } catch {}
        }
      });

      return {
        success: true,
        text,
        segments,
        provider: "local",
        model,
      };
    } catch (error) {
      return {
        success: false,
        text: "",
        provider: "local",
        model,
        error: `本地 Whisper 错误: ${error}`,
      };
    }
  }

  /** 添加历史记录 */
  private addHistory(entry: Omit<STTHistory, "id" | "timestamp">): void {
    const history: STTHistory = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.history.push(history);
    this.saveHistory();
  }

  /** 获取历史记录 */
  getHistory(limit: number = 20): STTHistory[] {
    return this.history.slice(-limit);
  }

  /** 清除历史记录 */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }
}

/** 获取音频时长 (秒) */
export function getAudioDuration(filePath: string): number | null {
  try {
    const output = execSync(
      `ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv="p=0"`,
      { encoding: "utf-8" }
    );
    return parseFloat(output.trim());
  } catch {
    return null;
  }
}
