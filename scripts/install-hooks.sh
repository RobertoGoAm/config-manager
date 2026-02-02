#!/bin/bash

# Install git hooks for config-manager
# Run this script after cloning the repository

set -e

echo "📦 Installing git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy pre-push hook
cp .githooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo ""
echo "The pre-push hook will now run quality checks before every push."
echo "This includes: typecheck, lint, format check, OpenAPI validation, and all tests."
echo ""
echo "To skip the hook (not recommended), use: git push --no-verify"
