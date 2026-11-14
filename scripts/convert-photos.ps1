# Convertit les photos brutes (data/photos-raw) en JPEG légers pour public/restaurant-photos.
# Ré-encoder supprime au passage les métadonnées (dont l'EXIF GPS) des photos d'origine.
param(
  [int]$Width = 900,
  [int]$Quality = 74,
  [string]$Src = (Join-Path $PSScriptRoot '..\data\photos-raw'),
  [string]$Dst = (Join-Path $PSScriptRoot '..\public\restaurant-photos')
)

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $Dst | Out-Null

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

$files = Get-ChildItem $Src -File -Include *.jpg, *.jpeg, *.png, *.webp
$done = 0
$failed = 0
$saved = 0

foreach ($f in $files) {
  $out = Join-Path $Dst ($f.BaseName + '.jpg')
  if ((Test-Path $out) -and (Get-Item $out).LastWriteTime -gt $f.LastWriteTime) { continue }
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    try {
      $w = [Math]::Min($Width, $img.Width)
      $h = [int][Math]::Round($img.Height * ($w / $img.Width))
      $bmp = New-Object System.Drawing.Bitmap($w, $h)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.DrawImage($img, 0, 0, $w, $h)
      $bmp.Save($out, $codec, $encParams)
      $g.Dispose(); $bmp.Dispose()
      $saved += (Get-Item $out).Length
      $done++
    } finally { $img.Dispose() }
  } catch {
    $failed++
    Write-Warning "échec $($f.Name) : $($_.Exception.Message)"
  }
}

"{0} converties, {1} échecs, {2:N1} Mo" -f $done, $failed, ($saved / 1MB)
