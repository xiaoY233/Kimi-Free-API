/**
 * Connect RPC Chat Controller (V2)
 * 
 * 使用 Connect RPC 协议的新版聊天控制器
 * Token 从客户端请求的 Authorization 头中获取
 */

import { PassThrough } from "stream";
import type { Context } from 'koa';
import { ConnectRPCClient } from '@/lib/connect-rpc';
import type { ConnectConfig } from '@/lib/connect-rpc/types.ts';
import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import logger from '@/lib/logger.ts';
import util from '@/lib/util.ts';

// 模型名称
const MODEL_NAME = 'kimi';

/**
 * 从 Authorization 头提取 Token
 * 
 * 支持两种格式：
 * 1. Bearer <kimi-auth-jwt-token>  (Connect RPC 使用的 JWT)
 * 2. Bearer <refresh-token>         (传统 API 使用的 refresh token)
 * 3. x-goog-api-key: <token>        (也支持x-goog-api-key头)
 * 
 * @param ctx Koa Context
 * @returns Token 字符串
 */
function extractAuthToken(ctx: Context): string {
    const authorization = ctx.request.headers['authorization'];
    const apiKey = ctx.request.headers['x-goog-api-key'];

    // Debug logging
    console.log('DEBUG: All headers:', JSON.stringify(ctx.request.headers, null, 2));
    console.log('DEBUG: Auth header found:', authorization);
    console.log('DEBUG: API key found:', apiKey);

    // Try Authorization header first, then x-goog-api-key
    let tokenHeader = authorization;
    if (!tokenHeader && apiKey) {
        tokenHeader = `Bearer ${apiKey}`;
    }

    if (!tokenHeader) {
        throw new APIException(EX.API_REQUEST_FAILED, 'Missing Authorization header or x-goog-api-key');
    }

    // 移除 "Bearer " 前缀
    const token = tokenHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
        throw new APIException(EX.API_REQUEST_FAILED, 'Invalid Authorization header format');
    }

    return token;
}

/**
 * 判断 Token 类型
 * 
 * @param token Token 字符串
 * @returns 'jwt' | 'refresh'
 */
export function detectTokenType(token: string): 'jwt' | 'refresh' {
    // JWT token 通常以 "eyJ" 开头（Base64 编码的 JSON）
    // 且包含两个点分隔符
    if (token.startsWith('eyJ') && token.split('.').length === 3) {
        // 进一步验证：尝试解析 JWT payload
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            // 检查是否包含 Connect RPC JWT 的特征字段
            if (payload.app_id === 'kimi' && payload.typ === 'access') {
                return 'jwt';
            }
        } catch (e) {
            // 解析失败，可能是其他类型的 token
        }
    }

    // 默认作为 refresh token 处理（兼容现有 API）
    return 'refresh';
}

/**
 * 使用 Connect RPC 创建聊天补全
 * 
 * @param model 模型名称
 * @param messages 消息列表
 * @param authToken JWT Token (从 Authorization 头提取)
 * @returns 聊天响应
 */
export async function createCompletionV2(
    model: string,
    messages: any[],
    authToken: string
): Promise<any> {
    logger.info(`Using Connect RPC API with model: ${model}`);

    // 验证 Token 类型
    const tokenType = detectTokenType(authToken);

    if (tokenType !== 'jwt') {
        throw new APIException(
            EX.API_REQUEST_FAILED,
            'Connect RPC requires JWT token. Please extract kimi-auth from browser cookies. See docs/CONNECT_RPC_CONFIG_GUIDE.md'
        );
    }

    // 提取消息内容
    const lastMessage = messages[messages.length - 1];
    let messageContent = '';

    if (typeof lastMessage.content === 'string') {
        messageContent = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
        // 处理多模态内容
        messageContent = lastMessage.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
    }

    // 创建 Connect RPC 配置
    const config: ConnectConfig = {
        baseUrl: 'https://www.kimi.com',
        authToken: authToken,
        // 可选：从 JWT 中解析这些值
        deviceId: extractDeviceIdFromJWT(authToken),
        sessionId: extractSessionIdFromJWT(authToken),
        userId: extractUserIdFromJWT(authToken),
    };

    // 创建客户端
    const client = new ConnectRPCClient(config);

    // 确定场景类型
    let scenario = 'SCENARIO_K2';
    if (model.includes('search')) {
        scenario = 'SCENARIO_SEARCH';
    } else if (model.includes('research')) {
        scenario = 'SCENARIO_RESEARCH';
    } else if (model.includes('k1')) {
        scenario = 'SCENARIO_K1';
    }

    // 发送请求
    const response = await client.chatText(messageContent, {
        scenario: scenario as any,
        thinking: model.includes('thinking'),
    });

    // 转换为 OpenAI 兼容格式
    return {
        id: response.chatId || util.uuid(),
        model: model,
        object: 'chat.completion',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: response.text,
                },
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: messageContent.length,
            completion_tokens: response.text.length,
            total_tokens: messageContent.length + response.text.length,
        },
        created: util.unixTimestamp(),
    };
}

/**
 * 从 JWT Token 中提取设备 ID
 */
function extractDeviceIdFromJWT(token: string): string | undefined {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.device_id;
    } catch (e) {
        return undefined;
    }
}

/**
 * 从 JWT Token 中提取会话 ID
 */
function extractSessionIdFromJWT(token: string): string | undefined {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.ssid;
    } catch (e) {
        return undefined;
    }
}

/**
 * 从 JWT Token 中提取用户 ID
 */
function extractUserIdFromJWT(token: string): string | undefined {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sub;
    } catch (e) {
        return undefined;
    }
}

/**
 * 使用 Connect RPC 创建流式聊天补全
 * 
 * @param model 模型名称
 * @param messages 消息列表
 * @param authToken JWT Token
 * @returns 流式响应
 */
export async function createCompletionStreamV2(
    model: string,
    messages: any[],
    authToken: string
): Promise<PassThrough> {
    logger.info(`Using Connect RPC API (streaming) with model: ${model}`);

    // 验证 Token 类型
    const tokenType = detectTokenType(authToken);

    if (tokenType !== 'jwt') {
        throw new APIException(
            EX.API_REQUEST_FAILED,
            'Connect RPC requires JWT token. Please extract kimi-auth from browser cookies.'
        );
    }

    // 提取消息内容
    const lastMessage = messages[messages.length - 1];
    let messageContent = '';

    if (typeof lastMessage.content === 'string') {
        messageContent = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
        messageContent = lastMessage.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
    }

    // 创建配置
    const config: ConnectConfig = {
        baseUrl: 'https://www.kimi.com',
        authToken: authToken,
        deviceId: extractDeviceIdFromJWT(authToken),
        sessionId: extractSessionIdFromJWT(authToken),
        userId: extractUserIdFromJWT(authToken),
    };

    // 创建客户端
    const client = new ConnectRPCClient(config);

    // 确定场景
    let scenario = 'SCENARIO_K2';
    if (model.includes('search')) {
        scenario = 'SCENARIO_SEARCH';
    } else if (model.includes('research')) {
        scenario = 'SCENARIO_RESEARCH';
    } else if (model.includes('k1')) {
        scenario = 'SCENARIO_K1';
    }

    // 创建流
    const stream = new PassThrough();

    // 异步处理
    (async () => {
        try {
            const connectMessages = await client.chat(messageContent, {
                scenario: scenario as any,
                thinking: model.includes('thinking'),
            });

            // 转换为 SSE 格式
            for (const msg of connectMessages) {
                if (msg.block?.text?.content) {
                    const chunk = {
                        id: util.uuid(),
                        object: 'chat.completion.chunk',
                        created: util.unixTimestamp(),
                        model: model,
                        choices: [
                            {
                                index: 0,
                                delta: {
                                    content: msg.block.text.content,
                                },
                                finish_reason: null,
                            },
                        ],
                    };

                    stream.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }

                if (msg.done) {
                    // 发送结束标记
                    const endChunk = {
                        id: util.uuid(),
                        object: 'chat.completion.chunk',
                        created: util.unixTimestamp(),
                        model: model,
                        choices: [
                            {
                                index: 0,
                                delta: {},
                                finish_reason: 'stop',
                            },
                        ],
                    };

                    stream.write(`data: ${JSON.stringify(endChunk)}\n\n`);
                    stream.write('data: [DONE]\n\n');
                    break;
                }
            }

            stream.end();
        } catch (error) {
            logger.error(`Connect RPC stream error: ${error}`);
            stream.destroy(error as Error);
        }
    })();

    return stream;
}
