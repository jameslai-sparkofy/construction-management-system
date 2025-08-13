#!/bin/bash

echo "🚀 Context7 MCP Server 配置工具"
echo "================================"
echo ""

# 檢查是否已安裝 context7-mcp
if ! command -v context7-mcp &> /dev/null; then
    echo "❌ Context7 MCP Server 尚未安裝"
    echo "請先執行: cd workers/context7 && npm install && npm run build && npm link"
    exit 1
fi

echo "✅ Context7 MCP Server 已安裝"
echo ""

# 檢測作業系統
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    CONFIG_DIR="$APPDATA/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
else
    # Linux/WSL
    CONFIG_DIR="$HOME/.config/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
fi

echo "📁 配置目錄: $CONFIG_DIR"
echo "📄 配置文件: $CONFIG_FILE"
echo ""

# 創建配置目錄
mkdir -p "$CONFIG_DIR"

# 創建或更新配置文件
if [ -f "$CONFIG_FILE" ]; then
    echo "⚠️  配置文件已存在，創建備份..."
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
fi

# 寫入配置
cat > "$CONFIG_FILE" << 'EOF'
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "mcp-memory-keeper": {
      "command": "npx",
      "args": ["-y", "mcp-memory-keeper"]
    }
  }
}
EOF

echo "✅ 配置文件已創建/更新"
echo ""
echo "📋 下一步操作："
echo "1. 重新啟動 Claude Desktop"
echo "2. 在對話中輸入 'use context7' 來使用 Context7"
echo ""
echo "💡 使用範例："
echo "   '創建一個 Next.js 中間件來檢查 JWT token use context7'"
echo "   '設置 Cloudflare Worker 快取 API 回應 5 分鐘 use context7'"
echo ""
echo "✨ 配置完成！"