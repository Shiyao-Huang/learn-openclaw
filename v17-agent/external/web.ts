/**
 * external/web.ts - V17 Web 工具
 * 
 * 提供网页抓取和搜索能力
 */

import * as https from "https";
import * as http from "http";
import { URL } from "url";

export interface WebFetchOptions {
  url: string;
  extractMode?: "markdown" | "text";
  maxChars?: number;
}

export interface WebSearchOptions {
  query: string;
  count?: number;
  country?: string;
  search_lang?: string;
  freshness?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

const DEFAULT_USER_AGENT = 
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DEFAULT_MAX_CHARS = 50000;

/**
 * 获取网页内容
 */
export async function webFetch(options: WebFetchOptions): Promise<string> {
  const { url, extractMode = "markdown", maxChars = DEFAULT_MAX_CHARS } = options;
  
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;
      
      const request = client.get(
        parsedUrl,
        {
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          timeout: 30000,
        },
        (response) => {
          // 处理重定向
          if (response.statusCode === 301 || response.statusCode === 302) {
            const location = response.headers.location;
            if (location) {
              const redirectUrl = new URL(location, url).toString();
              webFetch({ url: redirectUrl, extractMode, maxChars })
                .then(resolve)
                .catch(reject);
              return;
            }
          }
          
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }
          
          let data = "";
          response.on("data", (chunk) => {
            data += chunk;
            if (data.length > maxChars * 2) {
              response.destroy();
              data = data.substring(0, maxChars * 2);
            }
          });
          
          response.on("end", () => {
            const content = extractMode === "text" 
              ? htmlToText(data).substring(0, maxChars)
              : htmlToMarkdown(data).substring(0, maxChars);
            resolve(content);
          });
          
          response.on("error", reject);
        }
      );
      
      request.on("error", reject);
      request.on("timeout", () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 搜索网页 (使用 Brave Search API)
 */
export async function webSearch(options: WebSearchOptions, apiKey?: string): Promise<WebSearchResult[]> {
  const { query, count = 5, country = "US", search_lang, freshness } = options;
  
  if (!apiKey) {
    throw new Error("Brave Search API key required. Set BRAVE_API_KEY in .env");
  }
  
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      q: query,
      count: Math.min(Math.max(1, count), 10).toString(),
      offset: "0",
      mkt: country,
      safesearch: "off",
    });
    
    if (search_lang) {
      params.append("lang", search_lang);
    }
    
    if (freshness && /^\d{4}-\d{2}-\d{2}to\d{4}-\d{2}-\d{2}$/.test(freshness)) {
      params.append("freshness", freshness);
    }
    
    const request = https.get(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": apiKey,
        },
        timeout: 30000,
      },
      (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Brave API HTTP ${response.statusCode}`));
          return;
        }
        
        let data = "";
        response.on("data", (chunk) => data += chunk);
        response.on("end", () => {
          try {
            const result = JSON.parse(data);
            const webResults = result.web?.results || [];
            const results: WebSearchResult[] = webResults.map((r: any) => ({
              title: r.title || "",
              url: r.url || "",
              description: r.description || "",
              age: r.age,
            }));
            resolve(results);
          } catch (error) {
            reject(new Error(`Failed to parse search results: ${error}`));
          }
        });
      }
    );
    
    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Search request timeout"));
    });
  });
}

/**
 * 简单的 HTML 到文本转换
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 简单的 HTML 到 Markdown 转换
 */
export function htmlToMarkdown(html: string): string {
  let md = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // 块级元素
  md = md
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "---\n\n");
  
  // 列表
  md = md
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
    })
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
      let index = 1;
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${index++}. $1\n`);
    });
  
  // 内联元素
  md = md
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  
  // 清理剩余标签
  md = md
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  
  return md;
}

/**
 * 获取 Web 工具定义
 */
export function getWebTools(): any[] {
  return [
    {
      name: "web_fetch",
      description: "Fetch and extract readable content from a URL (HTML → markdown/text). Use for lightweight page access without browser automation.",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string", description: "HTTP or HTTPS URL to fetch." },
          extractMode: { 
            type: "string", 
            enum: ["markdown", "text"],
            description: 'Extraction mode ("markdown" or "text").',
            default: "markdown"
          },
          maxChars: { 
            type: "number", 
            description: "Maximum characters to return (truncates when exceeded).",
            minimum: 100
          }
        },
        required: ["url"]
      }
    },
    {
      name: "web_search",
      description: "Search the web using Brave Search API. Supports region-specific and localized search via country and language parameters.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query string." },
          count: { 
            type: "number", 
            description: "Number of results to return (1-10).",
            minimum: 1,
            maximum: 10,
            default: 5
          },
          country: { 
            type: "string", 
            description: "2-letter country code for region-specific results (e.g., 'DE', 'US', 'ALL'). Default: 'US'."
          },
          search_lang: { 
            type: "string", 
            description: "ISO language code for search results (e.g., 'de', 'en', 'fr')."
          },
          freshness: { 
            type: "string", 
            description: "Filter results by discovery time (Brave only). Values: 'pd' (past 24h), 'pw' (past week), 'pm' (past month), 'py' (past year)."
          }
        },
        required: ["query"]
      }
    }
  ];
}

/**
 * 创建 Web 工具处理器
 */
export function createWebHandlers(apiKey?: string) {
  return {
    web_fetch: async (args: WebFetchOptions) => {
      try {
        const content = await webFetch(args);
        return {
          type: "text",
          text: content
        };
      } catch (error: any) {
        return {
          type: "text",
          text: `Error fetching ${args.url}: ${error.message}`
        };
      }
    },
    
    web_search: async (args: WebSearchOptions) => {
      try {
        const results = await webSearch(args, apiKey);
        const formatted = results.map((r, i) => 
          `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}${r.age ? ` [${r.age}]` : ""}`
        ).join("\n\n");
        
        return {
          type: "text",
          text: `## Search Results for "${args.query}"\n\n${formatted || "No results found."}`
        };
      } catch (error: any) {
        return {
          type: "text",
          text: `Error searching: ${error.message}`
        };
      }
    }
  };
}
