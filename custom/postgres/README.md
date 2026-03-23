# 本机 PostgreSQL 运行说明

## 1. 用途

这组脚本用于在当前仓库下启动和停止本机可携带 PostgreSQL，避免每次重启机器后手动恢复数据库。

## 2. 启动命令

```powershell
powershell -ExecutionPolicy Bypass -File .\custom\postgres\start-local-postgres.ps1
```

脚本会完成：

- 检查 PostgreSQL 运行文件是否存在
- 首次缺失时初始化数据目录
- 启动本机 `5432`
- 确保 `editorial` 数据库存在

## 3. 停止命令

```powershell
powershell -ExecutionPolicy Bypass -File .\custom\postgres\stop-local-postgres.ps1
```

## 4. 说明

- 运行文件位于 `custom/runtime/postgresql17/`
- 数据目录位于 `custom/runtime/postgresql17-data/`
- 日志文件位于 `custom/runtime/postgresql17-data/postgres.log`
- 这些运行文件属于本机环境资产，不参与业务代码构建
