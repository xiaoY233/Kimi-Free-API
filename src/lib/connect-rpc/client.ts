/**
 * Connect RPC Client
 * 
 * HTTP client for Connect RPC protocol
 */

import axios, { AxiosInstance } from 'axios';
import type { ConnectConfig, ChatOptions, ChatRequest, ConnectMessage, TextResponse } from './types.ts';
import {
    encodeConnectMessage,
    parseStreamingResponse,
    extractTextFromMessages,
    extractChatId,
    extractMessageId
} from './protocol.ts';
import logger from '@/lib/logger.ts';

/**
 * Connect RPC 客户端
 */
export class ConnectRPCClient {
    private config: ConnectConfig;
    private axios: AxiosInstance;

    /**
     * 构造函数
     * 
     * @param config - Connect RPC 配置
     */
    constructor(config: ConnectConfig) {
        this.config = config;

        // 创建 axios 实例
        this.axios = axios.create({
            baseURL: config.baseUrl,
            timeout: 60000,
            headers: {
                'Content-Type': 'application/connect+json',
                'Connect-Protocol-Version': '1',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Origin': config.baseUrl,
                'Referer': `${config.baseUrl}/`,
                'R-Timezone': 'Asia/Shanghai',
                'X-Language': 'zh-CN',
                'X-Msh-Platform': 'web',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            },
            validateStatus: () => true, // 不自动抛出错误
        });

        // 添加请求拦截器
        this.axios.interceptors.request.use((config) => {
            // 添加认证头
            if (this.config.authToken) {
                config.headers['Authorization'] = `Bearer ${this.config.authToken}`;
            }

            // 添加设备信息
            if (this.config.deviceId) {
                config.headers['X-Msh-Device-Id'] = this.config.deviceId;
            }

            if (this.config.sessionId) {
                config.headers['X-Msh-Session-Id'] = this.config.sessionId;
            }

            if (this.config.userId) {
                config.headers['X-Traffic-Id'] = this.config.userId;
            }

            return config;
        });
    }

    /**
     * 发送聊天消息
     * 
     * @param message - 消息内容
     * @param options - 聊天选项
     * @returns 响应消息数组
     */
    async chat(message: string, options: ChatOptions = {}): Promise<ConnectMessage[]> {
        const {
            scenario = 'SCENARIO_K2',
            thinking = false,
            stream = true
        } = options;

        // 构建请求数据
        const requestData: ChatRequest = {
            scenario,
            message: {
                role: 'user',
                blocks: [
                    {
                        message_id: '',
                        text: {
                            content: message
                        }
                    }
                ],
                scenario
            },
            options: {
                thinking
            }
        };

        // 编码为 Connect 格式
        const encodedData = encodeConnectMessage(requestData);

        logger.info(`Sending Connect RPC request: ${message.substring(0, 50)}...`);

        try {
            // 发送请求
            const response = await this.axios.post(
                '/apiv2/kimi.gateway.chat.v1.ChatService/Chat',
                encodedData,
                {
                    responseType: 'arraybuffer'
                }
            );

            // 检查响应状态
            if (response.status !== 200) {
                const errorText = Buffer.from(response.data).toString('utf-8');
                logger.error(`Connect RPC error: ${response.status} - ${errorText}`);
                throw new Error(`Connect RPC request failed: ${response.status}`);
            }

            // 解析响应
            const responseBuffer = Buffer.from(response.data);
            const messages = parseStreamingResponse(responseBuffer);

            logger.success(`Connect RPC response received: ${messages.length} messages`);

            return messages;

        } catch (error) {
            logger.error(`Connect RPC request error: ${error}`);
            throw error;
        }
    }

    /**
     * 发送聊天消息并实时流式回调每个解析到的帧
     * 使用 responseType: 'stream' 实现真正的流式传输
     *
     * @param message  - 消息内容
     * @param options  - 聊天选项
     * @param onMessage - 每解析到一个完整帧时调用
     */
    async chatStream(
        message: string,
        options: ChatOptions = {},
        onMessage: (msg: ConnectMessage) => void
    ): Promise<void> {
        const {
            scenario = 'SCENARIO_K2',
            thinking = false,
        } = options;

        const requestData: ChatRequest = {
            scenario,
            message: {
                role: 'user',
                blocks: [{ message_id: '', text: { content: message } }],
                scenario
            },
            options: { thinking }
        };

        const encodedData = encodeConnectMessage(requestData);
        logger.info(`Sending Connect RPC stream request: ${message.substring(0, 50)}...`);

        const response = await this.axios.post(
            '/apiv2/kimi.gateway.chat.v1.ChatService/Chat',
            encodedData,
            { responseType: 'stream' }
        );

        if (response.status !== 200) {
            throw new Error(`Connect RPC request failed: ${response.status}`);
        }

        await new Promise<void>((resolve, reject) => {
            // Rolling buffer — TCP may split frames across multiple data events
            let buf = Buffer.alloc(0);

            response.data.on('data', (chunk: Buffer) => {
                buf = Buffer.concat([buf, chunk]);

                // Parse as many complete frames as possible from the buffer
                while (buf.length >= 5) {
                    const frameLen = buf.readUInt32BE(1);
                    if (buf.length < 5 + frameLen) break; // incomplete frame, wait for more data

                    const frameData = buf.slice(0, 5 + frameLen);
                    buf = buf.slice(5 + frameLen);

                    try {
                        const jsonStr = frameData.slice(5).toString('utf-8');
                        const msg: ConnectMessage = JSON.parse(jsonStr);
                        onMessage(msg);
                    } catch (e) {
                        logger.error(`Frame parse error: ${e}`);
                    }
                }
            });

            response.data.once('end', resolve);
            response.data.once('error', reject);
        });
    }

    /**
     * 发送聊天消息并提取文本
     * 
     * @param message - 消息内容
     * @param options - 聊天选项
     * @returns 文本响应
     */
    async chatText(message: string, options: ChatOptions = {}): Promise<TextResponse> {
        const messages = await this.chat(message, options);

        return {
            text: extractTextFromMessages(messages),
            chatId: extractChatId(messages),
            messageId: extractMessageId(messages)
        };
    }
}

/**
 * 创建 Connect RPC 客户端
 * 
 * @param config - 配置对象
 * @returns Connect RPC 客户端实例
 */
export function createConnectClient(config: ConnectConfig): ConnectRPCClient {
    return new ConnectRPCClient(config);
}
