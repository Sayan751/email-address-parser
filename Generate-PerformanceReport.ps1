[CmdletBinding()]
param(
  [string]$VersionLabel = "v2.0.0 (baseline)",
  [double]$RustMeasurementTimeSec = 1,
  [double]$RustWarmupTimeSec = 1,
  [int]$NpmTimeMs = 1000,
  [int]$NpmIterations = 20000,
  [int]$NpmWarmupIterations = 5000,
  [string]$OutputPath = "Performance.md",
  [switch]$SkipRustBench,
  [switch]$SkipNpmBench,
  [string]$NpmJsonPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture
$script:MicroSymbol = [char]0x00B5
$script:InsertMarker = "<!-- Add performance report for new versions here. --->"

function Format-Number {
  param(
    [double]$Value,
    [int]$Decimals
  )

  $format = "0." + ("0" * $Decimals)
  return [string]::Format($script:InvariantCulture, "{0:$format}", $Value)
}

function Format-TimeNs {
  param($Nanoseconds)

  if ($null -eq $Nanoseconds) {
    return "N/A"
  }

  $ns = [double]$Nanoseconds

  if ($ns -lt 1000) {
    return "$(Format-Number -Value $ns -Decimals 2) ns"
  }

  if ($ns -lt 1000000) {
    $us = $ns / 1000.0
    return "$(Format-Number -Value $us -Decimals 3) $($script:MicroSymbol)s"
  }

  $ms = $ns / 1000000.0
  return "$(Format-Number -Value $ms -Decimals 3) ms"
}

function Format-PercentChange {
  param(
    $CurrentNanoseconds,
    $PreviousNanoseconds
  )

  if ($null -eq $CurrentNanoseconds -or $null -eq $PreviousNanoseconds) {
    return "N/A"
  }

  $current = [double]$CurrentNanoseconds
  $previous = [double]$PreviousNanoseconds
  if ($previous -eq 0) {
    return "N/A"
  }

  $deltaPct = (($current - $previous) / $previous) * 100.0
  $prefix = if ($deltaPct -gt 0) { "+" } else { "" }
  return "$prefix$(Format-Number -Value $deltaPct -Decimals 2)%"
}

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [switch]$CaptureOutput
  )

  Write-Host "[$WorkingDirectory] $FilePath $($Arguments -join ' ')"

  Push-Location $WorkingDirectory
  try {
    if ($CaptureOutput) {
      $output = & $FilePath @Arguments
      if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
      }
      return ($output -join [Environment]::NewLine)
    }

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Get-RepoRoot {
  if ($PSScriptRoot) {
    return $PSScriptRoot
  }
  return (Get-Location).Path
}

function Convert-RustBenchToMap {
  param(
    [Parameter(Mandatory = $true)][string]$CriterionRoot
  )

  if (-not (Test-Path $CriterionRoot)) {
    throw "Criterion output not found: $CriterionRoot"
  }

  $map = @{}

  Get-ChildItem -Path $CriterionRoot -Directory |
    Where-Object { $_.Name -ne "report" } |
    ForEach-Object {
      $estimatePath = Join-Path $_.FullName "new\estimates.json"
      if (Test-Path $estimatePath) {
        $parts = $_.Name -split " - ", 2
        if ($parts.Count -eq 2) {
          $api = $parts[0]
          $case = $parts[1]
          $estimate = Get-Content -Path $estimatePath -Raw | ConvertFrom-Json
          $meanNs = [double]$estimate.mean.point_estimate
          $map["$api|$case"] = $meanNs
        }
      }
    }

  return $map
}

function Get-NpmBenchCaseFromTaskName {
  param(
    [Parameter(Mandatory = $true)][string]$TaskName
  )

  $name = $TaskName.ToLowerInvariant()

  $api = "other"
  if ($name.Contains(" parse ")) {
    $api = "parse"
  } elseif ($name.Contains(" isvalid ")) {
    $api = "is_valid"
  } elseif ($name.Contains(" constructor ")) {
    $api = "new"
  }

  $case = "other"
  if ($name.Contains("invalid local part")) {
    $case = "invalid local part"
  } elseif ($name.Contains("invalid domain")) {
    $case = "invalid domain"
  } elseif ($name.Contains("obsolete rfc 5322")) {
    $case = "obs"
  } elseif ($name.Contains("long address")) {
    $case = "long"
  } elseif ($name.Contains("unicode")) {
    $case = "unicode"
  } elseif ($name.Contains("ascii")) {
    $case = "valid"
  }

  return @{
    Api = $api
    Case = $case
  }
}

function Convert-NpmBenchToMap {
  param(
    [Parameter(Mandatory = $true)]$NpmBenchJson
  )

  $map = @{}
  foreach ($result in @($NpmBenchJson.results)) {
    $parsed = Get-NpmBenchCaseFromTaskName -TaskName ([string]$result.task)
    $key = "$($parsed.Api)|$($parsed.Case)"
    $map[$key] = [double]$result.meanNs
  }

  return $map
}

function Convert-FormattedTimeToNs {
  param(
    $FormattedValue
  )

  if ($null -eq $FormattedValue) {
    return $null
  }

  $text = ([string]$FormattedValue).Trim()
  if ([string]::IsNullOrWhiteSpace($text) -or $text -eq "N/A") {
    return $null
  }

  if ($text -notmatch '^([0-9]+(?:\.[0-9]+)?)\s*(ns|ms|µs|us)$') {
    throw "Unsupported time format in performance table: '$text'"
  }

  $value = [double]::Parse($Matches[1], $script:InvariantCulture)
  $unit = $Matches[2]

  switch ($unit) {
    "ns" { return $value }
    "us" { return ($value * 1000.0) }
    "µs" { return ($value * 1000.0) }
    "ms" { return ($value * 1000000.0) }
    default { throw "Unsupported time unit '$unit'" }
  }
}

function Split-MarkdownRow {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Line
  )

  $trimmed = $Line.Trim()
  if (-not ($trimmed.StartsWith("|") -and $trimmed.EndsWith("|"))) {
    return $null
  }

  $parts = $trimmed -split '\|'
  if ($parts.Count -lt 3) {
    return $null
  }

  $cells = New-Object System.Collections.Generic.List[string]
  for ($i = 1; $i -lt ($parts.Count - 1); $i++) {
    $null = $cells.Add($parts[$i].Trim())
  }
  return $cells.ToArray()
}

function Get-PreviousVersionPerformanceMaps {
  param(
    [Parameter(Mandatory = $true)][string]$DocumentText
  )

  $result = @{
    VersionLabel = $null
    RustMap = @{}
    WasmMap = @{}
  }

  $lines = $DocumentText -split "`r?`n"
  $versionStartIndex = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^##\s+(.+)$') {
      $versionStartIndex = $i
      $result.VersionLabel = $Matches[1].Trim()
      break
    }
  }

  if ($versionStartIndex -lt 0) {
    return $result
  }

  $currentApi = $null
  $headerIndexMap = $null

  for ($i = $versionStartIndex + 1; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]

    if ($line -match '^##\s+') {
      break
    }

    if ($line -match '^###\s+(.+)$') {
      $normalized = (($Matches[1] -replace '[`#\s]', '')).ToLowerInvariant()
      $currentApi = switch ($normalized) {
        "parse" { "parse" }
        "is_valid" { "is_valid" }
        "new" { "new" }
        default { $null }
      }
      $headerIndexMap = $null
      continue
    }

    $cells = Split-MarkdownRow -Line $line
    if ($null -eq $cells) {
      continue
    }

    if ($cells.Count -eq 0) {
      continue
    }

    if ($cells[0] -eq "Case") {
      $headerIndexMap = @{
        Case = [Array]::IndexOf($cells, "Case")
        Rust = [Array]::IndexOf($cells, "Rust (avg)")
        Wasm = [Array]::IndexOf($cells, "WASM (avg)")
      }
      continue
    }

    if ($cells[0] -match '^-+$') {
      continue
    }

    if ($null -eq $currentApi -or $null -eq $headerIndexMap) {
      continue
    }

    if ($headerIndexMap.Case -lt 0 -or $headerIndexMap.Rust -lt 0 -or $headerIndexMap.Wasm -lt 0) {
      continue
    }

    $requiredIndex = [Math]::Max([Math]::Max($headerIndexMap.Case, $headerIndexMap.Rust), $headerIndexMap.Wasm)
    if ($cells.Count -le $requiredIndex) {
      continue
    }

    $caseName = $cells[$headerIndexMap.Case]
    $rustText = $cells[$headerIndexMap.Rust]
    $wasmText = $cells[$headerIndexMap.Wasm]

    $result.RustMap["$currentApi|$caseName"] = Convert-FormattedTimeToNs -FormattedValue $rustText
    $result.WasmMap["$currentApi|$caseName"] = Convert-FormattedTimeToNs -FormattedValue $wasmText
  }

  return $result
}

function New-TableRow {
  param(
    [Parameter(Mandatory = $true)][string]$CaseName,
    $RustNs,
    $WasmNs,
    $PreviousRustNs,
    $PreviousWasmNs
  )

  return "| {0,-18} | {1,10} | {2,12} | {3,10} | {4,12} |" -f `
    $CaseName, `
    (Format-TimeNs $RustNs), `
    (Format-PercentChange -CurrentNanoseconds $RustNs -PreviousNanoseconds $PreviousRustNs), `
    (Format-TimeNs $WasmNs), `
    (Format-PercentChange -CurrentNanoseconds $WasmNs -PreviousNanoseconds $PreviousWasmNs)
}

function Build-PerformanceSection {
  param(
    [Parameter(Mandatory = $true)][string]$VersionLabelValue,
    [Parameter(Mandatory = $true)][hashtable]$RustMap,
    [Parameter(Mandatory = $true)][hashtable]$WasmMap,
    [hashtable]$PreviousRustMap = @{},
    [hashtable]$PreviousWasmMap = @{},
    [string]$PreviousVersionLabel,
    [double]$RustMeasurementTimeSecValue,
    [double]$RustWarmupTimeSecValue,
    [int]$NpmTimeMsValue
  )

  $sections = @(
    @{
      Api = "parse"
      Header = "parse"
      Cases = @("valid", "invalid local part", "invalid domain", "unicode", "long", "obs")
    },
    @{
      Api = "is_valid"
      Header = "is_valid"
      Cases = @("valid", "invalid local part", "invalid domain", "unicode", "long", "obs")
    },
    @{
      Api = "new"
      Header = "new"
      Cases = @("valid", "invalid local part", "invalid domain", "unicode", "long", "obs")
    }
  )

  $lines = New-Object System.Collections.Generic.List[string]

  $null = $lines.Add("## $VersionLabelValue")
  $null = $lines.Add("")
  $null = $lines.Add(('- Criterion setup: `{0}`' -f "--measurement-time $RustMeasurementTimeSecValue --warm-up-time $RustWarmupTimeSecValue"))
  $null = $lines.Add(('- Tinybench setup: `{0}` (`--iterations` and `--warmup-iterations` are runner limits/defaults)' -f "--time-ms $NpmTimeMsValue"))
  if (-not [string]::IsNullOrWhiteSpace($PreviousVersionLabel)) {
    $null = $lines.Add(('- Delta columns compare against previous section: `{0}`' -f $PreviousVersionLabel))
  } else {
    $null = $lines.Add('- Delta columns compare against previous section: `N/A` (no prior section found)')
  }
  $null = $lines.Add("")

  foreach ($section in $sections) {
    $null = $lines.Add("### ``$($section.Header)``")
    $null = $lines.Add("")
    $null = $lines.Add("| Case               | Rust (avg) | Rust Δ vs prev | WASM (avg) | WASM Δ vs prev |")
    $null = $lines.Add("| ------------------ | ---------: | -------------: | ---------: | -------------: |")

    foreach ($caseName in $section.Cases) {
      $rustKey = "$($section.Api)|$caseName"
      $wasmKey = "$($section.Api)|$caseName"

      $rustValue = if ($RustMap.ContainsKey($rustKey)) { [double]$RustMap[$rustKey] } else { $null }
      $wasmValue = if ($WasmMap.ContainsKey($wasmKey)) { [double]$WasmMap[$wasmKey] } else { $null }
      $previousRustValue = if ($PreviousRustMap.ContainsKey($rustKey)) { $PreviousRustMap[$rustKey] } else { $null }
      $previousWasmValue = if ($PreviousWasmMap.ContainsKey($wasmKey)) { $PreviousWasmMap[$wasmKey] } else { $null }

      $null = $lines.Add((
        New-TableRow `
          -CaseName $caseName `
          -RustNs $rustValue `
          -WasmNs $wasmValue `
          -PreviousRustNs $previousRustValue `
          -PreviousWasmNs $previousWasmValue
      ))
    }

    $null = $lines.Add("")
  }

  return ($lines -join [Environment]::NewLine)
}

function Get-DefaultPerformanceDocument {
  $nl = [Environment]::NewLine
  $template = @'
# Performance Notes

Average time per operation, consolidated by API.

- Rust: Criterion (`cargo bench --bench benchmarks`)
- WASM: Tinybench (`npm run bench -- --json`)
- New generated sections include `%` delta columns versus the immediately previous version section.
- Results are useful for trend tracking; absolute values depend on machine/runtime/harness.
- `N/A` in WASM `new` invalid cases: currently excluded from the npm benchmark because repeated throwing constructor calls destabilize the shared WASM instance during benchmarking.

__INSERT_MARKER__
'@
  return ($template.Replace('__INSERT_MARKER__', $script:InsertMarker) -replace "`r?`n", $nl)
}

function Insert-SectionAfterMarker {
  param(
    [Parameter(Mandatory = $true)][string]$DocumentText,
    [Parameter(Mandatory = $true)][string]$SectionText
  )

  if (-not $DocumentText.Contains($script:InsertMarker)) {
    throw "Marker not found in output document: $($script:InsertMarker)"
  }

  $nl = [Environment]::NewLine
  $insertion = "$($script:InsertMarker)$nl$nl$SectionText"
  return $DocumentText.Replace($script:InsertMarker, $insertion)
}

$repoRoot = Get-RepoRoot
$rustDir = Join-Path $repoRoot "rust-lib"
$npmDir = Join-Path $repoRoot "npm-pkg"
$criterionRoot = Join-Path $rustDir "target\criterion"
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath
} else {
  Join-Path $repoRoot $OutputPath
}

if (-not $SkipRustBench) {
  Invoke-External -FilePath "cargo" -Arguments @(
    "bench", "--bench", "benchmarks", "--",
    "--measurement-time", ([string]$RustMeasurementTimeSec),
    "--warm-up-time", ([string]$RustWarmupTimeSec)
  ) -WorkingDirectory $rustDir
}

$npmBenchOutput = $null
if ($SkipNpmBench) {
  if (-not $NpmJsonPath) {
    throw "When using -SkipNpmBench, provide -NpmJsonPath pointing to a prior npm bench JSON file."
  }
  $resolvedNpmJsonPath = if ([System.IO.Path]::IsPathRooted($NpmJsonPath)) {
    $NpmJsonPath
  } else {
    Join-Path $repoRoot $NpmJsonPath
  }
  $npmBenchOutput = Get-Content -Path $resolvedNpmJsonPath -Raw
} else {
  $npmBenchOutput = Invoke-External -FilePath "node" -Arguments @(
    ".\benchmarks\bench.js", "--json",
    "--time-ms", ([string]$NpmTimeMs),
    "--iterations", ([string]$NpmIterations),
    "--warmup-iterations", ([string]$NpmWarmupIterations)
  ) -WorkingDirectory $npmDir -CaptureOutput
}

$rustMap = Convert-RustBenchToMap -CriterionRoot $criterionRoot

$npmBenchJson = $npmBenchOutput | ConvertFrom-Json
if (@($npmBenchJson.skipped).Count -gt 0) {
  Write-Warning "npm benchmark reported skipped/errored tasks. Missing rows may appear as N/A."
}
$wasmMap = Convert-NpmBenchToMap -NpmBenchJson $npmBenchJson

$existingDocument = if (Test-Path $resolvedOutputPath) {
  Get-Content -Path $resolvedOutputPath -Raw
} else {
  Get-DefaultPerformanceDocument
}

$previousSectionData = Get-PreviousVersionPerformanceMaps -DocumentText $existingDocument

$sectionMarkdown = Build-PerformanceSection `
  -VersionLabelValue $VersionLabel `
  -RustMap $rustMap `
  -WasmMap $wasmMap `
  -PreviousRustMap $previousSectionData.RustMap `
  -PreviousWasmMap $previousSectionData.WasmMap `
  -PreviousVersionLabel $previousSectionData.VersionLabel `
  -RustMeasurementTimeSecValue $RustMeasurementTimeSec `
  -RustWarmupTimeSecValue $RustWarmupTimeSec `
  -NpmTimeMsValue $NpmTimeMs

$updatedDocument = Insert-SectionAfterMarker -DocumentText $existingDocument -SectionText $sectionMarkdown

Set-Content -Path $resolvedOutputPath -Value $updatedDocument -Encoding UTF8
Write-Host "Wrote performance report section to: $resolvedOutputPath"
