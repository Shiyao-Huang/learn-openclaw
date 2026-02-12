/**
 * v24-agent/audio/player.ts - 音频播放器
 * 
 * V24: 语音能力
 * 支持播放音频文件
 */

import { execSync, spawn } from "child_process";
import * as fs from "fs";
import type { PlaybackRequest, PlaybackResult } from "./types.js";

/** 音频播放器 */
export class AudioPlayer {
  private currentProcess: ReturnType<typeof spawn> | null = null;
  private isPlaying = false;

  /** 播放音频文件 */
  async play(request: PlaybackRequest): Promise<PlaybackResult> {
    // 检查文件是否存在
    if (!fs.existsSync(request.audioPath)) {
      return {
        success: false,
        error: `音频文件不存在: ${request.audioPath}`,
      };
    }

    try {
      // 根据平台选择播放方式
      const platform = process.platform;
      
      if (platform === "darwin") {
        // macOS - 使用 afplay
        return await this.playWithAfplay(request);
      } else if (platform === "linux") {
        // Linux - 使用 aplay 或 paplay
        return await this.playWithLinux(request);
      } else if (platform === "win32") {
        // Windows - 使用 PowerShell
        return await this.playWithWindows(request);
      }

      return {
        success: false,
        error: `不支持的平台: ${platform}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `播放失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /** 使用 afplay (macOS) 播放 */
  private async playWithAfplay(request: PlaybackRequest): Promise<PlaybackResult> {
    try {
      // 设置音量 (0-100)
      if (request.volume !== undefined) {
        const volume = Math.max(0, Math.min(100, request.volume)) / 100;
        execSync(`osascript -e "set volume output volume ${Math.round(volume * 100)}"`);
      }

      // 播放音频
      execSync(`afplay "${request.audioPath}"`, { timeout: 300000 });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `afplay 播放失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /** 使用 Linux 播放器 */
  private async playWithLinux(request: PlaybackRequest): Promise<PlaybackResult> {
    // 尝试使用 paplay (PulseAudio)
    try {
      execSync("which paplay", { stdio: "ignore" });
      execSync(`paplay "${request.audioPath}"`, { timeout: 300000 });
      return { success: true };
    } catch {
      // 回退到 aplay (ALSA)
      try {
        execSync("which aplay", { stdio: "ignore" });
        execSync(`aplay "${request.audioPath}"`, { timeout: 300000 });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: `没有可用的音频播放器 (尝试: paplay, aplay)`,
        };
      }
    }
  }

  /** 使用 Windows 播放器 */
  private async playWithWindows(request: PlaybackRequest): Promise<PlaybackResult> {
    try {
      const command = `powershell -c "(New-Object Media.SoundPlayer '${request.audioPath}').PlaySync()"`;
      execSync(command, { timeout: 300000 });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Windows 播放失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /** 停止播放 */
  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
    this.isPlaying = false;
  }

  /** 检查是否正在播放 */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /** 获取系统音量 (macOS) */
  getVolume(): number {
    try {
      if (process.platform === "darwin") {
        const result = execSync('osascript -e "output volume of (get volume settings)"', {
          encoding: "utf-8",
        });
        return parseInt(result.trim(), 10);
      }
      return -1;
    } catch {
      return -1;
    }
  }

  /** 设置系统音量 (macOS, 0-100) */
  setVolume(volume: number): boolean {
    try {
      if (process.platform === "darwin") {
        const clampedVolume = Math.max(0, Math.min(100, volume));
        execSync(`osascript -e "set volume output volume ${clampedVolume}"`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
