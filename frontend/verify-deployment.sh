#\!/bin/bash

URL="https://1165294f.construction-management-frontend.pages.dev"
echo "驗證部署結果: $URL"
echo "================================"

# 測試專案列表頁面
echo -e "\n✅ 專案列表頁面 (project-list.html):"
content=$(curl -s "$URL/project-list")

if echo "$content" | grep -q "projects-table"; then
    echo "   ✅ 使用表格佈局 (projects-table)"
else
    echo "   ❌ 非表格佈局"
fi

if echo "$content" | grep -q "deleteModal"; then
    echo "   ✅ 有刪除功能"
else
    echo "   ❌ 無刪除功能"
fi

# 測試專案建立頁面
echo -e "\n✅ 專案建立頁面 (project-create-v2.html):"
content2=$(curl -s "$URL/project-create-v2.html")

if echo "$content2" | grep -q "opportunitySearch"; then
    echo "   ✅ 有搜尋功能"
else
    echo "   ❌ 無搜尋功能"
fi

if echo "$content2" | grep -q "opportunities-table"; then
    echo "   ✅ 商機使用表格佈局"
else
    echo "   ❌ 商機非表格佈局"
fi

if echo "$content2" | grep -q "teams-container"; then
    echo "   ✅ 有工班管理容器"
else
    echo "   ❌ 無工班管理容器"
fi

if echo "$content2" | grep -q "維修單數"; then
    echo "   ✅ 有維修單數欄位"
else
    echo "   ❌ 無維修單數欄位"
fi

echo -e "\n================================"
echo "部署網址: $URL"
echo "主網址: https://construction-management-frontend.pages.dev"
