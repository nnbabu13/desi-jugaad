<#
.SYNOPSIS
  Start (or stop) the SSH tunnel that exposes the remote PostgreSQL locally.

.DESCRIPTION
  The remote database only listens on the server's loopback interface and the
  OCI security list blocks external access to port 5432. Rather than opening a
  production database port or editing pgbouncer (which serves other projects),
  we forward a local port over SSH:

      localhost:1521  -->  server 127.0.0.1:5432

  Applications then connect to a normal local Postgres port with no pooling
  caveats and with zero changes to the remote host.

.EXAMPLE
  ./scripts/start-db-tunnel.ps1          # start (no-op if already up)
  ./scripts/start-db-tunnel.ps1 -Stop    # tear down
  ./scripts/start-db-tunnel.ps1 -Status  # report
#>
[CmdletBinding()]
param(
  [switch]$Stop,
  [switch]$Status,
  [int]$LocalPort = 1521,
  [int]$RemotePort = 5432,
  [string]$RemoteHost = "132.226.212.175",
  [string]$RemoteUser = "opc",
  [string]$KeyPath = (Join-Path $env:USERPROFILE ".ssh\ssh-key-2026-09-06.key")
)

$ErrorActionPreference = 'Stop'

function Get-TunnelConnection {
  Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

if ($Status) {
  $c = Get-TunnelConnection
  if ($c) { Write-Host "TUNNEL UP   localhost:$LocalPort (pid $($c.OwningProcess))" -ForegroundColor Green }
  else    { Write-Host "TUNNEL DOWN localhost:$LocalPort" -ForegroundColor Yellow }
  return
}

if ($Stop) {
  $c = Get-TunnelConnection
  if ($c) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "Tunnel stopped (pid $($c.OwningProcess))." -ForegroundColor Green
  } else {
    Write-Host "No tunnel listening on port $LocalPort." -ForegroundColor Yellow
  }
  return
}

if (-not (Test-Path $KeyPath)) {
  throw "SSH key not found at '$KeyPath'. Pass -KeyPath to override."
}

if (Get-TunnelConnection) {
  Write-Host "Tunnel already up on localhost:$LocalPort - nothing to do." -ForegroundColor Green
  return
}

Write-Host "Starting tunnel: localhost:$LocalPort -> ${RemoteHost}:$RemotePort ..." -ForegroundColor Cyan

Start-Process -FilePath "ssh" -ArgumentList @(
  '-i', $KeyPath,
  '-N', '-f',
  '-L', "${LocalPort}:127.0.0.1:${RemotePort}",
  '-o', 'ExitOnForwardFailure=yes',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=3',
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'IdentitiesOnly=yes',
  '-o', 'BatchMode=yes',
  "${RemoteUser}@${RemoteHost}"
) -WindowStyle Hidden

# Wait for the listener to come up rather than sleeping a fixed amount.
$deadline = (Get-Date).AddSeconds(20)
do {
  Start-Sleep -Milliseconds 250
  $c = Get-TunnelConnection
} until ($c -or (Get-Date) -gt $deadline)

if (-not $c) { throw "Tunnel failed to bind localhost:$LocalPort. Check the SSH key and that port $LocalPort is free." }

Write-Host "TUNNEL UP   localhost:$LocalPort -> 127.0.0.1:$RemotePort (pid $($c.OwningProcess))" -ForegroundColor Green
Write-Host "DATABASE_URL should point at 127.0.0.1:$LocalPort" -ForegroundColor DarkGray
