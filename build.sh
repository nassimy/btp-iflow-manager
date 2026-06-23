#!/bin/bash
set -e

echo "📦 Installing React dependencies..."
npm install

echo "⚛️  Building React app..."
npm run build:react

echo "📂 Copying React build to approuter/resources/..."
rm -rf approuter/resources
mkdir -p approuter/resources
cp -r build/. approuter/resources/

echo "✅ React build copied to approuter/resources/"
