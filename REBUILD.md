# 重新建置和安裝指南

## 問題診斷

您遇到的問題是：命令在列表中顯示，但執行時報錯"找不到命令"。

這通常是因為：

1. `activate` 函數執行時出錯，導致命令沒有正確註冊
2. 可能是 Parser 初始化失敗

## 修復內容

已修改 `src/extension.ts`：

- ✅ 移除 `async` 關鍵字（沒有實際的異步操作）
- ✅ 添加完整的錯誤處理
- ✅ 確保即使 Parser 初始化失敗，命令仍能註冊
- ✅ 添加詳細的日誌輸出

## 重新建置步驟

### 1. 清理舊文件

```bash
cd /Users/guojun/workspace/goose-uml-vscode
rm -rf dist
rm -f *.vsix
```

### 2. 重新建置

```bash
npm run build
```

### 3. 檢查建置結果

```bash
ls -lh dist/extension.js
# 應該顯示文件存在且大小合理（約 4-5 KB）
```

### 4. 打包 VSIX

```bash
npm run package
```

### 5. 檢查 VSIX

```bash
ls -lh *.vsix
# 應該顯示 goose-uml-vscode-0.2.4.vsix，大小約 4.7 MB
```

## 安裝步驟

### 1. 完全卸載舊版本

在 VS Code 中：

1. 打開擴展面板（Cmd+Shift+X）
2. 找到 "Goose UML"
3. 點擊卸載
4. **重啟 VS Code**（重要！）

或使用命令行：

```bash
code --uninstall-extension kuochunchang.goose-uml-vscode
```

### 2. 清除緩存

```bash
rm -rf ~/.vscode/extensions/kuochunchang.goose-uml-vscode-*
```

### 3. 安裝新版本

**方法 A: 使用命令行（推薦）**

```bash
cd /Users/guojun/workspace/goose-uml-vscode
code --install-extension goose-uml-vscode-0.2.4.vsix --force
```

**方法 B: 在 VS Code 中手動安裝**

1. 打開 VS Code
2. 按 Cmd+Shift+P
3. 輸入 "Extensions: Install from VSIX..."
4. 選擇 `goose-uml-vscode-0.2.4.vsix`

### 4. 重啟 VS Code

**必須重啟！** 這確保擴展完全重新加載。

## 測試步驟

### 1. 檢查擴展輸出

1. 打開 VS Code
2. 按 Cmd+Shift+U 打開輸出面板
3. 在下拉菜單中選擇 "Extension Host"
4. 應該看到：
   ```
   Goose UML extension is now active
   Registered parsers for: typescript, javascript, java, python
   Goose UML: All commands registered successfully
   ```

### 2. 測試命令

打開一個 TypeScript 文件，然後：

1. 按 Cmd+Shift+P
2. 輸入 "Goose UML"
3. 應該看到 4 個命令
4. 嘗試執行 "Goose UML: Generate Class Diagram"

### 3. 如果還是失敗

查看輸出面板中的錯誤訊息，並將完整的錯誤日誌發給我。

## 提交更改

如果測試成功，提交更改：

```bash
cd /Users/guojun/workspace/goose-uml-vscode

git add src/extension.ts
git commit -m "fix: improve error handling and remove async from activate function

- Remove async keyword from activate (no actual async operations)
- Add comprehensive error handling for all commands
- Ensure commands register even if parsers fail to load
- Add detailed logging for debugging
- Fixes 'command not found' errors"

git push origin main

# 更新 tag
git tag -d v0.2.4
git tag -a v0.2.4 -m "Release v0.2.4: Fix command registration and error handling"
git push origin v0.2.4 --force
```

## 發布到 Marketplace

```bash
vsce publish
```
