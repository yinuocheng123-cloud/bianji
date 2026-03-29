<#
文件说明：本机 PostgreSQL 启动脚本。
功能说明：优先复用仓库内可携带 PostgreSQL 运行时，自动初始化数据目录、启动数据库并确保 editorial 数据库存在。

结构概览：
  第一部分：基础路径与运行时探测
  第二部分：数据目录初始化
  第三部分：数据库启动与健康检查
  第四部分：补齐业务数据库
#>

$ErrorActionPreference = "Stop"

# ========== 第一部分：基础路径与运行时探测 ==========
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$runtimeLogs = Join-Path $root "custom\runtime-logs"
$runtimeCandidates = @(
  (Join-Path $root "custom\runtime\postgresql17\pgsql"),
  (Join-Path $root "custom\runtime\postgresql16\pgsql")
) | Where-Object { Test-Path (Join-Path $_ "bin\postgres.exe") }
$pgRoot = $runtimeCandidates | Select-Object -First 1

if (!$pgRoot) {
  throw "PostgreSQL runtime not found under custom/runtime."
}

$defaultDataDir = Join-Path $root "custom\runtime\postgresql17-data-fresh"
$dataDirCandidates = @(
  $env:ZMW_PG_DATA_DIR,
  $defaultDataDir,
  (Join-Path $root "custom\runtime\postgresql17-data"),
  (Join-Path $root "custom\runtime\postgresql16-data")
) | Where-Object { $_ }
$existingDataDir = $dataDirCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$dataDir = if ($existingDataDir) { $existingDataDir } else { $defaultDataDir }
$logFile = Join-Path $runtimeLogs "postgres-local.log"
$pidFile = Join-Path $runtimeLogs "postgres-local.pid"
$pgCtl = Join-Path $pgRoot "bin\pg_ctl.exe"
$postgres = Join-Path $pgRoot "bin\postgres.exe"
$initdb = Join-Path $pgRoot "bin\initdb.exe"
$psql = Join-Path $pgRoot "bin\psql.exe"
$createdb = Join-Path $pgRoot "bin\createdb.exe"
$pgIsReady = Join-Path $pgRoot "bin\pg_isready.exe"
$postmasterPidFile = Join-Path $dataDir "postmaster.pid"

if (!(Test-Path $runtimeLogs)) {
  New-Item -ItemType Directory -Path $runtimeLogs -Force | Out-Null
}

# ========== 第二部分：数据目录初始化 ==========
if (!(Test-Path $dataDir)) {
  New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
  & $initdb -D $dataDir -U postgres -A trust | Out-Host
}

# ========== 第三部分：数据库启动与健康检查 ==========
function Test-PostgresReady {
  & $pgIsReady -h localhost -p 5432 | Out-Null
  return $LASTEXITCODE -eq 0
}

function Wait-PostgresReady {
  param (
    [int]$RetryCount = 20
  )

  for ($i = 0; $i -lt $RetryCount; $i++) {
    if (Test-PostgresReady) {
      return $true
    }

    Start-Sleep -Seconds 1
  }

  return $false
}

function Get-PostgresVersion {
  try {
    return (& $psql -h localhost -U postgres -d postgres -tAc "SHOW server_version;" | Out-String).Trim()
  } catch {
    return ""
  }
}

if ((Test-Path $postmasterPidFile) -and !(Test-PostgresReady)) {
  $pidValue = (Get-Content -Path $postmasterPidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()

  if ($pidValue) {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
    if (!$process) {
      Remove-Item -Path $postmasterPidFile -Force -ErrorAction SilentlyContinue
    }
  }
}

$wasRunning = Test-PostgresReady

if (!$wasRunning) {
  & $pgCtl -D $dataDir -l $logFile status 2>$null | Out-Null

  if ($LASTEXITCODE -ne 0) {
    try {
      & $pgCtl -D $dataDir -l $logFile start 2>$null | Out-Null
    } catch {
    }
  }

  if (!(Wait-PostgresReady -RetryCount 10)) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $postgres
    $psi.Arguments = "-D `"$dataDir`""
    $psi.WorkingDirectory = $dataDir
    $psi.UseShellExecute = $true
    $process = [System.Diagnostics.Process]::Start($psi)

    if ($process) {
      Set-Content -Path $pidFile -Value $process.Id
    }

    if (!(Wait-PostgresReady -RetryCount 20)) {
      throw "Local PostgreSQL could not be started. Check custom/runtime-logs/postgres-local.log for details."
    }
  }
}

# ========== 第四部分：补齐业务数据库 ==========
$databaseExistsQuery = "SELECT 1 FROM pg_database WHERE datname='editorial';"
$exists = & $psql -h localhost -U postgres -d postgres -tAc $databaseExistsQuery
if (($exists | Out-String).Trim() -ne "1") {
  & $createdb -h localhost -U postgres editorial | Out-Host
}

$version = Get-PostgresVersion
$runningMessage = if ($wasRunning) { "already running" } else { "started" }
Write-Host "Local PostgreSQL $runningMessage and editorial database is ready. Data directory: $dataDir"
if ($version) {
  Write-Host "PostgreSQL version: $version"
}
Write-Host "Runtime log: $logFile"
