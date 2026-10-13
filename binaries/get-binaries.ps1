# Run once from the project folder:  powershell -ExecutionPolicy Bypass -File binaries\get-binaries.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$tmp = Join-Path $env:TEMP 'clipforge_dl'; New-Item -ItemType Directory -Force $tmp | Out-Null

Write-Host '1/2 FFmpeg (essentials build, has libx264)...'
Invoke-WebRequest 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile "$tmp\ffmpeg.zip"
Expand-Archive "$tmp\ffmpeg.zip" "$tmp\ffmpeg" -Force
Get-ChildItem "$tmp\ffmpeg" -Recurse -Include ffmpeg.exe,ffprobe.exe | Copy-Item -Destination $here -Force

Write-Host '2/2 whisper.cpp (CPU build)...'
$rel = Invoke-RestMethod 'https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest'
$asset = $rel.assets | Where-Object { $_.name -eq 'whisper-bin-x64.zip' } | Select-Object -First 1
if (-not $asset) { throw 'whisper-bin-x64.zip not found in latest release. Download a Windows x64 build manually from https://github.com/ggml-org/whisper.cpp/releases and copy whisper-cli.exe + *.dll into binaries\' }
Invoke-WebRequest $asset.browser_download_url -OutFile "$tmp\whisper.zip"
Expand-Archive "$tmp\whisper.zip" "$tmp\whisper" -Force
$cli = Get-ChildItem "$tmp\whisper" -Recurse -Filter whisper-cli.exe | Select-Object -First 1
Copy-Item "$($cli.DirectoryName)\*" $here -Force
Write-Host 'Done. Files in binaries\:'; Get-ChildItem $here | Select-Object Name
