import _ from 'lodash';

// 支持的模型列表，基于官方API返回的模型
const SUPPORTED_MODELS = [
    // kimi-k2 模型
    {
        "id": "kimi-k2-0905-preview",
        "name": "K2-0905",
        "object": "model",
        "owned_by": "moonshot",
        "description": "256k上下文，增强Agentic Coding能力和代码美观度"
    },
    {
        "id": "kimi-k2-0711-preview", 
        "name": "K2-0711",
        "object": "model",
        "owned_by": "moonshot",
        "description": "128k上下文，1T参数MoE架构，强代码和Agent能力"
    },
    {
        "id": "kimi-k2-turbo-preview",
        "name": "K2-Turbo", 
        "object": "model",
        "owned_by": "moonshot",
        "description": "K2高速版本，256k上下文，60-100 tokens/s"
    },
    {
        "id": "kimi-k2-thinking",
        "name": "K2-Thinking",
        "object": "model", 
        "owned_by": "moonshot",
        "description": "K2长思考模型，256k上下文，多步工具调用和深度推理"
    },
    {
        "id": "kimi-k2-thinking-turbo",
        "name": "K2-Thinking-Turbo",
        "object": "model", 
        "owned_by": "moonshot",
        "description": "K2长思考高速版，256k上下文，深度推理60-100 tokens/s"
    },
    
    // 生成模型 moonshot-v1
    {
        "id": "moonshot-v1-8k",
        "name": "Moonshot-8K",
        "object": "model",
        "owned_by": "moonshot",
        "description": "生成短文本，8k上下文"
    },
    {
        "id": "moonshot-v1-32k", 
        "name": "Moonshot-32K",
        "object": "model",
        "owned_by": "moonshot",
        "description": "生成长文本，32k上下文"
    },
    {
        "id": "moonshot-v1-128k",
        "name": "Moonshot-128K", 
        "object": "model",
        "owned_by": "moonshot",
        "description": "生成超长文本，128k上下文"
    },
    {
        "id": "moonshot-v1-8k-vision-preview",
        "name": "Moonshot-Vision-8K",
        "object": "model", 
        "owned_by": "moonshot",
        "description": "视觉理解模型，8k上下文图文分析"
    },
    {
        "id": "moonshot-v1-32k-vision-preview",
        "name": "Moonshot-Vision-32K",
        "object": "model", 
        "owned_by": "moonshot",
        "description": "视觉理解模型，32k上下文图文分析"
    },
    {
        "id": "moonshot-v1-128k-vision-preview",
        "name": "Moonshot-Vision-128K",
        "object": "model", 
        "owned_by": "moonshot",
        "description": "视觉理解模型，128k上下文图文分析"
    },
    
    // 生成模型 kimi-latest
    {
        "id": "kimi-latest",
        "name": "Kimi-Latest",
        "object": "model",
        "owned_by": "moonshot", 
        "description": "最新视觉模型，128k上下文图片理解"
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

// 导出模型验证函数
export function isValidModel(modelId: string): boolean {
    return SUPPORTED_MODELS.some(model => model.id === modelId);
}

// 导出默认模型
export const DEFAULT_MODEL = "moonshot-v1-8k";