#!/bin/bash
set -e

REQUIRED_NODE=18

echo ""
echo "  prepcli — persistent AI collaboration layer"
echo ""

# ── Check Node.js ─────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "  ✗  Node.js is required (>= $REQUIRED_NODE)"
  echo "     Install it from https://nodejs.org and re-run this script."
  echo ""
  exit 1
fi

NODE_VER=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt "$REQUIRED_NODE" ]; then
  echo "  ✗  Node.js $REQUIRED_NODE+ required. Found: $(node --version)"
  echo "     Upgrade at https://nodejs.org"
  echo ""
  exit 1
fi

echo "  ✓  Node.js $(node --version)"

# ── Check npm ─────────────────────────────────────────────────────────────────
if ! command -v npm >/dev/null 2>&1; then
  echo "  ✗  npm not found. Install it alongside Node.js from https://nodejs.org"
  echo ""
  exit 1
fi

# ── Check if already installed ────────────────────────────────────────────────
if command -v prepcli >/dev/null 2>&1; then
  VERSION=$(prepcli --version 2>/dev/null || echo "")
  echo "  prepcli${VERSION:+ $VERSION} is already installed."
  echo ""
  echo "  To upgrade to the latest version:"
  echo "    npm update -g @prepcli/prepcli"
  echo ""
  exit 0
fi

# ── Install ───────────────────────────────────────────────────────────────────
echo "  Installing prepcli..."

if npm install -g @prepcli/prepcli; then
  VERSION=$(prepcli --version 2>/dev/null || echo "")
  echo "  ✓  prepcli${VERSION:+ $VERSION} installed"
else
  echo ""
  echo "  Installation failed. Try with sudo:"
  echo "    sudo npm install -g @prepcli/prepcli"
  echo ""
  exit 1
fi

# ── Next steps ────────────────────────────────────────────────────────────────
echo ""
echo "  Get started:"
echo ""
echo "    prepcli install      # copy workflow files to Claude Code / Cursor / Windsurf"
echo "    prepcli auth login   # create free account (optional)"
echo "    prepcli init         # scan your project and set up context"
echo ""
echo "  Docs: https://prepcli.in/docs"
echo ""
