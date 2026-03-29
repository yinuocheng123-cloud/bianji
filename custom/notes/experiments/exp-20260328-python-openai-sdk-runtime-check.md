# 实验记录：exp-20260328-python-openai-sdk-runtime-check

## 实验目标

验证当前机器是否具备执行 `pip3 install openai` 与运行 Python 版 DeepSeek OpenAI 兼容示例的基础条件，并记录阻塞点与修正版示例。

## 实验设定

- 仓库路径：`D:\ceshi\bianji`
- 目标命令：
  - `python --version`
  - `pip3 show openai`
  - `where.exe python`
  - `where.exe py`
- 目标示例：
  - 使用 Python `openai` SDK
  - `base_url` 指向 `https://api.deepseek.com`
  - `model` 使用 `deepseek-chat`

## 关键变量

1. 当前机器是否存在可调用的 Python 解释器
2. 当前机器是否存在可调用的 `pip3`
3. 用户提供的示例中，环境变量读取方式是否正确

## 观察结果

### 1. Python 运行时状态

- `python --version` 执行失败
- `where.exe python` 未找到结果
- `where.exe py` 未找到结果

说明：

- 当前机器没有可直接调用的 Python 解释器
- 因此也无法继续执行 Python 脚本验证

### 2. pip 状态

- `pip3 show openai` 执行失败

说明：

- 当前机器没有可直接调用的 `pip3`
- 这意味着“先执行 `pip3 install openai`”在当前环境中无法落地

### 3. 用户示例中的代码问题

- `os.environ.get("你的 API Key 字面量")` 这种写法不正确

原因：

- `os.environ.get()` 的参数应该是环境变量名，而不是 API Key 本身

修正版示例：

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"},
    ],
    stream=False,
)

print(response.choices[0].message.content)
```

## 初步结论

1. 当前机器不具备直接执行 `pip3 install openai` 的前置条件，因为系统里没有可调用的 Python / pip。
2. 用户提供的示例核心调用思路是可行的，但环境变量读取方式需要修正。
3. 若只是验证 DeepSeek OpenAI 兼容接口，当前仓库已经可以直接复用 Node 侧现有 `openai` SDK，不必强依赖 Python。

## 是否值得继续

值得继续，但应先补足基础运行时，再决定是否走 Python 方案。

下一步更合理的顺序是：

1. 先安装 Python 3，并确认 `python` 或 `py` 可用
2. 再执行 `pip install openai`
3. 使用环境变量名 `DEEPSEEK_API_KEY` 运行修正版示例
