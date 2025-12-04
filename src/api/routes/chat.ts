import _ from 'lodash';

import Request from '@/lib/request/Request.ts';
import Response from '@/lib/response/Response.ts';
import chat from '@/api/controllers/chat.ts';
import { createCompletionV2, createCompletionStreamV2, detectTokenType } from '@/api/controllers/chat-v2.ts';
import logger from '@/lib/logger.ts';

export default {

    prefix: '/v1/chat',

    post: {

        '/completions': async (request: Request) => {
            request
                .validate('body.conversation_id', v => _.isUndefined(v) || _.isString(v))
                .validate('body.messages', _.isArray)
                .validate('headers.authorization', _.isString)

            // 提取 token (handle case insensitive)
            const authHeader = request.headers.authorization || request.headers.Authorization || request.headers['authorization'];
            const token = authHeader.replace(/^Bearer\s+/i, '').trim();

            // 检测 token 类型
            const tokenType = detectTokenType(token);

            let { model, conversation_id: convId, messages, stream, use_search } = request.body;

            if (use_search)
                model = 'kimi-search';

            // 根据 token 类型选择 API
            if (tokenType === 'jwt') {
                // 使用 Connect RPC API (V2)
                logger.info(`Using Connect RPC API (JWT token detected)`);

                if (stream) {
                    const streamResponse = await createCompletionStreamV2(model, messages, token);
                    return new Response(streamResponse, {
                        type: "text/event-stream"
                    });
                } else {
                    return await createCompletionV2(model, messages, token);
                }
            } else {
                // 使用传统 REST API (V1)
                logger.info(`Using traditional REST API (refresh token detected)`);

                // refresh_token切分
                const tokens = chat.tokenSplit(authHeader);
                // 随机挑选一个refresh_token
                const selectedToken = _.sample(tokens);

                if (stream) {
                    const streamResponse = await chat.createCompletionStream(model, messages, selectedToken, convId);
                    return new Response(streamResponse, {
                        type: "text/event-stream"
                    });
                } else {
                    return await chat.createCompletion(model, messages, selectedToken, convId);
                }
            }
        }

    }

};