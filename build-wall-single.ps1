$ErrorActionPreference = 'Stop'

# Beam in Wall single-file build (20 Sep 2026): the mirror of build-single-html.ps1
# for wall.html -> dist/beam-in-wall-single.html. Both stylesheets are inlined in
# the order the page loads them and every script of wall.html (the beam-v03
# modules unchanged, then js/wall/01..04 and js/wall/09-wall-startup.js instead
# of js/09-startup.js) is concatenated in that order into one <script> block.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = [Text.UTF8Encoding]::new($false)

$indexPath = Join-Path $root 'wall.html'
$cssPath = Join-Path $root 'css\beam-design.css'
$cssWallPath = Join-Path $root 'css\beam-in-wall.css'
$distDir = Join-Path $root 'dist'
$outPath = Join-Path $distDir 'beam-in-wall-single.html'

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
  'js\checks\torsion-fe.js',
  'js\05-diagrams.js',
  'js\05-section-view.js',
  'js\05-view3d.js',
  'js\06-render.js',
  'js\06-brief-masterseries.js',
  'js\07-wiring.js',
  'js\08-mcr-eigen-patch.js',
  'js\wall\01-wall-state.js',
  'js\wall\02-wall-geometry.js',
  'js\wall\03-wall-ui.js',
  'js\wall\04-wall-report.js',
  'js\wall\09-wall-startup.js'
)

# every input normalised to CRLF (21 Sep 2026 review: the working tree mixes
# LF and CRLF sources, which made the dist mixed; the parity test in
# tests/wall/page.test.cjs compares with line endings normalised)
function Read-Crlf($path) { ([IO.File]::ReadAllText($path, $utf8) -replace "`r`n", "`n") -replace "`n", "`r`n" }

$html = Read-Crlf $indexPath
$css = (Read-Crlf $cssPath).Trim()
$cssWall = (Read-Crlf $cssWallPath).Trim()
$js = ($jsFiles | ForEach-Object {
  (Read-Crlf (Join-Path $root $_)).Trim()
}) -join "`r`n`r`n"

$html = $html.Replace('<link rel="stylesheet" href="css/beam-design.css">', "<style>`r`n$css`r`n</style>")
$html = $html.Replace('<link rel="stylesheet" href="css/beam-in-wall.css">', "<style>`r`n$cssWall`r`n</style>")

$scriptBlockPattern = '(?s)  <script src="js/01-computation-engine\.js"></script>\r?\n.*?  <script src="js/wall/09-wall-startup\.js"></script>'

if (-not [regex]::IsMatch($html, $scriptBlockPattern)) {
  throw 'Expected script tag block was not found in wall.html.'
}

$scriptReplacement = "<script>`r`n$js`r`n</script>"
$html = [regex]::Replace($html, $scriptBlockPattern, [Text.RegularExpressions.MatchEvaluator]{ param($match) $scriptReplacement })

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
[IO.File]::WriteAllText($outPath, $html, $utf8)

Write-Host "Built $outPath"
