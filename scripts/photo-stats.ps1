# Calcule des statistiques simples par photo (couleurs dominantes, luminosité, contraste)
# pour repérer les logos, aplats, menus et bannières qui ne sont pas des photos.
param(
  [string]$Src = (Join-Path $PSScriptRoot '..\public\restaurant-photos'),
  [string]$Out = (Join-Path $PSScriptRoot '..\data\photo-stats.json'),
  [int]$Sample = 64
)

Add-Type -AssemblyName System.Drawing
$results = @()

foreach ($f in Get-ChildItem $Src -File -Filter *.jpg) {
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $origW = $img.Width; $origH = $img.Height
    $bmp = New-Object System.Drawing.Bitmap($Sample, $Sample)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $Sample, $Sample)
    $g.Dispose(); $img.Dispose()

    $buckets = @{}
    $sum = 0.0; $sumSq = 0.0
    for ($y = 0; $y -lt $Sample; $y++) {
      for ($x = 0; $x -lt $Sample; $x++) {
        $c = $bmp.GetPixel($x, $y)
        $key = (($c.R -shr 3) -shl 10) -bor (($c.G -shr 3) -shl 5) -bor ($c.B -shr 3)
        if ($buckets.ContainsKey($key)) { $buckets[$key]++ } else { $buckets[$key] = 1 }
        $lum = 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B
        $sum += $lum; $sumSq += $lum * $lum
      }
    }
    $total = $Sample * $Sample
    $max = ($buckets.Values | Measure-Object -Maximum).Maximum
    $mean = $sum / $total
    $std = [Math]::Sqrt([Math]::Max(0, ($sumSq / $total) - ($mean * $mean)))
    $bmp.Dispose()

    $results += [pscustomobject]@{
      id     = $f.BaseName
      w      = $origW
      h      = $origH
      ratio  = [Math]::Round($origW / $origH, 2)
      colors = $buckets.Count
      top    = [Math]::Round($max / $total, 3)
      mean   = [Math]::Round($mean, 1)
      std    = [Math]::Round($std, 1)
    }
  } catch {
    Write-Warning "stats impossibles $($f.Name) : $($_.Exception.Message)"
  }
}

$results | ConvertTo-Json -Compress | Set-Content -Encoding UTF8 $Out
"$($results.Count) photos analysées -> $Out"
