import _ from 'lodash';

// 支持的模型列表,基于官方API返回的模型
const SUPPORTED_MODELS = [
  // Kimi K2.5 模型
  {
    "id": "kimi-k2.5",
    "name": "Kimi-K2.5",
    "object": "model",
    "owned_by": "moonshot",
    "description": "Kimi K2.5 最新模型"
  },
  {
    "id": "kimi-k2.5-thinking",
    "name": "Kimi-K2.5-Thinking",
    "object": "model",
    "owned_by": "moonshot",
    "description": "Kimi K2.5 深度思考版"
  },
  {
    "id": "kimi-k2.5-search-thinking",
    "name": "Kimi-K2.5-Search-Thinking",
    "object": "model",
    "owned_by": "moonshot",
    "description": "同时开启联网搜索和深度思考的 K2.5 模型"
  },
  // kimi-k2 模型
  {
    "id": "kimi-k2-0905-preview",
    "name": "K2-0905",
    "object": "model",
    "owned_by": "moonshot",
    "description": "256k上下文,增强Agentic Coding能力和代码美观度"
  },
  {
    "id": "kimi-k2-thinking",
    "name": "K2-Thinking",
    "object": "model",
    "owned_by": "moonshot",
    "description": "K2长思考模型,256k上下文,多步工具调用和深度推理"
  },
  // 生成模型 moonshot-v1
  {
    "id": "moonshot-v1-8k",
    "name": "Moonshot-8K",
    "object": "model",
    "owned_by": "moonshot",
    "description": "生成短文本,8k上下文"
  },
  {
    "id": "moonshot-v1-32k",
    "name": "Moonshot-32K",
    "object": "model",
    "owned_by": "moonshot",
    "description": "生成长文本,32k上下文"
  },
  {
    "id": "moonshot-v1-128k",
    "name": "Moonshot-128K",
    "object": "model",
    "owned_by": "moonshot",
    "description": "生成超长文本,128k上下文"
  },
  {
    "id": "kimi-latest",
    "name": "Kimi-Latest",
    "object": "model",
    "owned_by": "moonshot",
    "description": "最新视觉模型,128k上下文图片理解"
  }
];

export default {
  prefix: '/v1',
  get: {
    '/models': async () => {
      return {
        "data": SUPPORTED_MODELS
      };
    }
  }
}

export function isValidModel(modelId: string): boolean {
  return SUPPORTED_MODELS.some(model => model.id === modelId);
}

export const DEFAULT_MODEL = "kimi-k2.5";
