/**
 * Build script for main process files
 * Copies main process files to dist directory
 */

const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, '../src/main')
const distDir = path.join(__dirname, '../dist/main')

// Create dist directory
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true })
}

// Copy all JS files
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

copyDir(srcDir, distDir)

console.log('Main process files copied to dist/main')
