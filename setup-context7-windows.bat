@echo off
echo 🚀 Context7 MCP Server 配置工具 (Windows)
echo =========================================
echo.

:: 設定配置目錄
set CONFIG_DIR=%APPDATA%\Claude
set CONFIG_FILE=%CONFIG_DIR%\claude_desktop_config.json

echo 📁 配置目錄: %CONFIG_DIR%
echo 📄 配置文件: %CONFIG_FILE%
echo.

:: 創建配置目錄
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

:: 備份現有配置
if exist "%CONFIG_FILE%" (
    echo ⚠️  配置文件已存在，創建備份...
    copy "%CONFIG_FILE%" "%CONFIG_FILE%.backup.%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.json"
)

:: 寫入新配置
echo 正在創建配置文件...
(
echo {
echo   "mcpServers": {
echo     "context7": {
echo       "command": "npx",
echo       "args": ["-y", "@upstash/context7-mcp"]
echo     },
echo     "mcp-memory-keeper": {
echo       "command": "npx",
echo       "args": ["-y", "mcp-memory-keeper"]
echo     }
echo   }
echo }
) > "%CONFIG_FILE%"

echo.
echo ✅ 配置文件已創建/更新
echo.
echo 📋 下一步操作：
echo 1. 重新啟動 Claude Desktop
echo 2. 在對話中輸入 'use context7' 來使用 Context7
echo.
echo 💡 使用範例：
echo    '創建一個 Next.js 中間件來檢查 JWT token use context7'
echo    '設置 Cloudflare Worker 快取 API 回應 5 分鐘 use context7'
echo.
echo ✨ 配置完成！
pause