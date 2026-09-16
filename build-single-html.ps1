$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = [Text.UTF8Encoding]::new($false)

$indexPath = Join-Path $root 'index.html'
$cssPath = Join-Path $root 'css\beam-design.css'
$distDir = Join-Path $root 'dist'
$outPath = Join-Path $distDir 'beam-design-single.html'

$jsFiles = @(
  'js\01-computation-engine.js',
  'js\sections\pfc-section-data.js',
  'js\sections\shs-section-data.js',
  'js\sections\rhs-section-data.js',
  'js\sections\ub-section-data.js',
  'js\sections\uc-section-data.js',
  'js\02-section-data.js',
  'js\03-state-ui.js',
  'js\04-checks.js',
  'js\checks\bs5950-checks.js',
  'js\checks\eurocode-checks.js',
  'js\05-diagrams.js',
  'js\05-section-view.js',
  'js\05-view3d.js',
  'js\06-render.js',
  'js\07-wiring.js',
  'js\08-mcr-eigen-patch.js',
  'js\09-startup.js'
)

$html = [IO.File]::ReadAllText($indexPath, $utf8)
$css = [IO.File]::ReadAllText($cssPath, $utf8).Trim()
$js = ($jsFiles | ForEach-Object {
  [IO.File]::ReadAllText((Join-Path $root $_), $utf8).Trim()
}) -join "`r`n`r`n"

$html = $html.Replace('<link rel="stylesheet" href="css/beam-design.css">', "<style>`r`n$css`r`n</style>")

$scriptBlockPattern = '(?s)  <script src="js/01-computation-engine\.js"></script>\r?\n.*?  <script src="js/09-startup\.js"></script>'

if (-not [regex]::IsMatch($html, $scriptBlockPattern)) {
  throw 'Expected script tag block was not found in index.html.'
}

$scriptReplacement = "<script>`r`n$js`r`n</script>"
$html = [regex]::Replace($html, $scriptBlockPattern, [Text.RegularExpressions.MatchEvaluator]{ param($match) $scriptReplacement })

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
[IO.File]::WriteAllText($outPath, $html, $utf8)

Write-Host "Built $outPath"
