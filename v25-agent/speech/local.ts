/**
 * V25: 本地 Whisper 引擎
 * 
 * 使用 OpenAI Whisper CLI 进行本地转录
 * 优点: 免费、离线、无需 API key
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { access, mkdir, writeFile, unlink, readdir } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { createHash } from 'crypto';
import type { STTEngine, STTRequest, STTResult, STTModel, OutputFormat, LocalWhisperConfig } from './types.js';

const exec = promisify(execCallback);

export class WhisperLocalEngine implements STTEngine {
  readonly type = 'local' as const;
  readonly name = 'Whisper Local';
  
  private config: LocalWhisperConfig;
  private available: boolean | null = null;
  
  constructor(config: LocalWhisperConfig = {}) {
    this.config = {
      whisperPath: 'whisper',
      defaultModel: 'turbo',
      cacheDir: process.env.HOME ? join(process.env.HOME, '.cache', 'whisper') : '/tmp/whisper-cache',
      concurrency: 1,
      ...config,
    };
  }
  
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;
    
    try {
      const { stdout } = await exec('which whisper', { timeout: 5000 });
      this.available = stdout.trim().length > 0;
    } catch {
      this.available = false;
    }
    
    return this.available;
  }
  
  async transcribe(request: STTRequest): Promise<STTResult> {
    const startTime = Date.now();
    
    // 检查引擎可用性
    if (!await this.isAvailable()) {
      return {
        success: false,
        engine: 'local',
        error: 'Whisper CLI not found. Install with: brew install openai-whisper',
      };
    }
    
    // 获取输入文件路径
    let inputPath: string;
    let cleanupFiles: string[] = [];
    
    try {
      inputPath = await this.prepareInputFile(request.source);
      if (request.source.type === 'base64') {
        cleanupFiles.push(inputPath);
      }
    } catch (err) {
      return {
        success: false,
        engine: 'local',
        error: `Failed to prepare input: ${err}`,
      };
    }
    
    // 构建命令
    const model = request.model || this.config.defaultModel || 'turbo';
    const outputFormat = request.outputFormat || 'txt';
    const outputDir = request.outputDir || dirname(inputPath);
    
    // 确保输出目录存在
    await mkdir(outputDir, { recursive: true });
    
    const args = this.buildWhisperArgs(inputPath, {
      model: model as STTModel,
      outputFormat,
      outputDir,
      language: request.language,
      prompt: request.prompt,
      task: request.task,
    });
    
    try {
      // 执行 Whisper
      const { stdout, stderr } = await exec(
        `${this.config.whisperPath} ${args.join(' ')}`,
        { 
          timeout: 300000, // 5 分钟超时
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        }
      );
      
      // 读取输出文件
      const outputFileName = basename(inputPath, extname(inputPath));
      const outputPath = join(outputDir, `${outputFileName}.${outputFormat}`);
      
      let text = '';
      try {
        const { stdout: content } = await exec(`cat "${outputPath}"`);
        text = content;
      } catch {
        // 如果找不到输出文件，尝试从 stdout 解析
        text = this.parseWhisperOutput(stdout);
      }
      
      // 清理临时文件
      await this.cleanup(cleanupFiles);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        text: text.trim(),
        outputPath,
        engine: 'local',
        duration,
      };
      
    } catch (err: any) {
      await this.cleanup(cleanupFiles);
      
      return {
        success: false,
        engine: 'local',
        error: `Transcription failed: ${err.message}`,
        duration: Date.now() - startTime,
      };
    }
  }
  
  async getSupportedLanguages(): Promise<string[]> {
    // Whisper 支持 99+ 种语言
    return [
      'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr',
      'pl', 'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi',
      'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no',
      'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk',
      'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl', 'kn', 'et', 'mk',
      'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq', 'sw',
      'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc',
      'ka', 'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo',
      'ht', 'ps', 'tk', 'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl',
      'mg', 'as', 'tt', 'haw', 'ln', 'ha', 'ba', 'jw', 'su', 'yue',
    ];
  }
  
  private async prepareInputFile(source: STTRequest['source']): Promise<string> {
    switch (source.type) {
      case 'file':
        await access(source.path); // 验证文件存在
        return source.path;
        
      case 'url':
        // 下载文件到临时目录
        const tempDir = '/tmp/whisper-downloads';
        await mkdir(tempDir, { recursive: true });
        const urlHash = createHash('md5').update(source.url).digest('hex');
        const urlExt = source.url.split('.').pop() || 'mp3';
        const downloadPath = join(tempDir, `${urlHash}.${urlExt}`);
        
        await exec(`curl -sL "${source.url}" -o "${downloadPath}"`);
        return downloadPath;
        
      case 'base64':
        const buffer = Buffer.from(source.data, 'base64');
        const base64Dir = '/tmp/whisper-base64';
        await mkdir(base64Dir, { recursive: true });
        const base64Hash = createHash('md5').update(source.data).digest('hex');
        const base64Path = join(base64Dir, `${base64Hash}.${source.format}`);
        
        await writeFile(base64Path, buffer);
        return base64Path;
    }
  }
  
  private buildWhisperArgs(
    inputPath: string,
    options: {
      model: STTModel;
      outputFormat: OutputFormat;
      outputDir: string;
      language?: string;
      prompt?: string;
      task?: 'transcribe' | 'translate';
    }
  ): string[] {
    const args = [
      `"${inputPath}"`,
      '--model', options.model,
      '--output_format', options.outputFormat,
      '--output_dir', `"${options.outputDir}"`,
    ];
    
    if (options.language) {
      args.push('--language', options.language);
    }
    
    if (options.prompt) {
      args.push('--initial_prompt', `"${options.prompt}"`);
    }
    
    if (options.task === 'translate') {
      args.push('--task', 'translate');
    }
    
    return args;
  }
  
  private parseWhisperOutput(stdout: string): string {
    // 尝试从 Whisper 输出中提取文本
    const lines = stdout.split('\n');
    const textLines: string[] = [];
    
    for (const line of lines) {
      // Whisper 输出格式: [00:00:00.000 --> 00:00:05.000] 文本内容
      const match = line.match(/\[\d+:\d+:\d+\.\d+ --> \d+:\d+:\d+\.\d+\]\s*(.+)/);
      if (match) {
        textLines.push(match[1]);
      }
    }
    
    return textLines.join('\n');
  }
  
  private async cleanup(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await unlink(file);
      } catch {
        // 忽略清理错误
      }
    }
  }
}

export function createLocalEngine(config?: LocalWhisperConfig): WhisperLocalEngine {
  return new WhisperLocalEngine(config);
}
