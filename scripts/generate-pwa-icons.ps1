Add-Type -AssemblyName System.Drawing.Common

function New-VoceIcon {
  param(
    [Parameter(Mandatory)] [int] $Size,
    [Parameter(Mandatory)] [string] $OutputPath
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(28, 28, 26))

  $paper = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(251, 251, 250))
  $scale = $Size / 64.0
  $left = [System.Drawing.PointF[]] @(
    [System.Drawing.PointF]::new(12 * $scale, 17.5 * $scale),
    [System.Drawing.PointF]::new(21 * $scale, 18.2 * $scale),
    [System.Drawing.PointF]::new(28 * $scale, 22 * $scale),
    [System.Drawing.PointF]::new(32 * $scale, 25 * $scale),
    [System.Drawing.PointF]::new(32 * $scale, 49.5 * $scale),
    [System.Drawing.PointF]::new(24 * $scale, 42 * $scale),
    [System.Drawing.PointF]::new(13 * $scale, 39.7 * $scale)
  )
  $right = [System.Drawing.PointF[]] @(
    [System.Drawing.PointF]::new(52 * $scale, 17.5 * $scale),
    [System.Drawing.PointF]::new(43 * $scale, 18.2 * $scale),
    [System.Drawing.PointF]::new(36 * $scale, 22 * $scale),
    [System.Drawing.PointF]::new(32 * $scale, 25 * $scale),
    [System.Drawing.PointF]::new(32 * $scale, 49.5 * $scale),
    [System.Drawing.PointF]::new(40 * $scale, 42 * $scale),
    [System.Drawing.PointF]::new(51 * $scale, 39.7 * $scale)
  )

  $graphics.FillPolygon($paper, $left)
  $graphics.FillPolygon($paper, $right)
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $paper.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$publicDirectory = Join-Path $PSScriptRoot "..\public"
New-VoceIcon -Size 192 -OutputPath (Join-Path $publicDirectory "pwa-icon-192.png")
New-VoceIcon -Size 512 -OutputPath (Join-Path $publicDirectory "pwa-icon-512.png")
