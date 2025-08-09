#\!/bin/bash

echo "檢查 Cloudflare Pages 部署狀態..."
echo "================================"

# 檢查專案列表頁面
echo -e "\n1. 專案列表頁面 (project-list.html):"
content=$(curl -s https://construction-management-frontend.pages.dev/project-list)

if echo "$content" | grep -q "projects-grid"; then
    echo "   ❌ 還在使用卡片佈局 (projects-grid)"
elif echo "$content" | grep -q "projects-table"; then
    echo "   ✅ 已更新為表格佈局 (projects-table)"
else
    echo "   ⚠️  無法判斷佈局類型"
fi

if echo "$content" | grep -q "deleteModal"; then
    echo "   ✅ 有刪除功能 (deleteModal)"
else
    echo "   ❌ 沒有刪除功能"
fi

# 檢查專案建立頁面
echo -e "\n2. 專案建立頁面 (project-create-v2.html):"
content2=$(curl -s https://construction-management-frontend.pages.dev/project-create-v2.html)

if echo "$content2" | grep -q "opportunitySearch"; then
    echo "   ✅ 有搜尋功能 (opportunitySearch)"
else
    echo "   ❌ 沒有搜尋功能"
fi

if echo "$content2" | grep -q "opportunities-table"; then
    echo "   ✅ 商機使用表格佈局 (opportunities-table)"
else
    echo "   ❌ 商機還在使用卡片佈局"
fi

if echo "$content2" | grep -q "teams-container"; then
    echo "   ✅ 有工班管理容器 (teams-container)"
else
    echo "   ❌ 沒有工班管理容器"
fi

# 檢查統計欄位
if echo "$content2" | grep -q "維修單數"; then
    echo "   ✅ 有維修單數欄位"
else
    echo "   ❌ 沒有維修單數欄位"
fi

echo -e "\n================================"
echo "結論："

# 比較本地和線上版本
echo -e "\n本地版本："
echo -n "   project-list.html: "
grep -o "projects-[a-z]*" /mnt/c/claude/工程管理/frontend/project-list.html | head -1

echo -n "   project-create-v2.html: "
grep -q "opportunitySearch" /mnt/c/claude/工程管理/frontend/project-create-v2.html && echo "有搜尋功能" || echo "無搜尋功能"

echo -e "\n線上版本似乎還沒更新，可能是因為："
echo "1. GitHub push 還沒完成"
echo "2. Cloudflare Pages 還在建構中"
echo "3. CDN 快取還沒更新"
