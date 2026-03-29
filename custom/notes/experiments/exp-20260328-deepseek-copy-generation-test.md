# 实验记录：exp-20260328-deepseek-copy-generation-test

## 实验目标

验证 DeepSeek 的 OpenAI 兼容接口是否可以在当前仓库环境中正常生成一段“木作涂装标准化”中文文案。

## 实验设定

- 运行位置：`D:\ceshi\bianji`
- SDK：仓库内已有 `openai` Node SDK
- base URL：`https://api.deepseek.com`
- model：`deepseek-chat`
- 调用方式：Node 临时脚本
- 密钥来源：临时环境变量注入，不写入仓库文件

## 关键变量

1. 第一次测试
   - 使用中文 system / user prompt
   - 在 PowerShell here-string 中直接传中文内容

2. 第二次测试
   - 改为英文 system / user prompt
   - 要求模型只输出最终中文文案
   - 用来排除本地命令行中文编码干扰

## 观察结果

### 第一次测试

- 结果：请求成功，但返回内容严重跑题
- 返回内容：一段不相关的数学题解

说明：
- API 已经联通
- 但不能证明“中文提示词在当前命令行注入方式下是稳定可用的”

### 第二次测试

- 结果：成功
- 返回内容：一段符合主题的中文文案，内容围绕工艺一致性、交付稳定性、色差控制、品质管理和客户体验展开

说明：
- DeepSeek API 本身可以正常工作
- 当前环境下，更稳的临时测试方式是：
  - 用英文测试 prompt
  - 让模型返回中文正文
- 前一次异常更像是本地命令行中文编码或提示词注入过程干扰，而不是 DeepSeek 接口故障

## 初步结论

1. DeepSeek 的 OpenAI 兼容接口在当前环境中可正常调用。
2. 若只看接口可用性，当前结论是“可正常使用”。
3. 本地临时命令行测试时，中文长提示词可能受到编码链路影响，建议：
   - 用英文测试 prompt
   - 或后续直接在项目内统一走 Provider 层与服务端模板渲染

## 是否值得继续

值得继续。

下一步最合理的方向是：

1. 把 DeepSeek 正式接入统一 AI Provider 层
2. 在 AI 配置中心增加 DeepSeek provider
3. 在服务端模板链路里完成 DeepSeek 的企业资料检索、结构化抽取和草稿生成联调
