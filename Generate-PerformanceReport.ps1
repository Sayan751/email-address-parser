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

function New-TableRow {
  param(
    [Parameter(Mandatory = $true)][string]$CaseName,
    $RustNs,
    $WasmNs
  )

  return "| {0,-18} | {1,10} | {2,10} |" -f $CaseName, (Format-TimeNs $RustNs), (Format-TimeNs $WasmNs)
}

function Build-PerformanceSection {
  param(
    [Parameter(Mandatory = $true)][string]$VersionLabelValue,
    [Parameter(Mandatory = $true)][hashtable]$RustMap,
    [Parameter(Mandatory = $true)][hashtable]$WasmMap,
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
  $null = $lines.Add("")

  foreach ($section in $sections) {
    $null = $lines.Add("### ``$($section.Header)``")
    $null = $lines.Add("")
    $null = $lines.Add("| Case               | Rust (avg) | WASM (avg) |")
    $null = $lines.Add("| ------------------ | ---------: | ---------: |")

    foreach ($caseName in $section.Cases) {
      $rustKey = "$($section.Api)|$caseName"
      $wasmKey = "$($section.Api)|$caseName"

      $rustValue = if ($RustMap.ContainsKey($rustKey)) { [double]$RustMap[$rustKey] } else { $null }
      $wasmValue = if ($WasmMap.ContainsKey($wasmKey)) { [double]$WasmMap[$wasmKey] } else { $null }

      $null = $lines.Add((New-TableRow -CaseName $caseName -RustNs $rustValue -WasmNs $wasmValue))
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

$sectionMarkdown = Build-PerformanceSection `
  -VersionLabelValue $VersionLabel `
  -RustMap $rustMap `
  -WasmMap $wasmMap `
  -RustMeasurementTimeSecValue $RustMeasurementTimeSec `
  -RustWarmupTimeSecValue $RustWarmupTimeSec `
  -NpmTimeMsValue $NpmTimeMs

$existingDocument = if (Test-Path $resolvedOutputPath) {
  Get-Content -Path $resolvedOutputPath -Raw
} else {
  Get-DefaultPerformanceDocument
}

$updatedDocument = Insert-SectionAfterMarker -DocumentText $existingDocument -SectionText $sectionMarkdown

Set-Content -Path $resolvedOutputPath -Value $updatedDocument -Encoding UTF8
Write-Host "Wrote performance report section to: $resolvedOutputPath"
