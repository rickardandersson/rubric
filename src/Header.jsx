/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import AddIcon from '@mui/icons-material/Add';
import CircleIcon from '@mui/icons-material/Circle';
import DeleteIcon from '@mui/icons-material/Delete';
import { Box, Divider, IconButton, MenuItem, Switch, TextField, Tooltip, Typography } from '@mui/material';

export const Header = ({ enabled, setEnabled, profiles, activeProfile, setActiveProfileId, addProfile, deleteActiveProfile }) => {
  return (
    <Box display='flex' justifyContent='space-between' alignItems='center'>
      <Box display='flex' alignItems='center' gap='1rem'>
        <img src='./icons/rubric-96.png' alt='Rubric icon' width='32' height='32' />
        <Typography variant='h6' component='h1'>
          Rubric
        </Typography>
      </Box>

      <Box display='flex'>
        <TextField
          select
          label='Profile'
          size='small'
          value={activeProfile?.id ?? ''}
          onChange={(event) => {
            setActiveProfileId(event.target.value);
          }}
          sx={{ minWidth: '220px' }}>
          {profiles.map((profile) => (
            <MenuItem key={profile.id} value={profile.id}>
              <CircleIcon sx={{ fontSize: '0.5rem', color: profile.enabled ? 'success.main' : 'action.disabled', marginRight: '0.5rem' }} />
              {profile.name}
            </MenuItem>
          ))}
        </TextField>

        <Divider sx={{ marginInlineStart: '.5rem' }} />

        <Tooltip title='Add profile'>
          <IconButton aria-label='Add profile' onClick={addProfile}>
            <AddIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title='Delete profile'>
          <span>
            <IconButton aria-label='Delete profile' disabled={profiles.length === 1} onClick={deleteActiveProfile}>
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Tooltip title='Activate/deactivate Rubric'>
        <Switch
          color='warning'
          checked={enabled}
          onChange={() => {
            setEnabled(!enabled);
          }}
        />
      </Tooltip>
    </Box>
  );
};
