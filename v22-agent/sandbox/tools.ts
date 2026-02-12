/**
 * v22-agent/sandbox/tools.ts - 代码执行沙箱工具定义
 * 
 * V22: 代码执行沙箱 - 工具定义
 */

import { AnyTool } from "../../v11-agent/tools/common.js";

/** 代码执行工具 */
export const sandboxExecuteTool: AnyTool = {
  name: "sandbox_execute",
  description: `在沙箱环境中安全执行代码。支持 Python、JavaScript、TypeScript 和 Bash。

使用场景:
- 运行数据分析脚本
- 执行算法验证
- 快速原型测试
- 批量文件处理

安全特性:
- 自动代码扫描 (危险导入、eval、文件系统操作)
- 资源限制 (执行时间、内存、输出大小)
- 网络访问控制
- 文件系统隔离

示例:
{
  "language": "python",
  "code": "print('Hello, World!')\\nfor i in range(5):\\n    print(i)",
  "limits": { "maxExecutionTimeMs": 10000 }
}`,
  input_schema: {
    type: "object",
    properties: {
      language: {
        type: "string",
        enum: ["python", "javascript", "typescript", "bash"],
        description: "编程语言",
      },
      code: {
        type: "string",
        description: "要执行的代码",
      },
      inputs: {
        type: "object",
        description: "输入变量 (键值对)",
        additionalProperties: { type: "string" },
      },
      workingDir: {
        type: "string",
        description: "工作目录 (可选，默认项目目录)",
      },
      limits: {
        type: "object",
        description: "资源限制 (可选)",
        properties: {
          maxExecutionTimeMs: { type: "number", description: "最大执行时间 (毫秒)" },
          maxMemoryMb: { type: "number", description: "最大内存 (MB)" },
          maxOutputSize: { type: "number", description: "最大输出大小 (字节)" },
          allowNetwork: { type: "boolean", description: "是否允许网络访问" },
          allowFileWrite: { type: "boolean", description: "是否允许文件写入" },
          allowFileRead: { type: "boolean", description: "是否允许文件读取" },
        },
      },
    },
    required: ["language", "code"],
  },
};

/** 代码扫描工具 */
export const sandboxScanTool: AnyTool = {
  name: "sandbox_scan",
  description: `扫描代码的安全风险，不执行代码。

返回:
- 风险等级 (low/medium/high/critical)
- 发现的安全问题列表
- 是否通过扫描

使用场景:
- 代码审查
- 安全检查
- 教育演示`,
  input_schema: {
    type: "object",
    properties: {
      language: {
        type: "string",
        enum: ["python", "javascript", "typescript", "bash"],
        description: "编程语言",
      },
      code: {
        type: "string",
        description: "要扫描的代码",
      },
    },
    required: ["language", "code"],
  },
};

/** 依赖安装工具 */
export const sandboxInstallTool: AnyTool = {
  name: "sandbox_install",
  description: "安装代码依赖包。支持 pip (Python) 和 npm (JS/TS)。",
  input_schema: {
    type: "object",
    properties: {
      language: {
        type: "string",
        enum: ["python", "javascript", "typescript"],
        description: "编程语言",
      },
      packages: {
        type: "array",
        items: { type: "string" },
        description: "要安装的包名列表",
      },
      dev: {
        type: "boolean",
        description: "是否为开发依赖 (仅 JS/TS)",
      },
    },
    required: ["language", "packages"],
  },
};

/** 获取执行历史工具 */
export const sandboxHistoryTool: AnyTool = {
  name: "sandbox_history",
  description: "获取代码执行历史记录。",
  input_schema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "返回的最大记录数",
        default: 50,
      },
    },
  },
};

/** 获取沙箱状态工具 */
export const sandboxStatusTool: AnyTool = {
  name: "sandbox_status",
  description: "获取沙箱运行状态。",
  input_schema: {
    type: "object",
    properties: {},
  },
};

/** 获取所有沙箱工具 */
export function getSandboxTools(): AnyTool[] {
  return [
    sandboxExecuteTool,
    sandboxScanTool,
    sandboxInstallTool,
    sandboxHistoryTool,
    sandboxStatusTool,
  ];
}
