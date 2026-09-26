$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target = [IO.Path]::GetFullPath((Join-Path $workspace 'builds/Notarium'))
$running = Get-CimInstance Win32_Process -Filter "Name='Notarium.exe'" | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath).Equals((Join-Path $target 'Notarium.exe'), [StringComparison]::OrdinalIgnoreCase) }
if ($running) { throw 'Zamknij bieżące Notarium przed aktualizacją buildu. Nic nie zostało nadpisane.' }

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$sessionRoot = Join-Path $tempBase ('Notarium-build-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $sessionRoot | Out-Null
$oldTestOutput = $env:NOTARIUM_TEST_OUTPUT
$oldTestRoot = $env:NOTARIUM_TEST_ROOT
$env:NOTARIUM_TEST_OUTPUT = Join-Path $sessionRoot 'screenshots'
$env:NOTARIUM_TEST_ROOT = Join-Path $sessionRoot 'fixtures'
New-Item -ItemType Directory -Path $env:NOTARIUM_TEST_ROOT | Out-Null
try {
    if (Test-Path (Join-Path $PSScriptRoot 'Modules/Dev/Notarium.Dev.csproj')) {
        Push-Location (Join-Path $PSScriptRoot 'Modules/Dev/WebGallery')
        try {
            npm.cmd ci
            if ($LASTEXITCODE) { throw 'Instalacja zależności DEV nie powiodła się.' }
            npm.cmd run build
            if ($LASTEXITCODE) { throw 'Budowanie DEV nie powiodło się.' }
            npm.cmd test
            if ($LASTEXITCODE) { throw 'Testy galerii DEV nie przeszły.' }
        } finally { Pop-Location }
        dotnet run --project (Join-Path $PSScriptRoot 'Tests/Dev/Notarium.DevTests.csproj') -c Release
        if ($LASTEXITCODE) { throw 'Testy modułu DEV nie przeszły.' }
    }
    if (Test-Path (Join-Path $PSScriptRoot 'Modules/Notebook/Notarium.Notebook.csproj')) {
        Push-Location (Join-Path $PSScriptRoot 'Modules/Notebook/WebEditor')
        try {
            npm.cmd ci
            if ($LASTEXITCODE) { throw 'Instalacja zależności edytora nie powiodła się.' }
            npm.cmd run build
            if ($LASTEXITCODE) { throw 'Budowanie edytora nie powiodło się.' }
            node ui-test.mjs
            if ($LASTEXITCODE) { throw 'Testy komponentów nie przeszły.' }
            npm.cmd test
            if ($LASTEXITCODE) { throw 'Testy edytora nie przeszły.' }
        } finally { Pop-Location }
        dotnet run --project (Join-Path $PSScriptRoot 'Tests/Notarium.ArchitectureTests.csproj') -c Release
        if ($LASTEXITCODE) { throw 'Testy architektury nie przeszły.' }
    }

    $published = Join-Path $sessionRoot 'publish'
    dotnet publish (Join-Path $PSScriptRoot 'Notatnik.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $published
    if ($LASTEXITCODE) { throw 'Publikacja nie powiodła się. Poprzedni build pozostaje niezmieniony.' }

    $catalogPath = Join-Path $sessionRoot 'modules.json'
    $validation = Start-Process -FilePath (Join-Path $published 'Notarium.exe') -ArgumentList '--check-modules', ('"' + $catalogPath + '"') -WindowStyle Hidden -PassThru
    if (-not $validation.WaitForExit(30000)) { $validation.Kill(); throw 'Nie potwierdzono startu pakietu w 30 sekund. Poprzedni build pozostaje niezmieniony.' }
    $validation.Refresh()
    if ($validation.ExitCode -ne 0) { throw 'Sprawdzenie modułów nie przeszło. Poprzedni build pozostaje niezmieniony.' }
    $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
    if (@($catalog.errors).Count) { throw 'Pakiet zgłasza błędy modułów.' }
    $expected = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Modules') -Filter 'Notarium.*.csproj' -Recurse -ErrorAction SilentlyContinue).Count
    if (@($catalog.modules).Count -ne $expected) { throw 'Nie wszystkie moduły zostały opublikowane. Poprzedni build pozostaje niezmieniony.' }

    $commit = git -C $PSScriptRoot rev-parse HEAD
    if ($LASTEXITCODE) { $commit = 'unknown' }
    $info = @{ commit = $commit; builtAtUtc = [DateTime]::UtcNow.ToString('o'); modules = @($catalog.modules) } | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $published 'build-info.json'), $info)
    $previous = Join-Path $sessionRoot 'previous'
    if (-not $target.StartsWith(([IO.Path]::GetFullPath((Join-Path $workspace 'builds')) + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) { throw 'Nieprawidłowy katalog buildu.' }
    New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
    if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $previous }
    try { Move-Item -LiteralPath $published -Destination $target }
    catch { if (Test-Path -LiteralPath $previous) { Move-Item -LiteralPath $previous -Destination $target }; throw }
    Write-Output "Aktualny, sprawdzony build: $target"
} finally {
    $env:NOTARIUM_TEST_OUTPUT = $oldTestOutput
    $env:NOTARIUM_TEST_ROOT = $oldTestRoot
    $resolvedSession = [IO.Path]::GetFullPath($sessionRoot)
    if (-not $resolvedSession.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolvedSession -Leaf) -notlike 'Notarium-build-*') { throw 'Nieprawidłowy katalog tymczasowy — nie usuwam.' }
    Remove-Item -LiteralPath $resolvedSession -Recurse -Force
}
