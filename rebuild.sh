#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔧 Goose UML - 重新建置腳本${NC}"
echo ""

# 1. 清理
echo -e "${YELLOW}📁 步驟 1/5: 清理舊文件...${NC}"
rm -rf dist
rm -f *.vsix
echo -e "${GREEN}✓ 清理完成${NC}"
echo ""

# 2. Lint
echo -e "${YELLOW}🔍 步驟 2/5: 執行 Lint 檢查...${NC}"
if npm run lint; then
    echo -e "${GREEN}✓ Lint 通過${NC}"
else
    echo -e "${RED}✗ Lint 失敗${NC}"
    exit 1
fi
echo ""

# 3. 測試
echo -e "${YELLOW}🧪 步驟 3/5: 執行測試...${NC}"
if npm test; then
    echo -e "${GREEN}✓ 測試通過${NC}"
else
    echo -e "${RED}✗ 測試失敗${NC}"
    exit 1
fi
echo ""

# 4. 建置
echo -e "${YELLOW}🔨 步驟 4/5: 建置 TypeScript...${NC}"
if npm run build; then
    echo -e "${GREEN}✓ 建置成功${NC}"
    ls -lh dist/extension.js
else
    echo -e "${RED}✗ 建置失敗${NC}"
    exit 1
fi
echo ""

# 5. 打包
echo -e "${YELLOW}📦 步驟 5/5: 打包 VSIX...${NC}"
if npm run package; then
    echo -e "${GREEN}✓ 打包成功${NC}"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ 重新建置完成！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    ls -lh *.vsix
    echo ""
    echo -e "${YELLOW}📋 下一步：${NC}"
    echo "1. 在 VS Code 中完全卸載舊版本"
    echo "2. 重啟 VS Code"
    echo "3. 安裝新版本："
    echo -e "   ${GREEN}code --install-extension goose-uml-vscode-0.2.4.vsix --force${NC}"
    echo "4. 再次重啟 VS Code"
    echo "5. 打開輸出面板查看日誌（Cmd+Shift+U -> Extension Host）"
else
    echo -e "${RED}✗ 打包失敗${NC}"
    exit 1
fi

