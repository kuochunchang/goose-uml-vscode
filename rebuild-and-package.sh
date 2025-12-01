#!/bin/bash
set -e

echo "🧹 Cleaning old build..."
rm -rf dist
rm -f *.vsix

echo "🔨 Building TypeScript..."
npm run build

echo "📦 Packaging VSIX..."
npm run package

echo "✅ Done! VSIX file created:"
ls -lh *.vsix

echo ""
echo "📋 To install:"
echo "   code --install-extension goose-uml-vscode-0.2.4.vsix"


