<#
.SYNOPSIS
  Package the current commit and deploy it to the Oracle VM.

.DESCRIPTION
  Creates a tarball of HEAD (source only - node_modules, dist, .env are never
  included), copies it to the VM over SSH, then runs update-app.sh there:
  extract -> pnpm install -> build -> pg_dump backup -> migrate deploy ->
  service restart -> health check.

  First-time setup order (see deploy/README.md):
    1. scp the production .env to /opt/desi-jugaad/.env (chmod 600)
    2. run this script
    3. ssh and run deploy/oracle/bootstrap.sh (once)

.EXAMPLE
  .\deploy\push-to-vm.ps1
#>
[CmdletBinding()]
param(
  [string]$KeyPath = (Join-Path $env:USERPROFILE ".ssh\ssh-key-2026-09-06.key"),
  [string]$Target = "opc@132.226.212.175",
  [string]$RemotePath = "/tmp/desi-jugaad-app.tar.gz"
)
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path $KeyPath)) { throw "SSH key not found: $KeyPath" }

$commit = (git rev-parse --short HEAD).Trim()
$tarball = Join-Path $env:TEMP "desi-jugaad-app.tar.gz"
Write-Output "Packaging commit $commit -> $tarball"
# .gitattributes-less archive: git archive respects .gitignore via the index,
# so only tracked files are included (never .env, never node_modules).
Remove-Item $tarball -ErrorAction SilentlyContinue
git archive --format=tar.gz -o $tarball HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive failed" }

Write-Output "Copying to ${Target}:$RemotePath"
scp -i $KeyPath -o StrictHostKeyChecking=no $tarball "${Target}:$RemotePath"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

Write-Output "Running update-app.sh on the VM..."
ssh -i $KeyPath -o StrictHostKeyChecking=no $Target "bash /opt/desi-jugaad/deploy/oracle/update-app.sh $RemotePath"
if ($LASTEXITCODE -ne 0) { throw "remote update failed" }

Write-Output "Done. Verify: curl -sS https://132-226-212-175.sslip.io/api/v1/health"
