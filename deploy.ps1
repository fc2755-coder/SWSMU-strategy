# 部署行业比较 Dashboard 到 GitHub Pages
# 在 PowerShell 中运行此脚本（需要已配置 GitHub 认证）
Set-Location $PSScriptRoot

Write-Host "=== 部署行业比较 Dashboard ===" -ForegroundColor Cyan

# 添加文件
git add -A

# 提交（如果有变更）
$status = git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "update: $(Get-Date -Format 'yyyyMMdd') IndustryCompareDashboard"
    Write-Host "[OK] Committed" -ForegroundColor Green
} else {
    Write-Host "[SKIP] No changes to commit" -ForegroundColor Yellow
}

# 推送
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] Deployed!" -ForegroundColor Green
    Write-Host "   URL: https://fc2755-coder.github.io/SWSMU-strategy/"
    Write-Host ""
    Write-Host "   Note: Make sure GitHub Pages is enabled in"
    Write-Host "   Settings > Pages > Source: main branch / (root)"
} else {
    Write-Host "[ERROR] Push failed. Check GitHub credentials." -ForegroundColor Red
}
