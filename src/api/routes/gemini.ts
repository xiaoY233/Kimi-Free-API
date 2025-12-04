import _ from 'lodash';

import Request from '@/lib/request/Request.ts';
import Response from '@/lib/response/Response.ts';
import { createGeminiCompletion } from '@/api/controllers/gemini-adapter.ts';

export default {

    prefix: '/v1beta',

    get: {
        '/models': async () => {
            return {
                models: [
                    {
                        name: 'models/gemini-1.5-pro',
                        displayName: 'Gemini 1.5 Pro',
                        description: 'Most capable model for complex reasoning tasks',
                        inputTokenLimit: 2097152,
                        outputTokenLimit: 8192,
                        supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
                    },
                    {
                        name: 'models/gemini-1.5-flash',
                        displayName: 'Gemini 1.5 Flash',
                        description: 'Fast model for high throughput',
                        inputTokenLimit: 1048576,
                        outputTokenLimit: 8192,
                        supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
                    },
                    {
                        name: 'models/gemini-pro',
                        displayName: 'Gemini Pro',
                        description: 'Previous generation model',
                        inputTokenLimit: 32768,
                        outputTokenLimit: 2048,
                        supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
                    },
                    {
                        name: 'models/kimi',
                        displayName: 'Kimi',
                        description: 'Kimi chat model via adapter',
                        inputTokenLimit: 32768,
                        outputTokenLimit: 8192,
                        supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
                    }
                ]
            };
        }
    },

    post: {

        // Gemini generateContent endpoint
        '/models/:model\\:generateContent': async (request: Request) => {
            request
                .validate('body.contents', _.isArray)
                .validate('body.systemInstruction', v => _.isUndefined(v) || _.isObject(v) || _.isString(v));

            // Get token from Authorization header (handle case insensitive) or x-goog-api-key header
            const authHeader = request.headers.authorization || request.headers.Authorization || request.headers['authorization'];
            const apiKey = request.headers['x-goog-api-key'];

            // Try Authorization header first, then x-goog-api-key
            const tokenHeader = authHeader || apiKey;

            if (!tokenHeader) {
                throw new Error('Missing Authorization header or x-goog-api-key. Please provide Bearer JWT token.');
            }

            // Remove Bearer prefix if present
            const authToken = tokenHeader.replace(/^Bearer\s+/i, '').trim();

            const model = request.params.model || 'gemini-pro';
            const { contents, systemInstruction } = request.body;

            const geminiResponse = await createGeminiCompletion(
                model,
                contents,
                systemInstruction,
                authToken,
                false
            );
            return geminiResponse;
        },

        // Gemini streamGenerateContent endpoint
        '/models/:model\\:streamGenerateContent': async (request: Request) => {
            request
                .validate('body.contents', _.isArray)
                .validate('body.systemInstruction', v => _.isUndefined(v) || _.isObject(v) || _.isString(v));

            // Debug: Log all headers to understand the issue
            console.log('DEBUG: All headers:', JSON.stringify(request.headers, null, 2));
            
            // Get token from Authorization header (handle case insensitive) or x-goog-api-key header
            const authHeader = request.headers.authorization || request.headers.Authorization || request.headers['authorization'];
            const apiKey = request.headers['x-goog-api-key'];
            console.log('DEBUG: Auth header found:', authHeader);
            console.log('DEBUG: API key found:', apiKey);

            // Try Authorization header first, then x-goog-api-key
            const tokenHeader = authHeader || apiKey;

            if (!tokenHeader) {
                throw new Error('Missing Authorization header or x-goog-api-key. Please provide Bearer JWT token.');
            }

            // Remove Bearer prefix if present
            const authToken = tokenHeader.replace(/^Bearer\s+/i, '').trim();

            const model = request.params.model || 'gemini-pro';
            const { contents, systemInstruction } = request.body;

            const geminiStream = await createGeminiCompletion(
                model,
                contents,
                systemInstruction,
                authToken,
                true
            );
            return new Response(geminiStream, {
                type: "text/event-stream"
            });
        }

    }

}