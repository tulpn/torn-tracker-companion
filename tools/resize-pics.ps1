<#
.SYNOPSIS
  Creates forum-sized copies of the screenshots in pics/ as pics/forum/{browser,pda,settings}.png.
  The Torn forum may ignore width attributes, so the files themselves are resized.

.USAGE
  .\tools\resize-pics.ps1
  Expects pics/browser.png (or .jpg), pics/torn-pda.(png|jpg), pics/menu-preview.png.
#>
param(
  [string] $PicsDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'pics'),
  [int] $BrowserWidth = 640,
  [int] $PdaWidth = 260,
  [int] $SettingsWidth = 300
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$dst = Join-Path $PicsDir 'forum'
New-Item -ItemType Directory -Force $dst | Out-Null

function Find-Pic([string] $base) {
  foreach ($ext in 'png', 'jpg', 'jpeg') {
    $p = Join-Path $PicsDir "$base.$ext"
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Resize([string] $in, [string] $out, [int] $w) {
  $img = [System.Drawing.Image]::FromFile($in)
  $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose(); $img.Dispose()
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  Write-Host "$(Split-Path $out -Leaf): ${w}x$h, $([int]((Get-Item $out).Length / 1KB)) KB"
}

$map = @(
  @{ base = 'browser';      out = 'browser.png';  width = $BrowserWidth },
  @{ base = 'torn-pda';     out = 'pda.png';      width = $PdaWidth },
  @{ base = 'menu-preview'; out = 'settings.png'; width = $SettingsWidth }
)
foreach ($m in $map) {
  $src = Find-Pic $m.base
  if ($src) { Resize $src (Join-Path $dst $m.out) $m.width } else { Write-Warning "pics/$($m.base).(png|jpg) not found, skipped" }
}
