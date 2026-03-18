# ═══════════════════════════════════════════════════════════════════════════════
# PAI Status Line (Windows PowerShell)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Responsive status line with 4 display modes based on terminal width:
#   - nano   (<35 cols): Minimal single-line displays
#   - micro  (35-54):    Compact with key metrics
#   - mini   (55-79):    Balanced information density
#   - normal (80+):      Full display with sparklines
#
# Output order: Greeting → Wielding → Git → Learning → Signal → Context → Quote
#
# KNOWN LIMITATION: Context percentage won't match /context exactly.
# Hook JSON excludes system prompt, tools, MCP tokens. See:
# github.com/anthropics/claude-code/issues/13783
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'SilentlyContinue'

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

$PAI_DIR = if ($env:PAI_DIR) { $env:PAI_DIR } else { Join-Path $env:USERPROFILE ".claude" }
$SETTINGS_FILE = Join-Path $PAI_DIR "settings.json"
$RATINGS_FILE = Join-Path $PAI_DIR "MEMORY\LEARNING\SIGNALS\ratings.jsonl"
$TREND_CACHE = Join-Path $PAI_DIR "MEMORY\STATE\trending-cache.json"
$MODEL_CACHE = Join-Path $PAI_DIR "MEMORY\STATE\model-cache.txt"
$QUOTE_CACHE = Join-Path $PAI_DIR ".quote-cache"
$LOCATION_CACHE = Join-Path $PAI_DIR "MEMORY\STATE\location-cache.json"
$WEATHER_CACHE = Join-Path $PAI_DIR "MEMORY\STATE\weather-cache.json"

# Context baseline: preloaded tokens not visible to hooks (~22.6k typical)
$CONTEXT_BASELINE = 22600

# Cache TTL in seconds
$LOCATION_CACHE_TTL = 3600  # 1 hour
$WEATHER_CACHE_TTL = 900    # 15 minutes

# Source .env for API keys
$envFile = Join-Path $PAI_DIR ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# TERMINAL WIDTH DETECTION
# ─────────────────────────────────────────────────────────────────────────────

function Detect-TerminalWidth {
    try {
        $width = $Host.UI.RawUI.WindowSize.Width
        if ($width -gt 0) { return $width }
    } catch {}

    try {
        $width = [Console]::WindowWidth
        if ($width -gt 0) { return $width }
    } catch {}

    if ($env:COLUMNS) { return [int]$env:COLUMNS }
    return 80
}

$termWidth = Detect-TerminalWidth

if ($termWidth -lt 35) { $MODE = "nano" }
elseif ($termWidth -lt 55) { $MODE = "micro" }
elseif ($termWidth -lt 80) { $MODE = "mini" }
else { $MODE = "normal" }

# ─────────────────────────────────────────────────────────────────────────────
# PARSE INPUT
# ─────────────────────────────────────────────────────────────────────────────

$inputText = $input | Out-String

# Get DA name and PAI version from settings
$settingsObj = $null
if (Test-Path $SETTINGS_FILE) {
    try { $settingsObj = Get-Content $SETTINGS_FILE -Raw | ConvertFrom-Json } catch {}
}

$DA_NAME = "Assistant"
if ($settingsObj) {
    if ($settingsObj.daidentity.name) { $DA_NAME = $settingsObj.daidentity.name }
    elseif ($settingsObj.daidentity.displayName) { $DA_NAME = $settingsObj.daidentity.displayName }
    elseif ($settingsObj.env.DA) { $DA_NAME = $settingsObj.env.DA }
}

$PAI_VERSION = "—"
if ($settingsObj -and $settingsObj.paiVersion) { $PAI_VERSION = $settingsObj.paiVersion }

# Parse JSON input
$inputObj = $null
try { $inputObj = $inputText | ConvertFrom-Json } catch {}

if ($inputObj) {
    $current_dir = if ($inputObj.workspace.current_dir) { $inputObj.workspace.current_dir } elseif ($inputObj.cwd) { $inputObj.cwd } else { "" }
    $model_name = if ($inputObj.model.display_name) { $inputObj.model.display_name } else { "" }
    $cc_version_json = if ($inputObj.version) { $inputObj.version } else { "" }
    $duration_ms = if ($inputObj.cost.total_duration_ms) { [int]$inputObj.cost.total_duration_ms } else { 0 }
    $cache_read = if ($inputObj.context_window.current_usage.cache_read_input_tokens) { [int]$inputObj.context_window.current_usage.cache_read_input_tokens } else { 0 }
    $input_tokens = if ($inputObj.context_window.current_usage.input_tokens) { [int]$inputObj.context_window.current_usage.input_tokens } else { 0 }
    $cache_creation = if ($inputObj.context_window.current_usage.cache_creation_input_tokens) { [int]$inputObj.context_window.current_usage.cache_creation_input_tokens } else { 0 }
    $output_tokens = if ($inputObj.context_window.current_usage.output_tokens) { [int]$inputObj.context_window.current_usage.output_tokens } else { 0 }
    $context_max = if ($inputObj.context_window.context_window_size) { [int]$inputObj.context_window.context_window_size } else { 200000 }
} else {
    $current_dir = ""; $model_name = ""; $cc_version_json = ""; $duration_ms = 0
    $cache_read = 0; $input_tokens = 0; $cache_creation = 0; $output_tokens = 0; $context_max = 200000
}

# Get Claude Code version
if ($cc_version_json -and $cc_version_json -ne "unknown") {
    $cc_version = $cc_version_json
} else {
    try { $cc_version = (claude --version 2>$null | Select-Object -First 1).Split(' ')[0] } catch { $cc_version = "unknown" }
}

# Cache model name
$modelCacheDir = Split-Path $MODEL_CACHE -Parent
if (!(Test-Path $modelCacheDir)) { New-Item -ItemType Directory -Path $modelCacheDir -Force | Out-Null }
$model_name | Out-File -FilePath $MODEL_CACHE -NoNewline -Encoding UTF8 2>$null

$dir_name = Split-Path $current_dir -Leaf

# ─────────────────────────────────────────────────────────────────────────────
# COUNT RESOURCES
# ─────────────────────────────────────────────────────────────────────────────

$skillsDir = Join-Path $PAI_DIR "skills"
$hooksDir = Join-Path $PAI_DIR "hooks"
$memLearningDir = Join-Path $PAI_DIR "MEMORY\LEARNING"
$memWorkDir = Join-Path $PAI_DIR "MEMORY\WORK"
$memResearchDir = Join-Path $PAI_DIR "MEMORY\RESEARCH"

$skills_count = if (Test-Path $skillsDir) { @(Get-ChildItem -Path $skillsDir -Directory 2>$null).Count } else { 0 }
$workflows_count = if (Test-Path $skillsDir) { @(Get-ChildItem -Path "$skillsDir\*\workflows\*.md" -File 2>$null).Count } else { 0 }
$hooks_count = if (Test-Path $hooksDir) { @(Get-ChildItem -Path $hooksDir -Filter "*.ts" -File 2>$null).Count } else { 0 }
$learning_count = if (Test-Path $memLearningDir) { @(Get-ChildItem -Path $memLearningDir -Filter "*.md" -Recurse -File 2>$null).Count } else { 0 }
$work_count = if (Test-Path $memWorkDir) { @(Get-ChildItem -Path $memWorkDir -Directory -Depth 1 2>$null | Where-Object { $_.PSParentPath -ne (Resolve-Path $memWorkDir).Path }).Count } else { 0 }
$ratings_count = 0
if (Test-Path $RATINGS_FILE) { $ratings_count = @(Get-Content $RATINGS_FILE 2>$null).Count }
$sessions_count = if (Test-Path (Join-Path $PAI_DIR "MEMORY")) { @(Get-ChildItem -Path (Join-Path $PAI_DIR "MEMORY") -Filter "*.jsonl" -Recurse -File 2>$null).Count } else { 0 }
$research_count = if (Test-Path $memResearchDir) { @(Get-ChildItem -Path $memResearchDir -Include "*.md","*.json" -Recurse -File 2>$null).Count } else { 0 }

# ─────────────────────────────────────────────────────────────────────────────
# COLOR PALETTE
# ─────────────────────────────────────────────────────────────────────────────

$ESC = [char]0x1B
$RESET = "$ESC[0m"

# Structural
$SLATE_300 = "$ESC[38;2;203;213;225m"
$SLATE_400 = "$ESC[38;2;148;163;184m"
$SLATE_500 = "$ESC[38;2;100;116;139m"
$SLATE_600 = "$ESC[38;2;71;85;105m"

# Semantic
$EMERALD = "$ESC[38;2;74;222;128m"
$ROSE = "$ESC[38;2;251;113;133m"

# Rating gradient
$RATING_10 = "$ESC[38;2;74;222;128m"
$RATING_8 = "$ESC[38;2;163;230;53m"
$RATING_7 = "$ESC[38;2;250;204;21m"
$RATING_6 = "$ESC[38;2;251;191;36m"
$RATING_5 = "$ESC[38;2;251;146;60m"
$RATING_4 = "$ESC[38;2;248;113;113m"
$RATING_LOW = "$ESC[38;2;239;68;68m"

# Line 1: Greeting
$GREET_PRIMARY = "$ESC[38;2;167;139;250m"
$GREET_SECONDARY = "$ESC[38;2;139;92;246m"
$GREET_ACCENT = "$ESC[38;2;196;181;253m"

# Line 2: Wielding
$WIELD_PRIMARY = "$ESC[38;2;34;211;238m"
$WIELD_SECONDARY = "$ESC[38;2;45;212;191m"
$WIELD_ACCENT = "$ESC[38;2;103;232;249m"
$WIELD_WORKFLOWS = "$ESC[38;2;94;234;212m"
$WIELD_HOOKS = "$ESC[38;2;6;182;212m"
$WIELD_LEARNINGS = "$ESC[38;2;20;184;166m"

# Line 3: Git
$GIT_PRIMARY = "$ESC[38;2;56;189;248m"
$GIT_VALUE = "$ESC[38;2;186;230;253m"
$GIT_DIR = "$ESC[38;2;147;197;253m"
$GIT_CLEAN = "$ESC[38;2;125;211;252m"
$GIT_MODIFIED = "$ESC[38;2;96;165;250m"
$GIT_ADDED = "$ESC[38;2;59;130;246m"
$GIT_STASH = "$ESC[38;2;165;180;252m"
$GIT_AGE_FRESH = "$ESC[38;2;125;211;252m"
$GIT_AGE_RECENT = "$ESC[38;2;96;165;250m"
$GIT_AGE_STALE = "$ESC[38;2;59;130;246m"
$GIT_AGE_OLD = "$ESC[38;2;99;102;241m"

# Line 4: Learning
$LEARN_PRIMARY = "$ESC[38;2;167;139;250m"
$LEARN_SECONDARY = "$ESC[38;2;196;181;253m"
$LEARN_WORK = "$ESC[38;2;192;132;252m"
$LEARN_SIGNALS = "$ESC[38;2;139;92;246m"
$LEARN_RESEARCH = "$ESC[38;2;129;140;248m"
$LEARN_SESSIONS = "$ESC[38;2;99;102;241m"

# Line 5: Signal
$SIGNAL_LABEL = "$ESC[38;2;56;189;248m"
$SIGNAL_COLOR = "$ESC[38;2;96;165;250m"
$SIGNAL_PERIOD = "$ESC[38;2;148;163;184m"
$LEARN_LABEL = "$ESC[38;2;21;128;61m"

# Line 6: Context
$CTX_PRIMARY = "$ESC[38;2;129;140;248m"
$CTX_SECONDARY = "$ESC[38;2;165;180;252m"
$CTX_ACCENT = "$ESC[38;2;139;92;246m"
$CTX_BUCKET_EMPTY = "$ESC[38;2;75;82;95m"

# Line 7: Quote
$QUOTE_PRIMARY = "$ESC[38;2;252;211;77m"
$QUOTE_AUTHOR = "$ESC[38;2;180;140;60m"

# PAI Branding
$PAI_P = "$ESC[38;2;30;58;138m"
$PAI_A = "$ESC[38;2;59;130;246m"
$PAI_I = "$ESC[38;2;147;197;253m"
$PAI_LABEL = "$ESC[38;2;100;116;139m"
$PAI_CITY = "$ESC[38;2;147;197;253m"
$PAI_STATE_COLOR = "$ESC[38;2;100;116;139m"
$PAI_TIME = "$ESC[38;2;96;165;250m"
$PAI_WEATHER = "$ESC[38;2;135;206;235m"

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

function Get-RatingColor {
    param([string]$val)
    if ($val -eq "—" -or [string]::IsNullOrEmpty($val)) { return $SLATE_400 }
    $rating_int = [math]::Floor([double]$val)
    if ($rating_int -ge 9) { return $RATING_10 }
    elseif ($rating_int -ge 8) { return $RATING_8 }
    elseif ($rating_int -ge 7) { return $RATING_7 }
    elseif ($rating_int -ge 6) { return $RATING_6 }
    elseif ($rating_int -ge 5) { return $RATING_5 }
    elseif ($rating_int -ge 4) { return $RATING_4 }
    else { return $RATING_LOW }
}

function Get-BucketColor {
    param([int]$pos, [int]$max)
    $pct = [int]($pos * 100 / $max)
    if ($pct -le 33) {
        $r = 74 + (250 - 74) * $pct / 33
        $g = 222 + (204 - 222) * $pct / 33
        $b = 128 + (21 - 128) * $pct / 33
    } elseif ($pct -le 66) {
        $t = $pct - 33
        $r = 250 + (251 - 250) * $t / 33
        $g = 204 + (146 - 204) * $t / 33
        $b = 21 + (60 - 21) * $t / 33
    } else {
        $t = $pct - 66
        $r = 251 + (239 - 251) * $t / 34
        $g = 146 + (68 - 146) * $t / 34
        $b = 60 + (68 - 60) * $t / 34
    }
    return "$ESC[38;2;$([int]$r);$([int]$g);$([int]$b)m"
}

$script:LAST_BUCKET_COLOR = $EMERALD

function Render-ContextBar {
    param([int]$width, [int]$pct)
    $output = ""
    if ($pct -gt 100) { $pct = 100 }
    $filled = [int]($pct * $width / 100)
    if ($filled -lt 0) { $filled = 0 }

    for ($i = 1; $i -le $width; $i++) {
        if ($i -le $filled) {
            $color = Get-BucketColor -pos $i -max $width
            $script:LAST_BUCKET_COLOR = $color
            $output += "${color}`u{26C1}${RESET}"
            if ($width -gt 8) { $output += " " }
        } else {
            $output += "${CTX_BUCKET_EMPTY}`u{26C1}${RESET}"
            if ($width -gt 8) { $output += " " }
        }
    }
    $output = $output.TrimEnd()
    return $output
}

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 0: PAI BRANDING
# ═══════════════════════════════════════════════════════════════════════════════

$current_time = Get-Date -Format "HH:mm"

function Fetch-Location {
    $cache_age = 999999
    if (Test-Path $LOCATION_CACHE) {
        $cache_age = [int]((Get-Date) - (Get-Item $LOCATION_CACHE).LastWriteTime).TotalSeconds
    }
    if ($cache_age -gt $LOCATION_CACHE_TTL) {
        try {
            $loc_data = Invoke-RestMethod -Uri "http://ip-api.com/json/?fields=city,regionName,country,lat,lon" -TimeoutSec 2 2>$null
            if ($loc_data -and $loc_data.city) {
                $loc_data | ConvertTo-Json | Out-File -FilePath $LOCATION_CACHE -Encoding UTF8
            }
        } catch {}
    }
    if (Test-Path $LOCATION_CACHE) {
        try {
            $loc = Get-Content $LOCATION_CACHE -Raw | ConvertFrom-Json
            return "$($loc.city)|$($loc.regionName)"
        } catch {}
    }
    return "Unknown|"
}

function Fetch-Weather {
    $cache_age = 999999
    if (Test-Path $WEATHER_CACHE) {
        $cache_age = [int]((Get-Date) - (Get-Item $WEATHER_CACHE).LastWriteTime).TotalSeconds
    }
    if ($cache_age -gt $WEATHER_CACHE_TTL) {
        $lat = "37.7749"; $lon = "-122.4194"
        if (Test-Path $LOCATION_CACHE) {
            try {
                $loc = Get-Content $LOCATION_CACHE -Raw | ConvertFrom-Json
                if ($loc.lat) { $lat = $loc.lat }
                if ($loc.lon) { $lon = $loc.lon }
            } catch {}
        }
        try {
            $weather = Invoke-RestMethod -Uri "https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius" -TimeoutSec 3 2>$null
            if ($weather -and $weather.current) {
                $temp = $weather.current.temperature_2m
                $code = $weather.current.weather_code
                $condition = switch ($code) {
                    0 { "Clear" }
                    { $_ -in 1,2,3 } { "Cloudy" }
                    { $_ -in 45,48 } { "Foggy" }
                    { $_ -in 51,53,55,56,57 } { "Drizzle" }
                    { $_ -in 61,63,65,66,67 } { "Rain" }
                    { $_ -in 71,73,75,77 } { "Snow" }
                    { $_ -in 80,81,82 } { "Showers" }
                    { $_ -in 85,86 } { "Snow" }
                    { $_ -in 95,96,99 } { "Storm" }
                    default { "Clear" }
                }
                "${temp}`u{00B0}C ${condition}" | Out-File -FilePath $WEATHER_CACHE -NoNewline -Encoding UTF8
            }
        } catch {}
    }
    if (Test-Path $WEATHER_CACHE) {
        return (Get-Content $WEATHER_CACHE -Raw 2>$null)
    }
    return "`u{2014}"
}

$location_raw = Fetch-Location
$location_city = ($location_raw -split '\|')[0]
$location_state_str = ($location_raw -split '\|')[1]
$weather_str = Fetch-Weather

switch ($MODE) {
    "nano" {
        Write-Host "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${SLATE_600}│ ────────────${RESET}"
        Write-Host "${PAI_TIME}${current_time}${RESET} ${PAI_WEATHER}${weather_str}${RESET}"
        Write-Host "${SLATE_400}ENV:${RESET} ${SLATE_500}v${PAI_A}${PAI_VERSION}${RESET} ${SLATE_400}S:${SLATE_300}${skills_count}${RESET}"
    }
    "micro" {
        Write-Host "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ──────────────────${RESET}"
        Write-Host "${PAI_LABEL}LOC:${RESET} ${PAI_CITY}${location_city}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}"
        Write-Host "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${RESET} ${PAI_A}v${PAI_VERSION}${RESET} ${SLATE_600}│${RESET} ${SLATE_400}S:${SLATE_300}${skills_count}${RESET} ${SLATE_400}W:${SLATE_300}${workflows_count}${RESET} ${SLATE_400}H:${SLATE_300}${hooks_count}${RESET}"
    }
    "mini" {
        Write-Host "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ────────────────────────────────────────${RESET}"
        Write-Host "${PAI_LABEL}LOC:${RESET} ${PAI_CITY}${location_city}${RESET}${SLATE_600},${RESET} ${PAI_STATE_COLOR}${location_state_str}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}"
        Write-Host "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${RESET} ${PAI_A}v${PAI_VERSION}${RESET} ${SLATE_600}│${RESET} ${WIELD_ACCENT}Skills:${RESET}${SLATE_300}${skills_count}${RESET} ${WIELD_WORKFLOWS}Workflows:${RESET}${SLATE_300}${workflows_count}${RESET} ${WIELD_HOOKS}Hooks:${RESET}${SLATE_300}${hooks_count}${RESET}"
    }
    "normal" {
        Write-Host "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ──────────────────────────────────────────────────${RESET}"
        Write-Host "${PAI_LABEL}LOC:${RESET} ${PAI_CITY}${location_city}${RESET}${SLATE_600},${RESET} ${PAI_STATE_COLOR}${location_state_str}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}"
        Write-Host "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${RESET} ${PAI_A}v${PAI_VERSION}${RESET} ${SLATE_600}│${RESET} ${WIELD_ACCENT}Skills:${RESET} ${SLATE_300}${skills_count}${RESET} ${SLATE_600}│${RESET} ${WIELD_WORKFLOWS}Workflows:${RESET} ${SLATE_300}${workflows_count}${RESET} ${SLATE_600}│${RESET} ${WIELD_HOOKS}Hooks:${RESET} ${SLATE_300}${hooks_count}${RESET}"
    }
}
Write-Host "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 1: CONTEXT
# ═══════════════════════════════════════════════════════════════════════════════

$duration_sec = [int]($duration_ms / 1000)
if ($duration_sec -ge 3600) { $time_display = "$([int]($duration_sec / 3600))h$([int]($duration_sec % 3600 / 60))m" }
elseif ($duration_sec -ge 60) { $time_display = "$([int]($duration_sec / 60))m$($duration_sec % 60)s" }
else { $time_display = "${duration_sec}s" }

$content_tokens = $cache_read + $input_tokens + $cache_creation + $output_tokens
$context_used = $content_tokens + $CONTEXT_BASELINE

if ($context_max -gt 0 -and $context_used -gt 0) {
    $context_pct = [int]($context_used * 100 / $context_max)
    $context_k = [int]($context_used / 1000)
    $max_k = [int]($context_max / 1000)
} else {
    $context_pct = 0; $context_k = 0; $max_k = [int]($context_max / 1000)
}

if ($context_pct -le 33) { $pct_color = $EMERALD }
elseif ($context_pct -le 66) { $pct_color = "$ESC[38;2;251;191;36m" }
else { $pct_color = $ROSE }

switch ($MODE) {
    "nano" {
        $bar = Render-ContextBar -width 5 -pct $context_pct
        Write-Host "${CTX_PRIMARY}`u{25C9}${RESET} ${bar} ${pct_color}${context_pct}%${RESET} ${CTX_ACCENT}`u{23F1}${RESET} ${SLATE_300}${time_display}${RESET}"
    }
    "micro" {
        $bar = Render-ContextBar -width 6 -pct $context_pct
        Write-Host "${CTX_PRIMARY}`u{25C9}${RESET} ${bar} ${pct_color}${context_pct}%${RESET} ${SLATE_500}(${context_k}k)${RESET} ${CTX_ACCENT}`u{23F1}${RESET} ${SLATE_300}${time_display}${RESET}"
    }
    "mini" {
        $bar = Render-ContextBar -width 8 -pct $context_pct
        Write-Host -NoNewline "${CTX_PRIMARY}`u{25C9}${RESET} ${CTX_SECONDARY}CONTEXT:${RESET} ${bar} "
        Write-Host -NoNewline "${pct_color}${context_pct}%${RESET} ${SLATE_500}(${context_k}k/${max_k}k)${RESET} "
        Write-Host "${CTX_ACCENT}`u{23F1}${RESET} ${SLATE_300}${time_display}${RESET}"
    }
    "normal" {
        $bar = Render-ContextBar -width 16 -pct $context_pct
        Write-Host -NoNewline "${CTX_PRIMARY}`u{25C9}${RESET} ${CTX_SECONDARY}CONTEXT:${RESET} ${bar} "
        Write-Host -NoNewline "$($script:LAST_BUCKET_COLOR)${context_pct}%${RESET} ${SLATE_500}(${context_k}k/${max_k}k)${RESET}"
        Write-Host " ${SLATE_600}│${RESET} ${CTX_ACCENT}`u{23F1}${RESET} ${SLATE_300}${time_display}${RESET}"
    }
}
Write-Host "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 4: GIT STATUS
# ═══════════════════════════════════════════════════════════════════════════════

$gitDir = git rev-parse --git-dir 2>$null
if ($gitDir) {
    $branch = git branch --show-current 2>$null
    if (!$branch) { $branch = "detached" }
    $modified = @(git diff --name-only 2>$null).Count
    $staged = @(git diff --cached --name-only 2>$null).Count
    $untracked = @(git ls-files --others --exclude-standard 2>$null).Count
    $stash_count = @(git stash list 2>$null).Count
    $total_changed = $modified + $staged

    $ahead = 0; $behind = 0
    $ab = git rev-list --left-right --count "HEAD...@{u}" 2>$null
    if ($ab) {
        $parts = $ab -split '\s+'
        $ahead = [int]$parts[0]
        $behind = [int]$parts[1]
    }

    $age_display = ""; $age_color = $GIT_AGE_FRESH
    $last_commit_epoch = git log -1 --format='%ct' 2>$null
    if ($last_commit_epoch) {
        $now_epoch = [int][DateTimeOffset]::Now.ToUnixTimeSeconds()
        $age_seconds = $now_epoch - [int]$last_commit_epoch
        $age_minutes = [int]($age_seconds / 60)
        $age_hours = [int]($age_seconds / 3600)
        $age_days = [int]($age_seconds / 86400)

        if ($age_minutes -lt 1) { $age_display = "now"; $age_color = $GIT_AGE_FRESH }
        elseif ($age_hours -lt 1) { $age_display = "${age_minutes}m"; $age_color = $GIT_AGE_FRESH }
        elseif ($age_hours -lt 24) { $age_display = "${age_hours}h"; $age_color = $GIT_AGE_RECENT }
        elseif ($age_days -lt 7) { $age_display = "${age_days}d"; $age_color = $GIT_AGE_STALE }
        else { $age_display = "${age_days}d"; $age_color = $GIT_AGE_OLD }
    }

    if ($total_changed -gt 0 -or $untracked -gt 0) { $git_status_icon = "*" } else { $git_status_icon = "`u{2713}" }

    switch ($MODE) {
        "nano" {
            Write-Host -NoNewline "${GIT_PRIMARY}`u{25C8}${RESET} ${GIT_DIR}${dir_name}${RESET} ${GIT_VALUE}${branch}${RESET} "
            if ($git_status_icon -eq "`u{2713}") { Write-Host "${GIT_CLEAN}`u{2713}${RESET}" }
            else { Write-Host "${GIT_MODIFIED}*${total_changed}${RESET}" }
        }
        "micro" {
            Write-Host -NoNewline "${GIT_PRIMARY}`u{25C8}${RESET} ${GIT_DIR}${dir_name}${RESET} ${GIT_VALUE}${branch}${RESET}"
            if ($age_display) { Write-Host -NoNewline " ${age_color}${age_display}${RESET}" }
            Write-Host -NoNewline " "
            if ($git_status_icon -eq "`u{2713}") { Write-Host "${GIT_CLEAN}${git_status_icon}${RESET}" }
            else { Write-Host "${GIT_MODIFIED}${git_status_icon}${total_changed}${RESET}" }
        }
        "mini" {
            Write-Host -NoNewline "${GIT_PRIMARY}`u{25C8}${RESET} ${GIT_DIR}${dir_name}${RESET} ${SLATE_600}│${RESET} "
            Write-Host -NoNewline "${GIT_VALUE}${branch}${RESET}"
            if ($age_display) { Write-Host -NoNewline " ${SLATE_600}│${RESET} ${age_color}${age_display}${RESET}" }
            Write-Host -NoNewline " ${SLATE_600}│${RESET} "
            if ($git_status_icon -eq "`u{2713}") { Write-Host "${GIT_CLEAN}${git_status_icon}${RESET}" }
            else {
                Write-Host -NoNewline "${GIT_MODIFIED}${git_status_icon}${total_changed}${RESET}"
                if ($untracked -gt 0) { Write-Host -NoNewline " ${GIT_ADDED}+${untracked}${RESET}" }
                Write-Host ""
            }
        }
        "normal" {
            Write-Host -NoNewline "${GIT_PRIMARY}`u{25C8}${RESET} ${GIT_PRIMARY}PWD:${RESET} ${GIT_DIR}${dir_name}${RESET} ${SLATE_600}│${RESET} "
            Write-Host -NoNewline "${GIT_PRIMARY}Branch:${RESET} ${GIT_VALUE}${branch}${RESET}"
            if ($age_display) { Write-Host -NoNewline " ${SLATE_600}│${RESET} ${GIT_PRIMARY}Age:${RESET} ${age_color}${age_display}${RESET}" }
            if ($stash_count -gt 0) { Write-Host -NoNewline " ${SLATE_600}│${RESET} ${GIT_PRIMARY}Stash:${RESET} ${GIT_STASH}${stash_count}${RESET}" }
            if ($total_changed -gt 0 -or $untracked -gt 0) {
                Write-Host -NoNewline " ${SLATE_600}│${RESET} "
                if ($total_changed -gt 0) { Write-Host -NoNewline "${GIT_PRIMARY}Mod:${RESET} ${GIT_MODIFIED}${total_changed}${RESET}" }
                if ($untracked -gt 0) {
                    if ($total_changed -gt 0) { Write-Host -NoNewline " " }
                    Write-Host -NoNewline "${GIT_PRIMARY}New:${RESET} ${GIT_ADDED}${untracked}${RESET}"
                }
            } else {
                Write-Host -NoNewline " ${SLATE_600}│${RESET} ${GIT_CLEAN}`u{2713} clean${RESET}"
            }
            if ($ahead -gt 0 -or $behind -gt 0) {
                Write-Host -NoNewline " ${SLATE_600}│${RESET} ${GIT_PRIMARY}Sync:${RESET} "
                if ($ahead -gt 0) { Write-Host -NoNewline "${GIT_CLEAN}`u{2191}${ahead}${RESET}" }
                if ($behind -gt 0) { Write-Host -NoNewline "${GIT_STASH}`u{2193}${behind}${RESET}" }
            }
            Write-Host ""
        }
    }
}
Write-Host "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 5: MEMORY
# ═══════════════════════════════════════════════════════════════════════════════

switch ($MODE) {
    "nano" {
        Write-Host "${LEARN_PRIMARY}`u{25CE}${RESET} ${LEARN_WORK}`u{1F4C1}${RESET}${SLATE_300}${work_count}${RESET} ${LEARN_SIGNALS}`u{2726}${RESET}${SLATE_300}${ratings_count}${RESET} ${LEARN_SESSIONS}`u{2295}${RESET}${SLATE_300}${sessions_count}${RESET} ${LEARN_RESEARCH}`u{25C7}${RESET}${SLATE_300}${research_count}${RESET}"
    }
    "micro" {
        Write-Host "${LEARN_PRIMARY}`u{25CE}${RESET} ${LEARN_WORK}`u{1F4C1}${RESET}${SLATE_300}${work_count}${RESET} ${LEARN_SIGNALS}`u{2726}${RESET}${SLATE_300}${ratings_count}${RESET} ${LEARN_SESSIONS}`u{2295}${RESET}${SLATE_300}${sessions_count}${RESET} ${LEARN_RESEARCH}`u{25C7}${RESET}${SLATE_300}${research_count}${RESET}"
    }
    "mini" {
        Write-Host -NoNewline "${LEARN_PRIMARY}`u{25CE}${RESET} ${LEARN_SECONDARY}MEMORY:${RESET} "
        Write-Host -NoNewline "${LEARN_WORK}`u{1F4C1}${RESET}${SLATE_300}${work_count}${RESET} "
        Write-Host -NoNewline "${SLATE_600}│${RESET} ${LEARN_SIGNALS}`u{2726}${RESET}${SLATE_300}${ratings_count}${RESET} "
        Write-Host -NoNewline "${SLATE_600}│${RESET} ${LEARN_SESSIONS}`u{2295}${RESET}${SLATE_300}${sessions_count}${RESET} "
        Write-Host "${SLATE_600}│${RESET} ${LEARN_RESEARCH}`u{25C7}${RESET}${SLATE_300}${research_count}${RESET}"
    }
    "normal" {
        Write-Host -NoNewline "${LEARN_PRIMARY}`u{25CE}${RESET} ${LEARN_SECONDARY}MEMORY:${RESET} "
        Write-Host -NoNewline "${LEARN_WORK}`u{1F4C1}${RESET}${SLATE_300}${work_count}${RESET} ${LEARN_WORK}Work${RESET} "
        Write-Host -NoNewline "${SLATE_600}│${RESET} ${LEARN_SIGNALS}`u{2726}${RESET}${SLATE_300}${ratings_count}${RESET} ${LEARN_SIGNALS}Ratings${RESET} "
        Write-Host -NoNewline "${SLATE_600}│${RESET} ${LEARN_SESSIONS}`u{2295}${RESET}${SLATE_300}${sessions_count}${RESET} ${LEARN_SESSIONS}Sessions${RESET} "
        Write-Host "${SLATE_600}│${RESET} ${LEARN_RESEARCH}`u{25C7}${RESET}${SLATE_300}${research_count}${RESET} ${LEARN_RESEARCH}Research${RESET}"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 6: LEARNING (with sparklines in normal mode)
# ═══════════════════════════════════════════════════════════════════════════════

if ((Test-Path $RATINGS_FILE) -and (Get-Item $RATINGS_FILE).Length -gt 0) {
    $now = [int][DateTimeOffset]::Now.ToUnixTimeSeconds()

    # Parse ratings
    $ratings = @()
    Get-Content $RATINGS_FILE | ForEach-Object {
        try {
            $r = $_ | ConvertFrom-Json
            if ($null -ne $r.rating) {
                $epoch = [int][DateTimeOffset]::Parse($r.timestamp).ToUnixTimeSeconds()
                $ratings += [PSCustomObject]@{ rating = [double]$r.rating; epoch = $epoch; source = $r.source }
            }
        } catch {}
    }

    $total_count = $ratings.Count

    if ($total_count -gt 0) {
        # Time boundaries
        $q15_start = $now - 900
        $hour_start = $now - 3600
        $today_start = $now - 86400
        $week_start = $now - 604800
        $month_start = $now - 2592000

        # Calculate averages
        function Get-PeriodAvg { param($data, $start)
            $filtered = @($data | Where-Object { $_.epoch -ge $start })
            if ($filtered.Count -gt 0) { return [math]::Round(($filtered | Measure-Object -Property rating -Average).Average, 1).ToString() }
            return "`u{2014}"
        }

        $q15_avg = Get-PeriodAvg $ratings $q15_start
        $hour_avg = Get-PeriodAvg $ratings $hour_start
        $today_avg = Get-PeriodAvg $ratings $today_start
        $week_avg = Get-PeriodAvg $ratings $week_start
        $month_avg = Get-PeriodAvg $ratings $month_start
        $all_avg = [math]::Round(($ratings | Measure-Object -Property rating -Average).Average, 1).ToString()

        $latest = $ratings[-1].rating.ToString()
        $latest_source = if ($ratings[-1].source) { $ratings[-1].source } else { "explicit" }

        # Trend calculation
        if ($ratings.Count -ge 4) {
            $half = [int]($ratings.Count / 2)
            $recent_avg = ($ratings[-${half}..(-1)] | Measure-Object -Property rating -Average).Average
            $older_avg = ($ratings[0..($half-1)] | Measure-Object -Property rating -Average).Average
            $diff = $recent_avg - $older_avg
            if ($diff -gt 0.3) { $trend = "up" } elseif ($diff -lt -0.3) { $trend = "down" } else { $trend = "stable" }
        } else { $trend = "stable" }

        # Trend icon/color
        switch ($trend) {
            "up"   { $trend_icon = "`u{2197}"; $trend_color = $EMERALD }
            "down" { $trend_icon = "`u{2198}"; $trend_color = $ROSE }
            default { $trend_icon = "`u{2192}"; $trend_color = $SLATE_400 }
        }

        # Sparkline generation for normal mode
        function Build-Sparkline { param($data, $period_start)
            $dur = $now - $period_start
            $sz = $dur / 58
            $line = ""
            for ($i = 0; $i -lt 58; $i++) {
                $s = $period_start + ($i * $sz)
                $e = $s + $sz
                $bucket = @($data | Where-Object { $_.epoch -ge $s -and $_.epoch -lt $e })
                if ($bucket.Count -eq 0) {
                    $line += "$ESC[38;2;45;50;60m $RESET"
                } else {
                    $avg = ($bucket | Measure-Object -Property rating -Average).Average
                    $line += switch ([int][math]::Floor($avg)) {
                        { $_ -ge 10 } { "$ESC[38;2;34;197;94m`u{2585}$RESET" }
                        9 { "$ESC[38;2;74;222;128m`u{2585}$RESET" }
                        8 { "$ESC[38;2;134;239;172m`u{2584}$RESET" }
                        7 { "$ESC[38;2;59;130;246m`u{2583}$RESET" }
                        6 { "$ESC[38;2;96;165;250m`u{2582}$RESET" }
                        5 { "$ESC[38;2;253;224;71m`u{2581}$RESET" }
                        4 { "$ESC[38;2;253;186;116m`u{2582}$RESET" }
                        3 { "$ESC[38;2;251;146;60m`u{2583}$RESET" }
                        2 { "$ESC[38;2;248;113;113m`u{2584}$RESET" }
                        default { "$ESC[38;2;239;68;68m`u{2585}$RESET" }
                    }
                }
            }
            return $line
        }

        # Get colors
        $pulse_base = if ($q15_avg -ne "`u{2014}") { $q15_avg } elseif ($hour_avg -ne "`u{2014}") { $hour_avg } elseif ($today_avg -ne "`u{2014}") { $today_avg } else { $all_avg }
        $PULSE_COLOR = Get-RatingColor $pulse_base
        $LATEST_COLOR = Get-RatingColor $latest
        $Q15_COLOR = Get-RatingColor $q15_avg
        $HOUR_COLOR = Get-RatingColor $hour_avg
        $TODAY_COLOR = Get-RatingColor $today_avg
        $WEEK_COLOR = Get-RatingColor $week_avg
        $MONTH_COLOR = Get-RatingColor $month_avg
        $ALL_COLOR = Get-RatingColor $all_avg

        $src_label = if ($latest_source -eq "explicit") { "EXP" } else { "IMP" }

        switch ($MODE) {
            "nano" {
                Write-Host "${LEARN_LABEL}`u{273F}${RESET} ${LATEST_COLOR}${latest}${RESET} ${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET}"
            }
            "micro" {
                Write-Host "${LEARN_LABEL}`u{273F}${RESET} ${LATEST_COLOR}${latest}${RESET} ${SIGNAL_PERIOD}1h:${RESET} ${HOUR_COLOR}${hour_avg}${RESET} ${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET} ${SIGNAL_PERIOD}1w:${RESET} ${WEEK_COLOR}${week_avg}${RESET}"
            }
            "mini" {
                Write-Host -NoNewline "${LEARN_LABEL}`u{273F}${RESET} ${LEARN_LABEL}LEARNING:${RESET} ${SLATE_600}│${RESET} "
                Write-Host -NoNewline "${LATEST_COLOR}${latest}${RESET} "
                Write-Host -NoNewline "${SIGNAL_PERIOD}1h:${RESET} ${HOUR_COLOR}${hour_avg}${RESET} "
                Write-Host -NoNewline "${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET} "
                Write-Host "${SIGNAL_PERIOD}1w:${RESET} ${WEEK_COLOR}${week_avg}${RESET}"
            }
            "normal" {
                Write-Host -NoNewline "${LEARN_LABEL}`u{273F}${RESET} ${LEARN_LABEL}LEARNING:${RESET} ${SLATE_600}│${RESET} "
                Write-Host -NoNewline "${LATEST_COLOR}${latest}${RESET}${SLATE_500}${src_label}${RESET} ${SLATE_600}│${RESET} "
                Write-Host -NoNewline "${SIGNAL_PERIOD}15m:${RESET} ${Q15_COLOR}${q15_avg}${RESET} "
                Write-Host -NoNewline "${SIGNAL_PERIOD}60m:${RESET} ${HOUR_COLOR}${hour_avg}${RESET} "
                Write-Host -NoNewline "${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET} "
                Write-Host -NoNewline "${SIGNAL_PERIOD}1w:${RESET} ${WEEK_COLOR}${week_avg}${RESET} "
                Write-Host "${SIGNAL_PERIOD}1mo:${RESET} ${MONTH_COLOR}${month_avg}${RESET}"

                # Sparklines
                $q15_sparkline = Build-Sparkline $ratings $q15_start
                $hour_sparkline = Build-Sparkline $ratings $hour_start
                $day_sparkline = Build-Sparkline $ratings $today_start
                $week_sparkline = Build-Sparkline $ratings $week_start
                $month_sparkline = Build-Sparkline $ratings $month_start

                Write-Host "   ${SLATE_600}`u{251C}`u{2500}${RESET} ${SIGNAL_PERIOD}15m:  ${RESET} ${q15_sparkline}"
                Write-Host "   ${SLATE_600}`u{251C}`u{2500}${RESET} ${SIGNAL_PERIOD}60m:  ${RESET} ${hour_sparkline}"
                Write-Host "   ${SLATE_600}`u{251C}`u{2500}${RESET} ${SIGNAL_PERIOD}1d:   ${RESET} ${day_sparkline}"
                Write-Host "   ${SLATE_600}`u{251C}`u{2500}${RESET} ${SIGNAL_PERIOD}1w:   ${RESET} ${week_sparkline}"
                Write-Host "   ${SLATE_600}`u{2514}`u{2500}${RESET} ${SIGNAL_PERIOD}1mo:  ${RESET} ${month_sparkline}"
            }
        }
    } else {
        Write-Host "${LEARN_LABEL}`u{273F}${RESET} ${LEARN_LABEL}LEARNING:${RESET}"
        Write-Host "  ${SLATE_500}No ratings yet${RESET}"
    }
} else {
    Write-Host "${LEARN_LABEL}`u{273F}${RESET} ${LEARN_LABEL}LEARNING:${RESET}"
    Write-Host "  ${SLATE_500}No ratings yet${RESET}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 7: QUOTE (normal mode only)
# ═══════════════════════════════════════════════════════════════════════════════

if ($MODE -eq "normal") {
    Write-Host "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}"

    $quote_age = 999999
    if (Test-Path $QUOTE_CACHE) {
        $quote_age = [int]((Get-Date) - (Get-Item $QUOTE_CACHE).LastWriteTime).TotalSeconds
    }

    if ($quote_age -gt 30 -or !(Test-Path $QUOTE_CACHE)) {
        if ($env:ZENQUOTES_API_KEY) {
            try {
                $quoteData = Invoke-RestMethod -Uri "https://zenquotes.io/api/random/$($env:ZENQUOTES_API_KEY)" -TimeoutSec 1 2>$null
                if ($quoteData -and $quoteData[0].q.Length -lt 80) {
                    "$($quoteData[0].q)|$($quoteData[0].a)" | Out-File -FilePath $QUOTE_CACHE -NoNewline -Encoding UTF8
                }
            } catch {}
        }
    }

    if (Test-Path $QUOTE_CACHE) {
        $quoteRaw = Get-Content $QUOTE_CACHE -Raw
        $parts = $quoteRaw -split '\|', 2
        $quote_text = $parts[0]
        $quote_author = if ($parts.Count -gt 1) { $parts[1] } else { "" }
        $author_suffix = "`" `u{2014}${quote_author}"
        $full_len = $quote_text.Length + $author_suffix.Length + 4

        if ($full_len -le 72) {
            Write-Host "${QUOTE_PRIMARY}`u{2726}${RESET} ${SLATE_400}`"${quote_text}`"${RESET} ${QUOTE_AUTHOR}`u{2014}${quote_author}${RESET}"
        } else {
            $target = [math]::Min(60, $quote_text.Length - 12)
            $first_part = $quote_text.Substring(0, $target)
            $lastSpace = $first_part.LastIndexOf(' ')
            if ($lastSpace -gt 10) { $first_part = $quote_text.Substring(0, $lastSpace) }
            $second_part = $quote_text.Substring($first_part.Length).TrimStart()

            if ($second_part.Length -lt 10) {
                Write-Host "${QUOTE_PRIMARY}`u{2726}${RESET} ${SLATE_400}`"${quote_text}`"${RESET} ${QUOTE_AUTHOR}`u{2014}${quote_author}${RESET}"
            } else {
                Write-Host "${QUOTE_PRIMARY}`u{2726}${RESET} ${SLATE_400}`"${first_part}${RESET}"
                Write-Host "  ${SLATE_400}${second_part}`"${RESET} ${QUOTE_AUTHOR}`u{2014}${quote_author}${RESET}"
            }
        }
    }
}
