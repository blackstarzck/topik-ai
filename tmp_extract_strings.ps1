$files = Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx
$set = New-Object 'System.Collections.Generic.HashSet[string]'
foreach($file in $files){
  $content = Get-Content -Path $file.FullName -Raw
  $matches = [regex]::Matches($content, "'([^'\\]*(?:\\.[^'\\]*)*)'")
  foreach($m in $matches){
    $value = $m.Groups[1].Value
    if($value -match '[^\x00-\x7F]' -or $value -match '\?'){
      $null = $set.Add($value)
    }
  }
  $dqMatches = [regex]::Matches($content, '"([^"\\]*(?:\\.[^"\\]*)*)"')
  foreach($m in $dqMatches){
    $value = $m.Groups[1].Value
    if($value -match '[^\x00-\x7F]' -or $value -match '\?'){
      $null = $set.Add($value)
    }
  }
}
$set | Sort-Object | ForEach-Object { Write-Output $_ }
