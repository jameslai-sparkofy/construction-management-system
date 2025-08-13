#!/bin/bash

# 設定環境腳本
# 使用方式: ./set-environment.sh [develop|production]

ENVIRONMENT=${1:-develop}

if [ "$ENVIRONMENT" = "develop" ]; then
    echo "🔧 切換到開發環境..."
    cp config.develop.js config.js
    echo "✅ 已切換到開發環境 (API: construction-api-development)"
elif [ "$ENVIRONMENT" = "production" ]; then
    echo "🚀 切換到生產環境..."
    cp config.production.js config.js
    echo "✅ 已切換到生產環境 (API: construction-api-production)"
else
    echo "❌ 無效的環境: $ENVIRONMENT"
    echo "使用方式: ./set-environment.sh [develop|production]"
    exit 1
fi