/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Box, Checkbox, Divider, FormControlLabel, List, ListItem, TextField } from '@mui/material';
import Link from '@mui/material/Link';

export const SettingsTab = ({ activeProfile, regexIsMissing, regexIsValid, updateActiveProfile }) => {
  return (
    <Box id='tabpanel-2' aria-labelledby='tab-2'>
      <List>
        <ListItem key={'profileName'} disableGutters={true} sx={{ gap: '.75rem' }}>
          <TextField
            label='Profile name'
            variant='outlined'
            size='small'
            fullWidth={true}
            value={activeProfile.name}
            onChange={(event) => {
              updateActiveProfile((profile) => ({ ...profile, name: event.target.value }));
            }}
          />
        </ListItem>
        <ListItem key={'urlRegexFilter'} disableGutters={true} sx={{ gap: '.75rem' }}>
          <TextField
            label='URL filter (regex)'
            variant='outlined'
            size='small'
            fullWidth={true}
            sx={{ marginBlockStart: '1rem' }}
            value={activeProfile.urlRegexFilter}
            error={!regexIsMissing && !regexIsValid}
            helperText={
              regexIsMissing
                ? 'Each profile needs a regular expression (RE2 format) before any headers will be applied.'
                : !regexIsValid
                  ? 'The current regex is invalid and will not generate any rules.'
                  : 'Limits which URLs this profile applies headers to. E.g. https://.*\\.example\\.(com|org)/.*'
            }
            onChange={(event) => {
              updateActiveProfile((profile) => ({ ...profile, urlRegexFilter: event.target.value }));
            }}
          />
        </ListItem>
        <ListItem key={'profileLimitToLocalHost'} disableGutters={true} sx={{ gap: '.75rem' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={activeProfile.limitToLocalHost}
                onChange={(event) => {
                  updateActiveProfile((profile) => ({ ...profile, limitToLocalHost: event.target.checked }));
                }}
              />
            }
            label='Only apply response headers to responses originating from localhost'
          />
        </ListItem>
      </List>
      <Divider sx={{ marginBlockStart: '2rem' }} />
      <Box display='flex' justifyContent='flex-end' sx={{ fontSize: '12px' }}>
        <p>
          Don't like what you see?{' '}
          <Link underline='hover' href='https://github.com/rickardandersson/rubric'>
            Submit a PR!
          </Link>
        </p>
      </Box>
    </Box>
  );
};
