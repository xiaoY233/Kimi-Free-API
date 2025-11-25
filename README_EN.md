# KIMI AI Free Service

## Project Description

<span>[ <a href="README.md">中文</a> | English ]</span>

Supports high-speed streaming output, multi-turn conversations, internet search, agent conversations, exploration version, K2 thinking model, long document analysis, image parsing, zero-configuration deployment, multi-token support, and automatic session cleanup.

This project is modified from [https://github.com/LLM-Red-Team/kimi-free-api](https://github.com/LLM-Red-Team/kimi-free-api), thanks to the contributor!
> Important Note: The original project contains malicious code due to supply chain attacks. It is strongly recommended not to continue using it.

Reasons for modification:
1. The original project author account was banned and can no longer be updated
2. The malicious code in the original project has been removed. Welcome to review this project's source code

## Update Notes

1. Updated models.ts model list to support latest models like kimi-k2-0905-preview, kimi-k2-thinking, kimi-latest, etc.

3. Repackaged new version of Docker image: `akashrajpuroh1t/kimi-free-api-fix:latest`

4. Fixed malicious code issues in source code and repackaged. The original project contained obfuscated code at the end of `src/api/chat.js` file

> PS: Model names don't actually matter much, just for convenience and aesthetics. Whatever model is used online in Chat calls is the actual model used. You can fill in any model name.

### Version Notes

- v1.0.0-fix (2025-11-25)
    - Modified default homepage style, added access methods and example code
    - Removed malicious code contained in the original project

## Disclaimer

**Reversed APIs are unstable. It is recommended to use the paid API from MoonshotAI official https://platform.moonshot.cn/ to avoid the risk of being banned.**

**This organization and individuals do not accept any fund donations or transactions. This project is purely for research, communication, and learning purposes!**

**For personal use only, prohibited from providing services to others or commercial use, to avoid pressure on official services. Otherwise, risks are borne by oneself!**

**For personal use only, prohibited from providing services to others or commercial use, to avoid pressure on official services. Otherwise, risks are borne by oneself!**

**For personal use only, prohibited from providing services to others or commercial use, to avoid pressure on official services. Otherwise, risks are borne by oneself!**

## Effect Examples

### Identity Verification Demo

![Identity Verification](./doc/example-1.png)

### Multi-turn Conversation Demo

![Multi-turn Conversation](./doc/example-6.png)

### Internet Search Demo

![Internet Search](./doc/example-2.png)

### Agent Conversation Demo

This uses the [Translation Agent](https://kimi.moonshot.cn/chat/coo6l3pkqq4ri39f36bg) agent.

![Agent Conversation](./doc/example-7.png)

### Long Document Analysis Demo

![Long Document Analysis](./doc/example-5.png)

### Image OCR Demo

![Image Parsing](./doc/example-3.png)

### Consistent Response Fluency

![Consistent Response Fluency](https://github.com/LLM-Red-Team/kimi-free-api/assets/20235341/48c7ec00-2b03-46c4-95d0-452d3075219b)

## Access Preparation

Get refresh_token from [kimi.moonshot.cn](https://kimi.moonshot.cn)

Start any conversation on Kimi, then open developer tools with F12, find the value of `refresh_token` in Application > Local Storage. This will be used as the Bearer Token value for Authorization: `Authorization: Bearer TOKEN`

![example0](./doc/example-0.png)

If you see that `refresh_token` is an array, please use `.` to concatenate it before using.

![example8](./doc/example-8.jpg)

### Multi-account Access

Currently, Kimi limits ordinary accounts to only 30 rounds of long text Q&A every 3 hours (short text is unlimited). You can provide multiple account refresh_tokens separated by commas:

`Authorization: Bearer TOKEN1,TOKEN2,TOKEN3`

The service will select one from them for each request.

## Docker Deployment

Please prepare a device or server that can deploy Docker images and access the network, and open port 8000.

Pull the image and start the service

```shell
docker run -it -d --init --name kimi-free-api -p 8000:8000 -e TZ=Asia/Shanghai akashrajpuroh1t/kimi-free-api-fix:latest
```

View service real-time logs

```shell
docker logs -f kimi-free-api
```

Restart service

```shell
docker restart kimi-free-api
```

Stop service

```shell
docker stop kimi-free-api
```

### Docker-compose Deployment

```yaml
version: '3'

services:
  kimi-free-api:
    container_name: kimi-free-api
    image: akashrajpuroh1t/kimi-free-api-fix:latest
    restart: always
    ports:
      - "8000:8000"
    environment:
      - TZ=Asia/Shanghai
```

## API List

Currently supports OpenAI-compatible `/v1/chat/completions` interface. You can use OpenAI or other compatible client interfaces, or use online services like [dify](https://dify.ai/) for access.

### Chat Completions

Chat completions API, compatible with OpenAI's [chat-completions-api](https://platform.openai.com/docs/guides/text-generation/chat-completions-api).

**POST /v1/chat/completions**

Headers need to set Authorization:

```
Authorization: Bearer [refresh_token]
```

Request data:
```json
{
    // Model name
    // kimi: default model
    // kimi-search: internet search model
    // kimi-research: exploration version model
    // kimi-k1: K1 model
    // kimi-math: math model
    // kimi-silent: no search process output model
    // search/research/k1/math/silent: can be freely combined
    // If using kimi+agent, please fill in the agent ID in model, which is the 20-character English+numbers ID at the end of the browser address bar
    "model": "kimi-k2",
    // Currently multi-turn conversations are implemented based on message merging, which may lead to degraded capabilities in some scenarios and is subject to single-round maximum token limits
    // If you want to get native multi-turn conversation experience, you can pass the id obtained from the first round of messages to continue context. Note that if using this, the first round must pass 'none', otherwise the second round will return empty response!
    // "conversation_id": "cnndivilnl96vah411dg",
    "messages": [
        {
            "role": "user",
            "content": "Test"
        }
    ],
    // Whether to enable internet search, default false
    "use_search": true,
    // Set to true if using SSE stream, default false
    "stream": false
}
```

Response data:
```json
{
    // If you want to get native multi-turn conversation experience, this id can be passed to the next round's conversation_id to continue context
    "id": "cnndivilnl96vah411dg",
    "model": "kimi",
    "object": "chat.completion",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "Hello! I'm Kimi, an AI assistant developed by Moonshot AI Technology Co., Ltd. I'm skilled in Chinese and English conversations, can help you get information, answer questions, and can also read and understand files and web page content you provide. If you have any questions or need help, feel free to tell me!"
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 1,
        "completion_tokens": 1,
        "total_tokens": 2
    },
    "created": 1710152062
}
```