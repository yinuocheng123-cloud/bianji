<#
文件说明：本机 PostgreSQL 停止脚本。
功能说明：停止仓库内正在运行的本机 PostgreSQL。

结构概览：
  第一部分：基础路径
  第二部分：停止数据库
#>

$ErrorActionPreference = "Stop"

# ========== 第一部分：基础路径 ==========
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$pgRoot = Join-Path $root "custom\runtime\postgresql17\pgsql"
$dataDir = Join-Path $root "custom\runtime\postgresql17-data"
$pgCtl = Join-Path $pgRoot "bin\pg_ctl.exe"

if (!(Test-Path $pgCtl) -or !(Test-Path $dataDir)) {
  throw "PostgreSQL runtime directory was not found."
}

# ========== 第二部分：停止数据库 ==========
& $pgCtl -D $dataDir stop | Out-Host
Write-Host "Local PostgreSQL has been stopped."
