<#
文件说明：本机 PostgreSQL 启动脚本。
功能说明：启动仓库内的本机 PostgreSQL，并确保 editorial 数据库存在。

结构概览：
  第一部分：基础路径
  第二部分：初始化数据目录
  第三部分：启动数据库
  第四部分：补齐业务数据库
#>

$ErrorActionPreference = "Stop"

# ========== 第一部分：基础路径 ==========
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$pgRoot = Join-Path $root "custom\runtime\postgresql17\pgsql"
$dataDir = Join-Path $root "custom\runtime\postgresql17-data"
$logFile = Join-Path $dataDir "postgres.log"
$pgCtl = Join-Path $pgRoot "bin\pg_ctl.exe"
$initdb = Join-Path $pgRoot "bin\initdb.exe"
$psql = Join-Path $pgRoot "bin\psql.exe"
$createdb = Join-Path $pgRoot "bin\createdb.exe"
$pgIsReady = Join-Path $pgRoot "bin\pg_isready.exe"

if (!(Test-Path $pgCtl)) {
  throw "PostgreSQL runtime not found under custom/runtime/postgresql17."
}

# ========== 第二部分：初始化数据目录 ==========
if (!(Test-Path $dataDir)) {
  New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
  & $initdb -D $dataDir -U postgres -A trust | Out-Host
}

# ========== 第三部分：启动数据库 ==========
& $pgCtl -D $dataDir -l $logFile status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $dataDir -l $logFile start | Out-Host
}

for ($i = 0; $i -lt 15; $i++) {
  & $pgIsReady -h localhost -p 5432 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    break
  }
  Start-Sleep -Seconds 1
}

# ========== 第四部分：补齐业务数据库 ==========
$databaseExistsQuery = "SELECT 1 FROM pg_database WHERE datname='editorial';"
$exists = & $psql -h localhost -U postgres -d postgres -tAc $databaseExistsQuery
if (($exists | Out-String).Trim() -ne "1") {
  & $createdb -h localhost -U postgres editorial | Out-Host
}

Write-Host "Local PostgreSQL is running and editorial database is ready."
