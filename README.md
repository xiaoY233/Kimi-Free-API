# KIMI AI Free 服务


## 项目说明

<span>[ 中文 | <a href="README_EN.md">English</a> ]</span>

支持高速流式输出、支持多轮对话、支持联网搜索、支持智能体对话、支持探索版、支持K2思考模型、支持长文档解读、支持图像解析，零配置部署，多路token支持，自动清理会话痕迹。


本项目由[https://github.com/LLM-Red-Team/kimi-free-api](https://github.com/LLM-Red-Team/kimi-free-api)修改而来,感谢大佬的贡献!
> 重要提示：原项目由于供应链攻击，提交的代码内包含恶意代码，强烈建议不再继续使用。

修改原因：
1. 原项目作者账号被封，无法更新了
2. 已去除原项目中包含的恶意代码，欢迎对本项目源码进行审查

## 更新说明

1. 更新models.ts 模型列表，支持kimi-k2-0905-preview、kimi-k2-thinking、kimi-latest等最新模型

3. 重新打包新版本的docker镜像，`akashrajpuroh1t/kimi-free-api-fix:latest`

4. 已修复源码中恶意代码问题，并重新打包，原项目包含混淆代码在`src/api/chat.js`文件末尾处

> PS：模型名称实际上并没啥用，只是方便和好看，实际上线上Chat调用是啥模型，就用的啥模型，模型名称随便填都可以。

### 版本说明

- v1.0.0-fix (2025-11-25)
    - 修改默认首页样式，添加接入方式和示例代码
    - 去除原项目中包含的恶意代码

## 免责声明

**逆向API是不稳定的，建议前往MoonshotAI官方 https://platform.moonshot.cn/ 付费使用API，避免封禁的风险。**

**本组织和个人不接受任何资金捐助和交易，此项目是纯粹研究交流学习性质！**

**仅限自用，禁止对外提供服务或商用，避免对官方造成服务压力，否则风险自担！**

**仅限自用，禁止对外提供服务或商用，避免对官方造成服务压力，否则风险自担！**

**仅限自用，禁止对外提供服务或商用，避免对官方造成服务压力，否则风险自担！**

## 效果示例

### 验明正身Demo

![验明正身](./doc/example-1.png)

### 多轮对话Demo

![多轮对话](./doc/example-6.png)

### 联网搜索Demo

![联网搜索](./doc/example-2.png)

### 智能体对话Demo

此处使用 [翻译通](https://kimi.moonshot.cn/chat/coo6l3pkqq4ri39f36bg) 智能体。

![智能体对话](./doc/example-7.png)

### 长文档解读Demo

![长文档解读](./doc/example-5.png)

### 图像OCR Demo

![图像解析](./doc/example-3.png)

### 响应流畅度一致

![响应流畅度一致](https://github.com/LLM-Red-Team/kimi-free-api/assets/20235341/48c7ec00-2b03-46c4-95d0-452d3075219b)

## 接入准备

从 [kimi.moonshot.cn](https://kimi.moonshot.cn) 获取refresh_token

进入kimi随便发起一个对话，然后F12打开开发者工具，从Application > Local Storage中找到`refresh_token`的值，这将作为Authorization的Bearer Token值：`Authorization: Bearer TOKEN`

![example0](./doc/example-0.png)

如果你看到的`refresh_token`是一个数组，请使用`.`拼接起来再使用。

![example8](./doc/example-8.jpg)

### 多账号接入

目前kimi限制普通账号每3小时内只能进行30轮长文本的问答（短文本不限），你可以通过提供多个账号的refresh_token并使用`,`拼接提供：

`Authorization: Bearer TOKEN1,TOKEN2,TOKEN3`

每次请求服务会从中挑选一个。

## Docker部署

请准备能够部署Docker镜像且能够访问网络的设备或服务器，并将8000端口开放。

拉取镜像并启动服务

```shell
docker run -it -d --init --name kimi-free-api -p 8000:8000 -e TZ=Asia/Shanghai akashrajpuroh1t/kimi-free-api-fix:latest
```

查看服务实时日志

```shell
docker logs -f kimi-free-api
```

重启服务

```shell
docker restart kimi-free-api
```

停止服务

```shell
docker stop kimi-free-api
```

### Docker-compose部署

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

## 接口列表

目前支持与openai兼容的 `/v1/chat/completions` 接口，可自行使用与openai或其他兼容的客户端接入接口，或者使用 [dify](https://dify.ai/) 等线上服务接入使用。

### 对话补全

对话补全接口，与openai的 [chat-completions-api](https://platform.openai.com/docs/guides/text-generation/chat-completions-api) 兼容。

**POST /v1/chat/completions**

header 需要设置 Authorization 头部：

```
Authorization: Bearer [refresh_token]
```

请求数据：
```json
{
    // 模型名称
    // kimi：默认模型
    // kimi-search：联网检索模型
    // kimi-research：探索版模型
    // kimi-k1：K1模型
    // kimi-math：数学模型
    // kimi-silent：不输出检索过程模型
    // search/research/k1/math/silent：可自由组合使用
    // 如果使用kimi+智能体，model请填写智能体ID，就是浏览器地址栏上尾部的一串英文+数字20个字符的ID
    "model": "kimi-k2",
    // 目前多轮对话基于消息合并实现，某些场景可能导致能力下降且受单轮最大Token数限制
    // 如果您想获得原生的多轮对话体验，可以传入首轮消息获得的id，来接续上下文，注意如果使用这个，首轮必须传none，否则第二轮会空响应！
    // "conversation_id": "cnndivilnl96vah411dg",
    "messages": [
        {
            "role": "user",
            "content": "测试"
        }
    ],
    // 是否开启联网搜索，默认false
    "use_search": true,
    // 如果使用SSE流请设置为true，默认false
    "stream": false
}
```

响应数据：
```json
{
    // 如果想获得原生多轮对话体验，此id，你可以传入到下一轮对话的conversation_id来接续上下文
    "id": "cnndivilnl96vah411dg",
    "model": "kimi",
    "object": "chat.completion",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "你好！我是Kimi，由月之暗面科技有限公司开发的人工智能助手。我擅长中英文对话，可以帮助你获取信息、解答疑问，还能阅读和理解你提供的文件和网页内容。如果你有任何问题或需要帮助，随时告诉我！"
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

