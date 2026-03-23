/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import path from 'node:path';
import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import zip from 'vite-plugin-zip-pack';
import manifest from './manifest.config.js';
import { name, version } from './package.json';

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [preact(), crx({ manifest }), zip({ outDir: 'release', outFileName: `${name}-${version}.zip` })],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  alias: {
    react: 'preact/compat',
    'react-dom': 'preact/compat',
  },
});
