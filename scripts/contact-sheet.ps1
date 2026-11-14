# Planche contact : assemble des vignettes pour vérifier d'un coup d'œil la qualité des photos récupérées.
param(
  [string]$Src = (Join-Path $PSScriptRoot '..\data\photos-raw'),
  [string]$Out = (Join-Path $PSScriptRoot '..\data\contact-sheet.png'),
  [int]$Count = 48,
  [int]$Cols = 6,
  [int]$ThumbW = 260,
  [int]$ThumbH = 190
)

Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem $Src -File | Sort-Object Name | Select-Object -First $Count
if (-not $files) { throw "Aucune image dans $Src" }

$rows = [int][Math]::Ceiling($files.Count / $Cols)
$sheet = New-Object System.Drawing.Bitmap(($Cols * $ThumbW), ($rows * $ThumbH))
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$i = 0
foreach ($f in $files) {
  $col = $i % $Cols
  $row = [int][Math]::Floor($i / $Cols)
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    # cadrage "cover" centré
    $scale = [Math]::Max($ThumbW / $img.Width, $ThumbH / $img.Height)
    $dw = [int]($img.Width * $scale); $dh = [int]($img.Height * $scale)
    $dx = $col * $ThumbW + [int](($ThumbW - $dw) / 2)
    $dy = $row * $ThumbH + [int](($ThumbH - $dh) / 2)
    $g.DrawImage($img, $dx, $dy, $dw, $dh)
    $img.Dispose()
  } catch { }
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
  $g.DrawRectangle($pen, ($col * $ThumbW), ($row * $ThumbH), ($ThumbW - 1), ($ThumbH - 1))
  $pen.Dispose()
  $i++
}

$g.Dispose()
$sheet.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
"planche : $Out ($($files.Count) vignettes)"
