#!/bin/bash

# 批量替換 hardcoded API URLs 的腳本
# Version: 1.0.0 - 2025-08-21

echo "🔄 開始替換 hardcoded API URLs..."

# 定義要替換的文件和模式
FRONTEND_DIR="/mnt/c/claude/工程管理/frontend"

# 替換模式 1: 移除 hardcode fallback，使用統一配置
echo "📝 正在處理 HTML 文件中的 hardcode URLs..."

# 在所有 HTML 文件中替換 hardcoded URLs
find "$FRONTEND_DIR" -name "*.html" -type f | while read -r file; do
    echo "處理文件: $(basename "$file")"
    
    # 備份原文件
    cp "$file" "$file.backup"
    
    # 替換各種 hardcoded patterns
    sed -i 's|https://construction-management-api-dev\.lai-jameslai\.workers\.dev|${CONFIG?.API?.WORKER_API_URL}|g' "$file"
    sed -i 's|https://construction-management-api\.lai-jameslai\.workers\.dev|${CONFIG?.API?.WORKER_API_URL}|g' "$file"
    sed -i 's|https://construction-management-unified-dev\.lai-jameslai\.workers\.dev|${CONFIG?.API?.WORKER_API_URL}|g' "$file"
    
    # 檢查是否有變更
    if ! cmp -s "$file" "$file.backup"; then
        echo "✅ 已更新: $(basename "$file")"
    else
        echo "⏭️  無需更新: $(basename "$file")"
        rm "$file.backup"
    fi
done

# 替換 JS 文件中的 URLs
echo "📝 正在處理 JS 文件中的 hardcode URLs..."

find "$FRONTEND_DIR/js" -name "*.js" -type f 2>/dev/null | while read -r file; do
    echo "處理文件: $(basename "$file")"
    
    # 備份原文件
    cp "$file" "$file.backup"
    
    # 替換 hardcoded patterns
    sed -i 's|https://construction-management-api-dev\.lai-jameslai\.workers\.dev|${window.CONFIG?.API?.WORKER_API_URL}|g' "$file"
    sed -i 's|https://construction-management-api\.lai-jameslai\.workers\.dev|${window.CONFIG?.API?.WORKER_API_URL}|g' "$file"
    
    # 檢查是否有變更
    if ! cmp -s "$file" "$file.backup"; then
        echo "✅ 已更新: $(basename "$file")"
    else
        echo "⏭️  無需更新: $(basename "$file")"
        rm "$file.backup"
    fi
done

echo "✨ 替換完成！"
echo ""
echo "📊 統計結果："
echo "已處理的備份文件:"
find "$FRONTEND_DIR" -name "*.backup" -type f | wc -l
echo ""
echo "🧹 清理備份文件？(y/N)"
read -r cleanup_backup
if [[ "$cleanup_backup" =~ ^[Yy]$ ]]; then
    find "$FRONTEND_DIR" -name "*.backup" -type f -delete
    echo "✅ 備份文件已清理"
fi

echo ""
echo "🔍 檢查剩餘的 hardcode URLs:"
echo "剩餘的 construction-management URLs:"
grep -r "construction-management.*\.workers\.dev\|construction-management.*\.pages\.dev" "$FRONTEND_DIR" --include="*.html" --include="*.js" | wc -l