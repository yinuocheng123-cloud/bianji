# 实验记录：exp-20260329-git-pull-config-fix

## 实验目标

修复本机仓库在执行 `git pull --ff-only` 时持续报错：

- `fatal: Cannot fast-forward to multiple branches.`

目标不是修改业务代码，而是恢复仓库的基础协作动作，确保后续每轮任务都能按要求先同步最新远端代码。

## 实验设定

- 仓库路径：`D:\ceshi\bianji`
- 远端：`origin -> https://github.com/yinuocheng123-cloud/bianji.git`
- 本地当前分支：`main`
- Git 版本：`2.53.0.windows.2`

## 关键变量

1. HTTPS 凭证链路
   - 之前多次 `fetch/pull` 失败时，报错是：
     - `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`
   - 这说明 Windows 的 HTTPS 凭证链路并不稳定。

2. 默认 pull 解析
   - 显式执行 `git pull --ff-only origin main` 可以成功。
   - 默认执行 `git pull --ff-only` 却报“multiple branches”。
   - 这说明问题不在远端分支本身，而在本地默认 pull 解析流程。

## 观察结果

### 1）基础配置检查

检查结果：

- `branch.main.remote = origin`
- `branch.main.merge = refs/heads/main`
- `remote.origin.fetch = +refs/heads/*:refs/remotes/origin/*`

表面上看配置正常，没有出现明显的多分支 merge 配置。

### 2）显式 pull 可成功

执行：

- `git pull --ff-only origin main`

结果：

- `Already up to date.`

说明：

- 仓库、远端和当前分支本身没有异常。
- 真正异常的是“默认 pull”的解析。

### 3）收窄 fetch refspec

将本地 `.git/config` 中的：

- `remote.origin.fetch = +refs/heads/*:refs/remotes/origin/*`

改为：

- `remote.origin.fetch = +refs/heads/main:refs/remotes/origin/main`

这样做的目的是尽量消除默认 pull 时对多分支 refspec 的歧义。

### 4）verbose pull 成功

执行：

- `git pull --verbose --ff-only`

结果：

- 正常返回 `Already up to date.`
- 明确只拉取了 `origin/main`

这一步说明默认 pull 的内部解析已经恢复到了正确路径。

### 5）普通 pull 再次验证成功

执行：

- `git pull --ff-only`

结果：

- `Already up to date.`

说明：

- 当前本机仓库已经恢复到了可以直接执行默认 fast-forward pull 的状态。

## 初步结论

1. 这次 `git pull --ff-only` 失败的核心问题，不是远端真的存在多分支合并关系，而是本地默认 pull 解析在当前 Git/配置组合下出现了歧义。
2. 将 `remote.origin.fetch` 从通配分支映射收窄到只跟踪 `main`，能稳定恢复默认 `pull --ff-only`。
3. HTTPS 凭证链路曾出现过 `SEC_E_NO_CREDENTIALS`，但在提权环境下 `fetch/pull` 能正常工作，因此当前更适合的做法是：
   - 继续使用 `origin/main`
   - 继续优先用提权后的 `git fetch --all --prune` / `git pull --ff-only`

## 是否值得继续

值得继续，但这条线目前已经够用，不需要继续扩大处理范围。

后续若再出现 Git 同步异常，优先排查顺序建议为：

1. 先看 HTTPS 凭证错误是否再次出现
2. 再看 `.git/config` 中 `remote.origin.fetch` 是否被改回通配映射
3. 最后再怀疑远端分支配置
