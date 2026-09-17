$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Push-Location (Join-Path $PSScriptRoot 'WebEditor')
try {
    npm.cmd ci
    if ($LASTEXITCODE) { throw 'Instalacja zależności edytora nie powiodła się.' }
    npm.cmd run build
    if ($LASTEXITCODE) { throw 'Budowanie edytora nie powiodło się.' }
    npm.cmd test
    if ($LASTEXITCODE) { throw 'Testy edytora nie przeszły.' }
} finally { Pop-Location }
dotnet publish (Join-Path $PSScriptRoot 'Notatnik.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o (Join-Path $workspace 'outputs/Notarium')
if ($LASTEXITCODE) { throw 'Publikacja lokalnego pakietu nie powiodła się.' }
