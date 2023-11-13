/*
 * Copyright (c) 2023, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Box, Switch, Tooltip, Typography } from '@mui/material';

export const Header = ({ enabled, setEnabled }) => {
  return (
    <Box display='flex' justifyContent='space-between' alignItems='center'>
      <Box display='flex' alignItems='center' gap='1rem'>
        <img src='./icons/rubric-96.png' alt='Rubric icon' width='32' height='32' />
        <Typography variant='h6' component='h1'>
          Rubric
        </Typography>
      </Box>
      <Tooltip title='Enable/disable Rubric'>
        <Switch
          color='warning'
          inputProps={{ 'aria-label': 'Enable/disable Rubric' }}
          checked={enabled}
          onChange={() => {
            setEnabled(!enabled);
          }}
        />
      </Tooltip>
    </Box>
  );
};
