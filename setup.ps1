<#
.SYNOPSIS
  One-time project setup after cloning the template: fills the {{PLACEHOLDERS}}, renames the
  script file, sets the repo-local git identity and removes itself.

.USAGE
  .\setup.ps1 -Name "Torn Item Market - Shop Sell Price Highlighter" `
              -Slug torn-item-market-highlighter `
              -Description "Highlights Item Market listings cheaper than the shop sell price." `
              -Match "https://www.torn.com/page.php?sid=ItemMarket*" `
              -Prefix tmsh -PageName "the Item Market"

  THREAD_ID, GREASYFORK_ID and GREASYFORK_SLUG are left as placeholders on purpose; fill them
  later with:  .\setup.ps1 -Fill @{ THREAD_ID = '16612046' }
#>
param(
  [string] $Name,
  [string] $Slug,
  [string] $Description,
  [string] $Match,
  [string] $Prefix,
  [string] $PageName = 'the page',
  [hashtable] $Fill,
  [switch] $KeepSelf
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$textFiles = Get-ChildItem -Path $root -Recurse -File -Include *.js, *.md, *.html, *.json, *.ps1, *.yml |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.Name -ne 'setup.ps1' }

function Replace-All([hashtable] $map) {
  foreach ($f in $textFiles) {
    $src = Get-Content -Raw -Path $f.FullName
    $out = $src
    foreach ($k in $map.Keys) { $out = $out.Replace("{{$k}}", [string] $map[$k]) }
    if ($out -ne $src) { Set-Content -Path $f.FullName -Value $out -NoNewline -Encoding utf8; Write-Host "updated $($f.Name)" }
  }
}

if ($Fill) {
  Replace-All $Fill
  return
}

if (-not ($Name -and $Slug -and $Description -and $Match -and $Prefix)) {
  throw 'Name, Slug, Description, Match and Prefix are required (or use -Fill for later placeholders).'
}

$descLower = $Description.TrimEnd('.')
$descLower = $descLower.Substring(0, 1).ToLower() + $descLower.Substring(1)
$testUrl = $Match.TrimEnd('*')

Replace-All @{
  SCRIPT_NAME       = $Name
  SCRIPT_SLUG       = $Slug
  DESCRIPTION       = $Description
  DESCRIPTION_LOWER = $descLower
  MATCH             = $Match
  PREFIX            = $Prefix
  PAGE_NAME         = $PageName
  TEST_URL          = $testUrl
}

$scriptSrc = Join-Path $root 'script.user.js'
if (Test-Path $scriptSrc) { Rename-Item $scriptSrc "$Slug.user.js"; Write-Host "renamed script.user.js -> $Slug.user.js" }

if (-not (Test-Path (Join-Path $root '.git'))) { git -C $root init -q -b main; Write-Host 'git init' }
git -C $root config user.name 'tulpn'
git -C $root config user.email '1031452+tulpn@users.noreply.github.com'
Write-Host 'git identity set to tulpn (repo-local)'

if (-not $KeepSelf) { Remove-Item (Join-Path $root 'setup.ps1'); Write-Host 'removed setup.ps1' }
Write-Host "`nNext: npm install && npm test, then edit the page logic in $Slug.user.js"
