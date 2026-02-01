/**
 * Connect RPC Chat Controller (V2)
 *
 * 使用 Connect RPC 协议的新版聊天控制器
 * 支持 Kimi K2.5 模型，并在对话完成后自动删除历史会话 [1][3]
 */
import { PassThrough } from "stream";
import type { Context } from 'koa';
import axios from 'axios';
import { ConnectRPCClient } from '@/lib/connect-rpc';
import type { ConnectConfig } from '@/lib/connect-rpc/types.ts';
import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import logger from '@/lib/logger.ts';
import util from '@/lib/util.ts';

/**
 * 自动删除会话记录 (TS 版本)
 * 适配最新 apiv2 Connect RPC 接口 [3]
 */
async function removeConversationV2(chatId: string, authToken: string) {
  const url = 'https://www.kimi.com/apiv2/kimi.chat.v1.ChatService/DeleteChat';
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'connect-protocol-version': '1', // 必须包含此标头 [3]
    'Origin': 'https://www.kimi.com',
    'Referer': 'https://www.kimi.com/chat/history'
  };

  // 根据反馈，参数名需为 chat_id
  const payload = { chat_id: chatId };

  try {
    // 延迟 2 秒执行，确保后端已完成会话创建同步
    setTimeout(async () => {
      try {
        await axios.post(url, payload, { headers });
        logger.info(`Automatically removed conversation: ${chatId}`);
      } catch (e: any) {
        logger.error(`Failed to remove conversation ${chatId}: ${e.message}`);
      }
    }, 2000);
  } catch (err) {
    // 忽略外部错误
  }
}

/**
 * 从 Authorization 头提取 Token [1]
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
 * 判断 Token 类型 [1]
 */
export function detectTokenType(token: string): 'jwt' | 'refresh' {
  if (token.startsWith('eyJ') && token.split('.').length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload.app_id === 'kimi' && payload.typ === 'access') {
        return 'jwt';
      }
    } catch (e) {}
  }
  return 'refresh';
}

/**
 * 使用 Connect RPC 创建聊天补全 [1]
 */
export async function createCompletionV2(
  model: string,
  messages: any[],
  authToken: string
): Promise<any> {
  logger.info(`Using Connect RPC API with model: ${model}`);

  const tokenType = detectTokenType(authToken);
  if (tokenType !== 'jwt') {
    throw new APIException(EX.API_REQUEST_FAILED, 'Connect RPC requires JWT token (kimi-auth).');
  }

  const lastMessage = messages[messages.length - 1];
  let messageContent = typeof lastMessage.content === 'string' 
    ? lastMessage.content 
    : lastMessage.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');

  const config: ConnectConfig = {
    baseUrl: 'https://www.kimi.com',
    authToken: authToken,
    deviceId: extractDeviceIdFromJWT(authToken),
    sessionId: extractSessionIdFromJWT(authToken),
    userId: extractUserIdFromJWT(authToken),
  };

  const client = new ConnectRPCClient(config);

  // 场景与工具逻辑
  let scenario = 'SCENARIO_K2';
  if (model.includes('k2.5')) {
    scenario = 'SCENARIO_K2D5';
  } else if (model.includes('search')) {
    scenario = 'SCENARIO_SEARCH';
  }

  const response = await client.chatText(messageContent, {
    scenario: scenario as any,
    thinking: model.includes('thinking'),
    tools: (model.includes('k2.5') && model.includes('search')) 
           ? [{ type: 'TOOL_TYPE_SEARCH', search: {} }] 
           : []
  });

  // 调用完成后自动删除历史会话 [3]
  if (response.chatId) {
    removeConversationV2(response.chatId, authToken);
  }

  return {
    id: response.chatId || util.uuid(),
    model: model,
    object: 'chat.completion',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: response.text },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: messageContent.length,
      completion_tokens: response.text.length,
      total_tokens: messageContent.length + response.text.length,
    },
    created: util.unixTimestamp(),
  };
}

/**
 * 使用 Connect RPC 创建流式聊天补全 [1]
 */
export async function createCompletionStreamV2(
  model: string,
  messages: any[],
  authToken: string
): Promise<PassThrough> {
  logger.info(`Using Connect RPC API (streaming) with model: ${model}`);

  const tokenType = detectTokenType(authToken);
  if (tokenType !== 'jwt') {
    throw new APIException(EX.API_REQUEST_FAILED, 'Connect RPC requires JWT token.');
  }

  const lastMessage = messages[messages.length - 1];
  let messageContent = typeof lastMessage.content === 'string' 
    ? lastMessage.content 
    : lastMessage.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');

  const config: ConnectConfig = {
    baseUrl: 'https://www.kimi.com',
    authToken: authToken,
    deviceId: extractDeviceIdFromJWT(authToken),
    sessionId: extractSessionIdFromJWT(authToken),
    userId: extractUserIdFromJWT(authToken),
  };

  const client = new ConnectRPCClient(config);

  let scenario = 'SCENARIO_K2';
  if (model.includes('k2.5')) {
    scenario = 'SCENARIO_K2D5';
  }

  const stream = new PassThrough();

  (async () => {
    try {
      const connectMessages = await client.chat(messageContent, {
        scenario: scenario as any,
        thinking: model.includes('thinking'),
        tools: (model.includes('k2.5') && model.includes('search')) 
               ? [{ type: 'TOOL_TYPE_SEARCH', search: {} }] 
               : []
      });

      let capturedChatId: string | undefined;

      for (const msg of connectMessages) {
        // 捕获 RPC 返回的 chatId [3]
        if (msg.chatId && !capturedChatId) {
          capturedChatId = msg.chatId;
        }

        if (msg.block?.text?.content) {
          const chunk = {
            id: util.uuid(),
            object: 'chat.completion.chunk',
            created: util.unixTimestamp(),
            model: model,
            choices: [{ index: 0, delta: { content: msg.block.text.content }, finish_reason: null }],
          };
          stream.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        
        if (msg.done) {
          // 对话流结束，执行删除操作 [3]
          if (capturedChatId) {
            removeConversationV2(capturedChatId, authToken);
          }
          const endChunk = {
            id: util.uuid(),
            object: 'chat.completion.chunk',
            created: util.unixTimestamp(),
            model: model,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          };
          stream.write(`data: ${JSON.stringify(endChunk)}\n\n`);
          stream.write('data:\n\n');
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

function extractDeviceIdFromJWT(token: string) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).device_id; } catch (e) { return undefined; }
}
function extractSessionIdFromJWT(token: string) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).ssid; } catch (e) { return undefined; }
}
function extractUserIdFromJWT(token: string) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub; } catch (e) { return undefined; }
}
