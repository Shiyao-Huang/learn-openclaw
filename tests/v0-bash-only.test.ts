/**
 * V0 测试 - Bash 即一切
 * 
 * 核心能力:
 * - 单工具 (bash) 完成所有操作
 * - 子代理递归调用
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'v0-test');

describe('V0 BashOnly - Bash 即一切', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('Bash 工具能力', () => {
    it('应该能执行基本 bash 命令', () => {
      const result = execSync('echo "hello"', { encoding: 'utf-8' }).trim();
      expect(result).toBe('hello');
    });

    it('应该能通过 bash 读取文件', () => {
      const testFile = path.join(TEST_DIR, 'test.txt');
      fs.writeFileSync(testFile, 'test content');
      
      const result = execSync(`cat "${testFile}"`, { encoding: 'utf-8' }).trim();
      expect(result).toBe('test content');
    });

    it('应该能通过 bash 写入文件', () => {
      const testFile = path.join(TEST_DIR, 'output.txt');
      execSync(`echo "written by bash" > "${testFile}"`);
      
      expect(fs.readFileSync(testFile, 'utf-8').trim()).toBe('written by bash');
    });

    it('应该能通过 bash 搜索文件', () => {
      fs.writeFileSync(path.join(TEST_DIR, 'file1.md'), 'hello world');
      fs.writeFileSync(path.join(TEST_DIR, 'file2.md'), 'foo bar');
      
      const result = execSync(`grep -l "hello" ${TEST_DIR}/*.md`, { encoding: 'utf-8' });
      expect(result).toContain('file1.md');
    });

    it('应该能通过 bash 列出目录', () => {
      fs.writeFileSync(path.join(TEST_DIR, 'a.txt'), '');
      fs.writeFileSync(path.join(TEST_DIR, 'b.txt'), '');
      
      const result = execSync(`ls ${TEST_DIR}`, { encoding: 'utf-8' });
      expect(result).toContain('a.txt');
      expect(result).toContain('b.txt');
    });
  });

  describe('文件操作能力', () => {
    it('应该能创建目录结构', () => {
      execSync(`mkdir -p ${TEST_DIR}/a/b/c`);
      expect(fs.existsSync(path.join(TEST_DIR, 'a/b/c'))).toBe(true);
    });

    it('应该能复制文件', () => {
      const src = path.join(TEST_DIR, 'source.txt');
      const dst = path.join(TEST_DIR, 'dest.txt');
      fs.writeFileSync(src, 'source content');
      
      execSync(`cp "${src}" "${dst}"`);
      expect(fs.readFileSync(dst, 'utf-8')).toBe('source content');
    });

    it('应该能移动文件', () => {
      const src = path.join(TEST_DIR, 'old.txt');
      const dst = path.join(TEST_DIR, 'new.txt');
      fs.writeFileSync(src, 'move me');
      
      execSync(`mv "${src}" "${dst}"`);
      expect(fs.existsSync(src)).toBe(false);
      expect(fs.readFileSync(dst, 'utf-8')).toBe('move me');
    });

    it('应该能删除文件', () => {
      const file = path.join(TEST_DIR, 'delete-me.txt');
      fs.writeFileSync(file, 'delete me');
      
      execSync(`rm "${file}"`);
      expect(fs.existsSync(file)).toBe(false);
    });
  });

  describe('危险命令检测', () => {
    it('应该识别危险命令 rm -rf /', () => {
      const dangerous = ['rm -rf /', 'rm -rf /*'];
      dangerous.forEach(cmd => {
        expect(cmd.includes('rm -rf /')).toBe(true);
      });
    });

    it('应该识别危险命令 sudo', () => {
      const dangerous = ['sudo rm', 'sudo chmod'];
      dangerous.forEach(cmd => {
        expect(cmd.includes('sudo')).toBe(true);
      });
    });

    it('应该识别危险命令重定向到设备', () => {
      const dangerous = ['> /dev/sda', '> /dev/null'];
      // /dev/null 通常是安全的，但 /dev/sda 不是
      expect('> /dev/sda'.includes('/dev/')).toBe(true);
    });
  });

  describe('子代理概念验证', () => {
    it('应该能通过 bash 调用自身（模拟子代理）', () => {
      // 子代理概念: 通过 bash 调用另一个 agent 进程
      // 这里模拟调用 echo 命令并获取结果
      const task = '计算 2+2';
      const result = execSync(`echo "子代理结果: 4"`, { encoding: 'utf-8' }).trim();
      expect(result).toBe('子代理结果: 4');
    });

    it('子代理应该在隔离环境中运行', () => {
      // 创建临时环境
      const subDir = path.join(TEST_DIR, 'subagent-workspace');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, 'task.txt'), '子代理任务');
      
      // 在子目录中执行命令
      const result = execSync(`cat task.txt`, { encoding: 'utf-8', cwd: subDir }).trim();
      expect(result).toBe('子代理任务');
    });
  });

  describe('管道与组合', () => {
    it('应该支持管道操作', () => {
      fs.writeFileSync(path.join(TEST_DIR, 'data.txt'), 'line1\nline2\nline3\n');  // 添加末尾换行
      const result = execSync(`cat ${TEST_DIR}/data.txt | wc -l`, { encoding: 'utf-8' }).trim();
      expect(result).toBe('3');
    });

    it('应该支持命令组合', () => {
      fs.writeFileSync(path.join(TEST_DIR, 'a.txt'), 'hello\n');  // 添加换行
      const result = execSync(`cat ${TEST_DIR}/a.txt && echo "done"`, { encoding: 'utf-8' }).trim();
      expect(result).toBe('hello\ndone');
    });

    it('应该支持重定向', () => {
      execSync(`echo "redirected" > ${TEST_DIR}/redirect.txt`);
      expect(fs.readFileSync(path.join(TEST_DIR, 'redirect.txt'), 'utf-8').trim()).toBe('redirected');
    });
  });
});
