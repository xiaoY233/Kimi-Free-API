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
 */
function extractAuthToken(ctx: Context): string {
    const authorization = ctx.request.headers['authorization'];
    const apiKey = ctx.request.headers['x-goog-api-key'];



    let tokenHeader = authorization;
    if (!tokenHeader && apiKey) {
        tokenHeader = `Bearer ${apiKey}`;
    }

    if (!tokenHeader) {
        throw new APIException(EX.API_REQUEST_FAILED, 'Missing Authorization header or x-goog-api-key');
    }

    const token = tokenHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
        throw new APIException(EX.API_REQUEST_FAILED, 'Invalid Authorization header format');
    }

    return token;
}

/**
 * 判断 Token 类型
 */
export function detectTokenType(token: string): 'jwt' | 'refresh' {
    if (token.startsWith('eyJ') && token.split('.').length === 3) {
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (payload.app_id === 'kimi' && payload.typ === 'access') {
                return 'jwt';
            }
        } catch (e) {
            // 解析失败
        }
    }
    return 'refresh';
}

/**
 * 将模型名称映射到 Connect RPC 场景
 * 支持 kimi-k2.5 和 kimi-k2.5-thinking
 */
function resolveScenario(model: string): { scenario: string; thinking: boolean } {
    const thinking = model.includes('thinking');

    if (model.includes('k2.5')) {
        return { scenario: 'SCENARIO_K2_5', thinking };
    } else if (model.includes('search')) {
        return { scenario: 'SCENARIO_SEARCH', thinking };
    } else if (model.includes('research')) {
        return { scenario: 'SCENARIO_RESEARCH', thinking };
    } else if (model.includes('k1')) {
        return { scenario: 'SCENARIO_K1', thinking };
    } else {
        return { scenario: 'SCENARIO_K2', thinking };
    }
}

/**
 * Flatten the full messages array into a single string for the Connect RPC API.
 * Mirrors V1's messagesPrepare logic: single messages are passed through as-is;
 * multi-turn conversations are merged with role prefixes so Kimi sees full context.
 */
function prepareMessageContent(messages: any[]): string {
    if (messages.length === 0) return '';

    // Single message — pass content through directly
    if (messages.length === 1) {
        const msg = messages[0];
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
            return msg.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text || '')
                .join('\n');
        }
        return '';
    }

    // Multi-turn — flatten all turns with role prefixes
    return messages.map(msg => {
        let text = '';
        if (typeof msg.content === 'string') {
            text = msg.content;
        } else if (Array.isArray(msg.content)) {
            text = msg.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text || '')
                .join('\n');
        }
        return `${msg.role || 'user'}:${text}`;
    }).join('\n');
}

/**
 * 使用 Connect RPC 创建聊天补全
 */
export async function createCompletionV2(
    model: string,
    messages: any[],
    authToken: string
): Promise<any> {
    logger.info(`Using Connect RPC API with model: ${model}`);

    const tokenType = detectTokenType(authToken);

    if (tokenType !== 'jwt') {
        throw new APIException(
            EX.API_REQUEST_FAILED,
            'Connect RPC requires JWT token. Please extract kimi-auth from browser cookies. See docs/CONNECT_RPC_CONFIG_GUIDE.md'
        );
    }

    const messageContent = prepareMessageContent(messages);

    const config: ConnectConfig = {
        baseUrl: 'https://www.kimi.com',
        authToken: authToken,
        deviceId: extractDeviceIdFromJWT(authToken),
        sessionId: extractSessionIdFromJWT(authToken),
        userId: extractUserIdFromJWT(authToken),
    };

    const client = new ConnectRPCClient(config);

    const { scenario, thinking } = resolveScenario(model);
    logger.info(`Model: ${model} → scenario: ${scenario}, thinking: ${thinking}`);

    const response = await client.chatText(messageContent, {
        scenario: scenario as any,
        thinking,
    });

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
 */
export async function createCompletionStreamV2(
    model: string,
    messages: any[],
    authToken: string
): Promise<PassThrough> {
    logger.info(`Using Connect RPC API (streaming) with model: ${model}`);

    const tokenType = detectTokenType(authToken);

    if (tokenType !== 'jwt') {
        throw new APIException(
            EX.API_REQUEST_FAILED,
            'Connect RPC requires JWT token. Please extract kimi-auth from browser cookies.'
        );
    }

    const messageContent = prepareMessageContent(messages);

    const config: ConnectConfig = {
        baseUrl: 'https://www.kimi.com',
        authToken: authToken,
        deviceId: extractDeviceIdFromJWT(authToken),
        sessionId: extractSessionIdFromJWT(authToken),
        userId: extractUserIdFromJWT(authToken),
    };

    const client = new ConnectRPCClient(config);

    const { scenario, thinking } = resolveScenario(model);
    logger.info(`Model: ${model} → scenario: ${scenario}, thinking: ${thinking}`);

    const stream = new PassThrough();

    (async () => {
        try {
            const created = util.unixTimestamp();

            await client.chatStream(
                messageContent,
                { scenario: scenario as any, thinking },
                (msg) => {
                    // Text delta
                    if (msg.block?.text?.content) {
                        const chunk = {
                            id: util.uuid(),
                            object: 'chat.completion.chunk',
                            created,
                            model,
                            choices: [
                                {
                                    index: 0,
                                    delta: { content: msg.block.text.content },
                                    finish_reason: null,
                                },
                            ],
                        };
                        stream.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    }

                    // Done signal
                    if (msg.done) {
                        const endChunk = {
                            id: util.uuid(),
                            object: 'chat.completion.chunk',
                            created,
                            model,
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
                    }
                }
            );

            stream.end();
        } catch (error) {
            logger.error(`Connect RPC stream error: ${error}`);
            stream.destroy(error as Error);
        }
    })();

    return stream;
}
