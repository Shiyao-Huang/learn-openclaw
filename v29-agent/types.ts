/**
 * V29: 通用类型定义
 */

export type Tool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

export type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;
