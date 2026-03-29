<#
文件说明：本机 PostgreSQL 停止脚本。
功能说明：优先停止仓库内本机 PostgreSQL 进程，并兼容 pg_ctl 与直启 postgres.exe 两种启动方式。

结构概览：
  第一部分：基础路径与进程定位
  第二部分：数据库停止流程
#>

$ErrorActionPreference = "Stop"

# ========== 第一部分：基础路径与进程定位 ==========
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$runtimeCandidates = @(
  (Join-Path $root "custom\runtime\postgresql17\pgsql"),
  (Join-Path $root "custom\runtime\postgresql16\pgsql")
) | Where-Object { Test-Path (Join-Path $_ "bin\pg_ctl.exe") }
$pgRoot = $runtimeCandidates | Select-Object -First 1
$dataDirCandidates = @(
  $env:ZMW_PG_DATA_DIR,
  (Join-Path $root "custom\runtime\postgresql17-data-fresh"),
  (Join-Path $root "custom\runtime\postgresql17-data"),
  (Join-Path $root "custom\runtime\postgresql16-data")
) | Where-Object { $_ -and (Test-Path $_) }
$dataDir = $dataDirCandidates | Select-Object -First 1
$pgCtl = Join-Path $pgRoot "bin\pg_ctl.exe"
$pidFile = Join-Path $root "custom\runtime-logs\postgres-local.pid"

if (!(Test-Path $pgCtl) -or !$dataDir) {
  throw "PostgreSQL runtime directory was not found."
}

# ========== 第二部分：数据库停止流程 ==========
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

try {
  & $pgCtl -D $dataDir stop 2>$null | Out-Null
} catch {
}

Write-Host "Local PostgreSQL has been stopped."
