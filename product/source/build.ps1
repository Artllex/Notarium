$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (Test-Path (Join-Path $PSScriptRoot 'Modules/Dev/Notarium.Dev.csproj')) {
    Push-Location (Join-Path $PSScriptRoot 'Modules/Dev/WebGallery')
    try {
        npm.cmd ci
        if ($LASTEXITCODE) { throw 'Instalacja zależności DEV nie powiodła się.' }
        npm.cmd run build
        if ($LASTEXITCODE) { throw 'Budowanie galerii DEV nie powiodło się.' }
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
    if ($LASTEXITCODE) { throw 'Testy wspólnych komponentów nie przeszły.' }
    npm.cmd test
    if ($LASTEXITCODE) { throw 'Testy edytora nie przeszły.' }
} finally { Pop-Location }
dotnet run --project (Join-Path $PSScriptRoot 'Tests/Notarium.ArchitectureTests.csproj') -c Release
if ($LASTEXITCODE) { throw 'Testy architektury nie przeszły.' }
}
dotnet publish (Join-Path $PSScriptRoot 'Notatnik.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o (Join-Path $workspace 'builds/Notarium')
if ($LASTEXITCODE) { throw 'Publikacja lokalnego pakietu nie powiodła się.' }
