#!/bin/bash
# 部署行业比较 Dashboard 到 GitHub Pages
# 在终端中运行此脚本（需要已配置 GitHub 认证）
set -e
cd "$(dirname "$0")"

echo "=== 部署行业比较 Dashboard ==="

# 添加文件
git add -A

# 提交（如果有变更）
if ! git diff --cached --quiet; then
    git commit -m "update: $(date +%Y%m%d) 行业比较Dashboard"
    echo "✓ 已提交"
else
    echo "→ 无变更，跳过提交"
fi

# 推送
echo "→ 推送到 GitHub..."
git push origin main

echo ""
echo "✅ 部署完成！"
echo "   访问地址: https://fc2755-coder.github.io/SWSMU-strategy/"
echo ""
echo "   注意: GitHub Pages 需要在仓库 Settings > Pages 中"
echo "   将 Source 设置为 'Deploy from a branch' → 'main' → '/ (root)'"
