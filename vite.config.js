/*
 * Copyright (c) 2023, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  alias: {
    react: 'preact/compat',
    'react-dom': 'preact/compat',
  },
});
