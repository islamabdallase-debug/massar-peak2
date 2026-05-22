# ============================================================
#  مسار — سكريبت النشر على GitHub + Vercel
#  الإصدار: 1.0  |  2026
#  التشغيل: PowerShell (Run as Administrator or normal user)
#  الأمر:   .\deploy-to-github.ps1
# ============================================================

param(
    [string]$GitHubUsername = "",
    [string]$RepoName       = "massar-peak"
)

$ProjectDir = $PSScriptRoot
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   مسار — نشر على GitHub + Vercel   " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ── خطوة 0: التحقق من وجود git ─────────────────────────────
try {
    $gitVersion = git --version 2>&1
    Write-Host "[✓] Git موجود: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "[✗] Git غير مثبّت. حمّله من: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# ── خطوة 1: اسم المستخدم على GitHub ─────────────────────────
if (-not $GitHubUsername) {
    $GitHubUsername = Read-Host "أدخل اسم المستخدم على GitHub"
}
if (-not $GitHubUsername) {
    Write-Host "[✗] اسم المستخدم مطلوب" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "المشروع: $ProjectDir" -ForegroundColor Yellow
Write-Host "GitHub:  https://github.com/$GitHubUsername/$RepoName" -ForegroundColor Yellow
Write-Host ""

# ── خطوة 2: تهيئة Git ────────────────────────────────────────
Set-Location $ProjectDir

if (-not (Test-Path ".git")) {
    Write-Host "[→] تهيئة git repository..." -ForegroundColor Cyan
    git init
    git checkout -b main 2>$null
    if ($LASTEXITCODE -ne 0) { git branch -m main 2>$null }
    Write-Host "[✓] تم إنشاء repository" -ForegroundColor Green
} else {
    Write-Host "[✓] git repository موجود مسبقاً" -ForegroundColor Green
    # تأكد من أننا على فرع main
    git checkout main 2>$null
    if ($LASTEXITCODE -ne 0) { git checkout -b main 2>$null }
}

# ── خطوة 3: ضبط هوية المستخدم ────────────────────────────────
git config user.name  "Islam"
git config user.email "islamabdallase@gmail.com"
Write-Host "[✓] هوية المستخدم ضُبطت" -ForegroundColor Green

# ── خطوة 4: إضافة الملفات وأول commit ───────────────────────
Write-Host ""
Write-Host "[→] إضافة الملفات..." -ForegroundColor Cyan

# تحقق من وجود .gitignore
if (-not (Test-Path ".gitignore")) {
    Write-Host "[!] لا يوجد .gitignore — سيُنشأ تلقائياً" -ForegroundColor Yellow
    @"
node_modules/
dist/
.env
.env.local
.env.production
.DS_Store
*.tsbuildinfo
coverage/
.vercel
.netlify
"@ | Out-File -FilePath ".gitignore" -Encoding utf8
}

git add -A
$status = git status --short
Write-Host "[✓] تمت إضافة الملفات:" -ForegroundColor Green
Write-Host $status

$commitMsg = "feat: Initial commit — مسار v5.1 (React + TypeScript + Vite)"
git commit -m $commitMsg
Write-Host "[✓] Commit أول تم بنجاح" -ForegroundColor Green

# ── خطوة 5: إنشاء Remote وربطه ───────────────────────────────
$remoteUrl = "https://github.com/$GitHubUsername/$RepoName.git"

$existingRemote = git remote get-url origin 2>&1
if ($LASTEXITCODE -eq 0) {
    git remote set-url origin $remoteUrl
    Write-Host "[✓] تم تحديث remote: $remoteUrl" -ForegroundColor Green
} else {
    git remote add origin $remoteUrl
    Write-Host "[✓] تم إضافة remote: $remoteUrl" -ForegroundColor Green
}

# ── خطوة 6: إرشادات GitHub ───────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host " الخطوات المتبقية (يدوياً في المتصفح):" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host " 1. افتح: https://github.com/new" -ForegroundColor White
Write-Host "    - Repository name: $RepoName" -ForegroundColor White
Write-Host "    - Visibility: Private (أو Public)" -ForegroundColor White
Write-Host "    - لا تضف README أو .gitignore (موجودان)" -ForegroundColor White
Write-Host "    - اضغط: Create repository" -ForegroundColor White
Write-Host ""
Write-Host " 2. بعد إنشاء الـ repo، شغّل الأمر التالي:" -ForegroundColor White
Write-Host ""
Write-Host "    git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host " 3. لنشر على Vercel:" -ForegroundColor White
Write-Host "    - افتح: https://vercel.com/new" -ForegroundColor White
Write-Host "    - اختر: Import Git Repository" -ForegroundColor White
Write-Host "    - اختر: $RepoName" -ForegroundColor White
Write-Host "    - Framework Preset: Vite" -ForegroundColor White
Write-Host "    - Build Command: npm run build" -ForegroundColor White
Write-Host "    - Output Directory: dist" -ForegroundColor White
Write-Host "    - اضغط: Deploy" -ForegroundColor White
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " المنصة ستكون متاحة على:" -ForegroundColor Green
Write-Host " https://$RepoName.vercel.app" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# ── خطوة 7: سؤال المستخدم عن Push ────────────────────────────
$doPush = Read-Host "هل أنشأت الـ repo على GitHub الآن وتريد الـ push؟ (y/n)"
if ($doPush -eq "y" -or $doPush -eq "Y" -or $doPush -eq "yes") {
    Write-Host "[→] جاري الرفع إلى GitHub..." -ForegroundColor Cyan
    git push -u origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[✓] تم الرفع بنجاح!" -ForegroundColor Green
        Write-Host "[→] اذهب الآن إلى: https://vercel.com/new" -ForegroundColor Cyan
    } else {
        Write-Host "[!] فشل الرفع — تأكد من إنشاء الـ repo على GitHub أولاً" -ForegroundColor Yellow
        Write-Host "    ثم شغّل: git push -u origin main" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "[✓] اكتمل السكريبت." -ForegroundColor Green
