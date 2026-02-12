/**
 * V25: OpenAI Whisper API 引擎
 * 
 * 使用 OpenAI Audio Transcriptions API 进行云端转录
 * 优点: 高质量、无需本地安装
 * 缺点: 需要 API key、有费用
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { access, readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { createHash } from 'crypto';
import type { STTEngine, STTRequest, STTResult, APIWhisperConfig, TranscriptSegment } from './types.js';

const exec = promisify(execCallback);

export class WhisperAPIEngine implements STTEngine {
  readonly type = 'api' as const;
  readonly name = 'OpenAI Whisper API';
  
  private config: APIWhisperConfig;
  private available: boolean | null = null;
  
  constructor(config: APIWhisperConfig = {}) {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'whisper-1',
      timeout: 60000,
      ...config,
    };
  }
  
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;
    
    // 检查 API key 是否配置
    const hasKey = !!(this.config.apiKey || process.env.OPENAI_API_KEY);
    
    // 可选: 验证 curl 可用
    try {
      await exec('which curl', { timeout: 5000 });
      this.available = hasKey;
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
        engine: 'api',
        error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.',
      };
    }
    
    // 获取输入文件路径
    let inputPath: string;
    let cleanupFiles: string[] = [];
    
    try {
      inputPath = await this.prepareInputFile(request.source);
      if (request.source.type === 'base64' || request.source.type === 'url') {
        cleanupFiles.push(inputPath);
      }
    } catch (err) {
      return {
        success: false,
        engine: 'api',
        error: `Failed to prepare input: ${err}`,
      };
    }
    
    try {
      // 调用 OpenAI API
      const result = await this.callOpenAIAPI(inputPath, request);
      
      // 清理临时文件
      await this.cleanup(cleanupFiles);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        text: result.text,
        detectedLanguage: result.language,
        engine: 'api',
        duration,
        timestamps: result.segments,
      };
      
    } catch (err: any) {
      await this.cleanup(cleanupFiles);
      
      return {
        success: false,
        engine: 'api',
        error: `API transcription failed: ${err.message}`,
        duration: Date.now() - startTime,
      };
    }
  }
  
  async getSupportedLanguages(): Promise<string[]> {
    // OpenAI Whisper API 支持的语言
    return [
      'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr',
      'pl', 'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi',
      'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no',
      'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk',
    ];
  }
  
  private async prepareInputFile(source: STTRequest['source']): Promise<string> {
    switch (source.type) {
      case 'file':
        await access(source.path);
        return source.path;
        
      case 'url':
        const tempDir = '/tmp/whisper-api-downloads';
        await mkdir(tempDir, { recursive: true });
        const urlHash = createHash('md5').update(source.url).digest('hex');
        const urlExt = source.url.split('.').pop() || 'mp3';
        const downloadPath = join(tempDir, `${urlHash}.${urlExt}`);
        
        await exec(`curl -sL "${source.url}" -o "${downloadPath}"`);
        return downloadPath;
        
      case 'base64':
        const buffer = Buffer.from(source.data, 'base64');
        const base64Dir = '/tmp/whisper-api-base64';
        await mkdir(base64Dir, { recursive: true });
        const base64Hash = createHash('md5').update(source.data).digest('hex');
        const base64Path = join(base64Dir, `${base64Hash}.${source.format}`);
        
        await writeFile(base64Path, buffer);
        return base64Path;
    }
  }
  
  private async callOpenAIAPI(
    filePath: string,
    request: STTRequest
  ): Promise<{ text: string; language?: string; segments?: TranscriptSegment[] }> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    
    // 构建 curl 命令
    const curlArgs = [
      '-s', '-X', 'POST',
      `"${baseUrl}/audio/transcriptions"`,
      '-H', `"Authorization: Bearer ${apiKey}"`,
      '-H', '"Content-Type: multipart/form-data"',
      '-F', `file=@"${filePath}"`,
      '-F', 'model="whisper-1"',
    ];
    
    if (request.language) {
      curlArgs.push('-F', `language="${request.language}"`);
    }
    
    if (request.prompt) {
      curlArgs.push('-F', `prompt="${request.prompt}"`);
    }
    
    if (request.task === 'translate') {
      // 对于翻译任务，使用 translations endpoint
      curlArgs[3] = `"${baseUrl}/audio/translations"`;
    }
    
    if (request.outputFormat === 'json' || request.outputFormat === 'vtt' || request.outputFormat === 'srt') {
      curlArgs.push('-F', `response_format="${request.outputFormat}"`);
    }
    
    const { stdout, stderr } = await exec(
      `curl ${curlArgs.join(' ')}`,
      { timeout: this.config.timeout || 60000 }
    );
    
    // 解析响应
    try {
      const response = JSON.parse(stdout);
      
      if (response.error) {
        throw new Error(response.error.message || 'Unknown API error');
      }
      
      return {
        text: response.text || '',
        language: response.language,
        segments: response.segments,
      };
    } catch (e) {
      // 如果不是 JSON，可能是纯文本响应
      if (stdout.trim()) {
        return { text: stdout.trim() };
      }
      throw new Error(`Failed to parse API response: ${stderr || stdout}`);
    }
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

export function createAPIEngine(config?: APIWhisperConfig): WhisperAPIEngine {
  return new WhisperAPIEngine(config);
}
