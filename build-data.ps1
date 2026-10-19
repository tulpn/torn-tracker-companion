<#
.SYNOPSIS
  Fetches static data from the Torn API once and bakes it into the userscript between the
  @@DATA_START / @@DATA_END markers. The key is used here only and never reaches the script.

.USAGE
  .\build-data.ps1 -ApiKey YOUR_KEY
  Adapt $Url and the $Transform block for the script's needs. A Public key is usually enough.

.EXAMPLE (item market highlighter)
  $Url       = 'https://api.torn.com/torn/?selections=items&key={key}'
  $Transform = { param($d) $o=[ordered]@{}; foreach($p in $d.items.PSObject.Properties){ if([int]$p.Value.sell_price -gt 0){ $o[$p.Name]=[int]$p.Value.sell_price } }; $o }
#>
param(
  [Parameter(Mandatory = $true)] [string] $ApiKey,
  [string] $ScriptPath = (Get-ChildItem -Path $PSScriptRoot -Filter '*.user.js' | Select-Object -First 1 -ExpandProperty FullName),
  [string] $Url = 'https://api.torn.com/torn/?selections=items&key={key}',
  [scriptblock] $Transform = { param($d) $d },
  [string] $ConstName = 'DATA'
)

$ErrorActionPreference = 'Stop'

$data = Invoke-RestMethod -Uri ($Url -replace '\{key\}', $ApiKey)
if ($data.error) { throw "Torn API error $($data.error.code): $($data.error.error)" }

$obj  = & $Transform $data
$json = $obj | ConvertTo-Json -Compress -Depth 10
$count = if ($obj -is [System.Collections.IDictionary]) { $obj.Count } elseif ($obj.PSObject.Properties) { @($obj.PSObject.Properties).Count } else { 0 }

$src = Get-Content -Raw -Path $ScriptPath
$pattern = '(?s)(// @@DATA_START\r?\n).*?(\r?\n\s*// @@DATA_END)'
if ($src -notmatch $pattern) { throw "Markers not found in $ScriptPath" }

$stamp = Get-Date -Format 'yyyy-MM-dd'
$block = "  // generated $stamp - $count entries`n  const ${ConstName}_GENERATED = '$stamp';`n  const $ConstName = $json;"
$out = [regex]::Replace($src, $pattern, { param($m) $m.Groups[1].Value + $block + $m.Groups[2].Value })

Set-Content -Path $ScriptPath -Value $out -NoNewline -Encoding utf8
Write-Host "Embedded $count entries into $ScriptPath"
