#!/usr/bin/env node
/**
 * Build script for the AppVelocity Figma plugin.
 * Uses esbuild to bundle plugin.ts → dist/plugin.js
 * Copies ui.html → dist/ui.html
 */

const esbuild = require('esbuild');
const fs      = require('fs');
const path    = require('path');

const watch = process.argv.includes('--watch');

fs.mkdirSync('dist', { recursive: true });

// Bundle plugin code
const buildOptions = {
  entryPoints: ['src/plugin.ts'],
  bundle:      true,
  outfile:     'dist/plugin.js',
  target:      'es2017',
  format:      'iife',
  logLevel:    'info',
};

if (watch) {
  esbuild.context(buildOptions).then((ctx) => ctx.watch());
} else {
  esbuild.buildSync(buildOptions);
}

// Copy UI (HTML is self-contained, no bundling needed)
fs.copyFileSync(
  path.join(__dirname, 'src', 'ui.html'),
  path.join(__dirname, 'dist', 'ui.html')
);

console.log('Plugin built → dist/plugin.js + dist/ui.html');
