/**
 * v17-external.test.ts - V17 外部集成测试
 * 
 * 测试内容:
 * - Web 抓取
 * - 网页搜索
 */

import { describe, it, expect } from 'vitest';
import { webFetch, webSearch, htmlToText, htmlToMarkdown } from '../v17-agent/external/web.js';

describe('V17 External Integration', () => {
  describe('webFetch', () => {
    it('should fetch example.com in text mode', async () => {
      const result = await webFetch({
        url: 'https://example.com',
        extractMode: 'text',
        maxChars: 1000
      });
      
      expect(result).toContain('Example Domain');
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    it('should fetch example.com in markdown mode', async () => {
      const result = await webFetch({
        url: 'https://example.com',
        extractMode: 'markdown',
        maxChars: 1000
      });
      
      expect(result).toContain('Example Domain');
    });

    it('should handle invalid URLs gracefully', async () => {
      await expect(webFetch({
        url: 'not-a-valid-url'
      })).rejects.toThrow();
    });

    it('should handle non-existent domains', async () => {
      await expect(webFetch({
        url: 'https://this-domain-definitely-does-not-exist-12345.com'
      })).rejects.toThrow();
    });
  });

  describe('webSearch', () => {
    it('should throw error without API key', async () => {
      await expect(webSearch({
        query: 'test'
      }, undefined)).rejects.toThrow('Brave Search API key required');
    });

    it('should throw error with empty API key', async () => {
      await expect(webSearch({
        query: 'test'
      }, '')).rejects.toThrow('Brave Search API key required');
    });
  });

  describe('HTML converters', () => {
    it('should convert HTML to text', () => {
      const html = '<p>Hello <strong>world</strong>!</p>';
      const text = htmlToText(html);
      expect(text).toContain('Hello world');
    });

    it('should remove scripts and styles', () => {
      const html = `
        <script>alert('xss')</script>
        <style>body{color:red}</style>
        <p>Content</p>
      `;
      const text = htmlToText(html);
      expect(text).not.toContain('script');
      expect(text).not.toContain('style');
      expect(text).toContain('Content');
    });

    it('should convert HTML to markdown', () => {
      const html = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em></p>';
      const md = htmlToMarkdown(html);
      expect(md).toContain('# Title');
      expect(md).toContain('**bold**');
      expect(md).toContain('*italic*');
    });

    it('should convert links to markdown', () => {
      const html = '<a href="https://example.com">Link text</a>';
      const md = htmlToMarkdown(html);
      expect(md).toContain('[Link text](https://example.com)');
    });

    it('should convert unordered lists', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const md = htmlToMarkdown(html);
      expect(md).toContain('- Item 1');
      expect(md).toContain('- Item 2');
    });
  });
});
