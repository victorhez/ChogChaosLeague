# Renders narration lines to WAV with the Windows speech engine (WinRT SpeechSynthesizer, "OneCore" voices).
# usage: powershell -File voice.ps1 -Json lines.json -OutDir audio -Voice Mark -Rate 0.95
param([string]$Json, [string]$OutDir, [string]$Voice = "Mark", [double]$Rate = 1.0)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*$Voice*" } | Select-Object -First 1
if ($v) { $synth.Voice = $v }
$synth.Options.SpeakingRate = $Rate
Write-Host "voice: $($synth.Voice.DisplayName)"
New-Item -ItemType Directory -Force $OutDir | Out-Null
$lines = Get-Content -Raw -Encoding UTF8 $Json | ConvertFrom-Json
foreach ($l in $lines.PSObject.Properties) {
  $stream = Await ($synth.SynthesizeTextToStreamAsync($l.Value)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $null = Await ($reader.LoadAsync([uint32]$stream.Size)) ([uint32])
  $bytes = New-Object byte[] $stream.Size
  $reader.ReadBytes($bytes)
  [System.IO.File]::WriteAllBytes((Join-Path (Resolve-Path $OutDir) ($l.Name + ".wav")), $bytes)
  Write-Host "wrote $($l.Name)"
}
