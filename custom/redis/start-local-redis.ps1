<#
文件说明：本机 Redis 启动脚本。
功能说明：优先复用仓库内的 Memurai 运行时，启动本机 6379，并把进程信息写入 runtime-logs。

结构概览：
  第一部分：基础路径与运行时探测
  第二部分：健康检查与启动
#>

$ErrorActionPreference = "Stop"

# ========== 第一部分：基础路径与运行时探测 ==========
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$runtimeLogs = Join-Path $root "custom\runtime-logs"
$memuraiRoot = Join-Path $root "custom\runtime\memurai-win\Memurai"
$memuraiExe = Join-Path $memuraiRoot "memurai.exe"
$memuraiCli = Join-Path $memuraiRoot "memurai-cli.exe"
$configFile = Join-Path $memuraiRoot "Samples\memurai.conf"
$pidFile = Join-Path $runtimeLogs "redis-local.pid"

if (!(Test-Path $memuraiExe)) {
  throw "Memurai runtime not found under custom/runtime/memurai-win."
}

if (!(Test-Path $runtimeLogs)) {
  New-Item -ItemType Directory -Path $runtimeLogs -Force | Out-Null
}

# ========== 第二部分：健康检查与启动 ==========
function Test-RedisReady {
  try {
    & $memuraiCli -p 6379 ping 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

$wasRunning = Test-RedisReady

if (!$wasRunning) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $memuraiExe
  $psi.Arguments = "`"$configFile`" --port 6379"
  $psi.WorkingDirectory = $memuraiRoot
  $psi.UseShellExecute = $true
  $process = [System.Diagnostics.Process]::Start($psi)

  if ($process) {
    Set-Content -Path $pidFile -Value $process.Id
  }

  for ($i = 0; $i -lt 15; $i++) {
    if (Test-RedisReady) {
      break
    }

    Start-Sleep -Seconds 1
  }
}

if (!(Test-RedisReady)) {
  throw "Local Redis could not be started."
}

$version = ""
try {
  $version = (& $memuraiCli -p 6379 INFO server 2>$null | Select-String "redis_version").ToString()
} catch {
}

Write-Host ("Local Redis is {0} on 6379." -f ($(if ($wasRunning) { "already running" } else { "running" })))
if ($version) {
  Write-Host $version
}
