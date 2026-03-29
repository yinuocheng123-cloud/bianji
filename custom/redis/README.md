# 本机 Redis 运行说明

## 1. 用途
这组脚本用于在当前仓库下启动和停止本机 Redis 运行时，保证队列、任务流和自动链在本机开发环境里可重复恢复。

## 2. 启动命令

```powershell
powershell -ExecutionPolicy Bypass -File .\custom\redis\start-local-redis.ps1
```

## 3. 停止命令

```powershell
powershell -ExecutionPolicy Bypass -File .\custom\redis\stop-local-redis.ps1
```

## 4. 说明

- 当前默认运行时为 `custom/runtime/memurai-win/Memurai/`
- 默认监听 `6379`
- pid 文件位于 `custom/runtime-logs/redis-local.pid`
- 这组脚本属于本机开发/演示环境资产，不参与业务代码构建
