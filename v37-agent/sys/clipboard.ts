/**
 * V37: 系统工具集 - 剪贴板引擎
 */

import { spawn } from "node:child_process";
import type { ClipboardResult } from "./types.js";

/**
 * 跨平台剪贴板复制
 */
export async function copyToClipboard(value: string): Promise<ClipboardResult> {
  const attempts: Array<{ argv: string[]; name: string }> = [
    { argv: ["pbcopy"], name: "pbcopy" },
    { argv: ["xclip", "-selection", "clipboard"], name: "xclip" },
    { argv: ["wl-copy"], name: "wl-copy" },
    { argv: ["clip.exe"], name: "clip.exe" },
    { argv: ["powershell", "-NoProfile", "-Command", "Set-Clipboard"], name: "powershell" },
  ];

  for (const attempt of attempts) {
    try {
      const result = await runWithInput(attempt.argv, value, 3000);
      if (result.success) {
        return { success: true, method: attempt.name };
      }
    } catch {
      // 继续尝试下一个
    }
  }

  return { success: false, error: "No clipboard tool available" };
}

/**
 * 跨平台剪贴板读取
 */
export async function pasteFromClipboard(): Promise<ClipboardResult & { content?: string }> {
  const attempts: Array<{ argv: string[]; name: string }> = [
    { argv: ["pbpaste"], name: "pbpaste" },
    { argv: ["xclip", "-selection", "clipboard", "-o"], name: "xclip" },
    { argv: ["wl-paste"], name: "wl-paste" },
    { argv: ["powershell", "-NoProfile", "-Command", "Get-Clipboard"], name: "powershell" },
  ];

  for (const attempt of attempts) {
    try {
      const result = await runAndCapture(attempt.argv, 3000);
      if (result.success && result.stdout) {
        return { success: true, method: attempt.name, content: result.stdout };
      }
    } catch {
      // 继续尝试下一个
    }
  }

  return { success: false, error: "No clipboard tool available" };
}

/**
 * 运行命令并输入内容
 */
function runWithInput(argv: string[], input: string, timeoutMs: number): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(argv[0], argv.slice(1), {
      stdio: ["pipe", "ignore", "ignore"],
    });

    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        proc.kill();
        resolve({ success: false });
      }
    }, timeoutMs);

    proc.on("error", () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ success: false });
      }
    });

    proc.on("close", (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ success: code === 0 });
      }
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

/**
 * 运行命令并捕获输出
 */
function runAndCapture(argv: string[], timeoutMs: number): Promise<{ success: boolean; stdout?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(argv[0], argv.slice(1), {
      stdio: ["ignore", "pipe", "ignore"],
    });

    let finished = false;
    let output = "";

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        proc.kill();
        resolve({ success: false });
      }
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("error", () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ success: false });
      }
    });

    proc.on("close", (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ success: code === 0, stdout: output.trim() });
      }
    });
  });
}
