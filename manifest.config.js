/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Rubric',
  version: pkg.version,
  description: 'Inject custom request and response headers.',
  homepage_url: 'https://github.com/rickardandersson/rubric',
  author: 'rickard.andersson@gmail.com',
  icons: {
    48: 'icons/rubric-48.png',
    96: 'icons/rubric-96.png',
  },
  action: {
    default_popup: 'index.html',
    default_icon: {
      16: 'icons/rubric-16.png',
      32: 'icons/rubric-32.png',
    },
  },
  permissions: ['storage', 'declarativeNetRequest', 'downloads'],
  host_permissions: ['<all_urls>'],
  browser_specific_settings: {
    gecko: {
      id: '{cac29261-130a-401f-bff1-f22ffd030234}',
      data_collection_permissions: {
        required: ['none'],
      },
    },
  },
});
