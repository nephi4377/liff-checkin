# Mirror tanxin.space published WP pages -> ./<path>/index.html and rewrite ONLY known page URLs to local relatives.
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$BaseRemote = "https://tanxin.space"
$PagesJson = Join-Path $Root "_wp-pages.json"
if (-not (Test-Path $PagesJson)) { Write-Error "Missing $PagesJson" }
$pages = Get-Content $PagesJson -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-UrlPath([string]$link) {
    $u = [Uri]$link
    return $u.AbsolutePath.Trim("/")
}

function Get-TanxinDepth([string]$htmlFilePath) {
    $parent = [IO.Path]::GetDirectoryName($htmlFilePath)
    if (-not $parent.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) { return 0 }
    $sub = $parent.Substring($Root.Length).Trim([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if ([string]::IsNullOrEmpty($sub)) { return 0 }
    return $sub.Split([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar, [System.StringSplitOptions]::RemoveEmptyEntries).Count
}

function Get-Prefix([int]$depth) {
    if ($depth -le 0) { return "./" }
    return ("../" * $depth)
}

Write-Host "Fetching home -> index.html"
curl.exe -sL "$BaseRemote/" -o (Join-Path $Root "index.html")

$mirrored = New-Object System.Collections.Generic.List[string]
foreach ($pg in $pages) {
    $path = Get-UrlPath $pg.link
    if ([string]::IsNullOrEmpty($path)) { continue }
    $dir = Join-Path $Root $path
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $out = Join-Path $dir "index.html"
    $url = $pg.link.TrimEnd("/") + "/"
    Write-Host "Fetching $url -> $path/index.html"
    curl.exe -sL $url -o $out
    if ((Get-Item $out).Length -lt 500) { Write-Warning "Small file: $out" }
    [void]$mirrored.Add($path)
}

# Longest path first so /foo/bar not cut by /foo
$knownPaths = $mirrored | Sort-Object { $_.Length } -Descending

function Rewrite-File([string]$filePath) {
    $depth = Get-TanxinDepth $filePath
    $pfx = Get-Prefix $depth
    $text = Get-Content -Path $filePath -Raw -Encoding UTF8

    foreach ($seg in $knownPaths) {
        $esc = [regex]::Escape($seg)
        $local = $pfx + $seg + "/"
        $text = $text -creplace "https://tanxin\.space/$esc/", $local
        $text = $text -creplace "http://tanxin\.space/$esc/", $local
        $text = $text -creplace "//tanxin\.space/$esc/", $local
    }

    $indexHref = $pfx + "index.html"
    $text = $text -replace 'href="https://tanxin.space/"', ('href="' + $indexHref + '"')
    $text = $text -replace "href='https://tanxin.space/'", ("href='" + $indexHref + "'")

    Set-Content -Path $filePath -Value $text -Encoding UTF8 -NoNewline
}

Rewrite-File (Join-Path $Root "index.html")
foreach ($p in $mirrored) {
    Rewrite-File (Join-Path (Join-Path $Root $p) "index.html")
}
Write-Host "Done. Paths: $($mirrored -join ', ')"
