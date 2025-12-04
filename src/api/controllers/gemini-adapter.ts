import { PassThrough } from "stream";
import _ from "lodash";
import { createCompletionV2, createCompletionStreamV2 } from "@/api/controllers/chat-v2.ts";
import util from "@/lib/util.ts";
import logger from "@/lib/logger.ts";

const MODEL_NAME = "kimi";

/**
 * Convert Gemini contents format to Kimi format
 * 
 * @param contents Gemini contents array
 * @param systemInstruction Optional system instruction
 */
export function convertGeminiToKimi(contents: any[], systemInstruction?: any): any[] {
    const kimiMessages: any[] = [];

    // Handle system instruction
    let systemText = "";
    if (systemInstruction) {
        if (typeof systemInstruction === "string") {
            systemText = systemInstruction;
        } else if (systemInstruction.parts) {
            systemText = systemInstruction.parts
                .filter((part: any) => part.text)
                .map((part: any) => part.text)
                .join("\n");
        }
    }

    let systemPrepended = false;

    for (const content of contents) {
        const role = content.role === "model" ? "assistant" : "user";

        // Extract text from parts
        let text = "";
        if (content.parts && Array.isArray(content.parts)) {
            text = content.parts
                .filter((part: any) => part.text)
                .map((part: any) => part.text)
                .join("\n");
        }

        // Prepend system instruction to first user message
        if (role === "user" && systemText && !systemPrepended) {
            text = `${systemText}\n\n${text}`;
            systemPrepended = true;
        }

        kimiMessages.push({
            role: role,
            content: text
        });
    }

    return kimiMessages;
}

/**
 * Convert Kimi response to Gemini format
 * 
 * @param kimiResponse Kimi response object
 */
export function convertKimiToGemini(kimiResponse: any): any {
    const content = kimiResponse.choices[0].message.content;

    return {
        candidates: [
            {
                content: {
                    parts: [
                        {
                            text: content
                        }
                    ],
                    role: "model"
                },
                finishReason: kimiResponse.choices[0].finish_reason === "stop" ? "STOP" : "MAX_TOKENS",
                index: 0,
                safetyRatings: []
            }
        ],
        usageMetadata: {
            promptTokenCount: kimiResponse.usage?.prompt_tokens || 0,
            candidatesTokenCount: kimiResponse.usage?.completion_tokens || 0,
            totalTokenCount: kimiResponse.usage?.total_tokens || 0
        }
    };
}

/**
 * Convert Kimi stream to Gemini SSE format
 * 
 * @param kimiStream Kimi stream
 */
export function convertKimiStreamToGemini(kimiStream: any): PassThrough {
    const transStream = new PassThrough();
    let contentBuffer = "";
    let isFirstChunk = true;

    kimiStream.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n");

        for (const line of lines) {
            if (!line.trim() || line.trim() === "data: [DONE]") continue;

            if (line.startsWith("data: ")) {
                try {
                    const data = JSON.parse(line.slice(6));

                    if (data.choices && data.choices[0]) {
                        const delta = data.choices[0].delta;

                        // Handle content delta
                        if (delta.content) {
                            contentBuffer += delta.content;
                            const geminiChunk = {
                                candidates: [
                                    {
                                        content: {
                                            parts: [
                                                {
                                                    text: delta.content
                                                }
                                            ],
                                            role: "model"
                                        },
                                        finishReason: null,
                                        index: 0,
                                        safetyRatings: []
                                    }
                                ]
                            };
                            transStream.write(`data: ${JSON.stringify(geminiChunk)}\n\n`);
                        }

                        // Handle finish
                        if (data.choices[0].finish_reason) {
                            const finalChunk = {
                                candidates: [
                                    {
                                        content: {
                                            parts: [
                                                {
                                                    text: ""
                                                }
                                            ],
                                            role: "model"
                                        },
                                        finishReason: "STOP",
                                        index: 0,
                                        safetyRatings: []
                                    }
                                ],
                                usageMetadata: {
                                    promptTokenCount: data.usage?.prompt_tokens || 0,
                                    candidatesTokenCount: data.usage?.completion_tokens || 0,
                                    totalTokenCount: data.usage?.total_tokens || 0
                                }
                            };
                            transStream.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                            transStream.end();
                        }
                    }
                } catch (err) {
                    logger.error(`Error parsing stream chunk: ${err}`);
                }
            }
        }
    });

    kimiStream.on("error", (err: any) => {
        logger.error(`Kimi stream error: ${err}`);
        transStream.end();
    });

    kimiStream.on("close", () => {
        if (!transStream.closed) {
            transStream.end();
        }
    });

    return transStream;
}

/**
 * Create Gemini completion using Kimi backend (V2 API)
 * 
 * @param model Model name
 * @param contents Gemini contents
 * @param systemInstruction Optional system instruction
 * @param authToken Kimi JWT auth token (from Authorization header)
 * @param stream Whether to stream
 */
export async function createGeminiCompletion(
    model: string,
    contents: any[],
    systemInstruction: any,
    authToken: string,
    stream: boolean = false
): Promise<any | PassThrough> {
    try {
        // Convert Gemini format to Kimi format
        const kimiMessages = convertGeminiToKimi(contents, systemInstruction);

        if (stream) {
            // Use V2 API's native streaming support
            const kimiStream = await createCompletionStreamV2(
                model,
                kimiMessages,
                authToken
            );

            // Convert Kimi V2 stream to Gemini format
            return convertKimiStreamToGemini(kimiStream);
        } else {
            // Create regular completion using V2 API
            const kimiResponse = await createCompletionV2(
                model,
                kimiMessages,
                authToken
            );

            // Convert Kimi response to Gemini format
            return convertKimiToGemini(kimiResponse);
        }
    } catch (error) {
        logger.error(`Error creating Gemini completion: ${error}`);
        throw error;
    }
}