<#
文件说明：本机 Redis 停止脚本。
功能说明：停止仓库内本机 Redis 进程，兼容 pid 文件和进程名两种停止方式。

结构概览：
  第一部分：基础路径
  第二部分：停止流程
#>

$ErrorActionPreference = "Stop"

# ========== 第一部分：基础路径 ==========
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$pidFile = Join-Path $root "custom\runtime-logs\redis-local.pid"
$memuraiCli = Join-Path $root "custom\runtime\memurai-win\Memurai\memurai-cli.exe"

function Test-RedisReady {
  if (!(Test-Path $memuraiCli)) {
    return $false
  }

  try {
    & $memuraiCli -p 6379 ping 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

# ========== 第二部分：停止流程 ==========
$wasRunning = Test-RedisReady

if (Test-Path $pidFile) {
  $pidValue = (Get-Content -Path $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($pidValue) {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $process.Id -Force
    }
  }

  Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
}

Get-Process | Where-Object { $_.ProcessName -like "memurai*" } | Stop-Process -Force -ErrorAction SilentlyContinue

if (Test-RedisReady) {
  throw "Local Redis stop command finished, but 6379 is still responding."
}

Write-Host ("Local Redis has been {0}." -f ($(if ($wasRunning) { "stopped" } else { "already stopped" })))
