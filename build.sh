#!/usr/bin/env bash
# build.sh — single-service full-stack build for Render
#
# 1. Build the React frontend  → dist/
# 2. Install the Python backend dependencies
#
# Render runs this from the project root. Both Node and pip are available in
# the Render build environment regardless of the service runtime.

set -euo pipefail

echo "==> Installing Node dependencies and building frontend..."
npm ci
npm run build
echo "==> Frontend built → dist/"

echo "==> Installing Python backend dependencies..."
pip install -r backend/requirements.txt
echo "==> All dependencies installed."
