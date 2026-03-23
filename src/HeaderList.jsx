/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Alert, Button, IconButton, List, ListItem, Switch, TextField, Tooltip } from '@mui/material';

export const HeaderList = ({ type, headers, regexIsMissing, regexIsValid, updateHeaders, deleteHeader, addHeader }) => {
  const label = type === 'requestHeaders' ? 'request' : 'response';
  return (
    <>
      {(regexIsMissing || !regexIsValid) && (
        <Alert variant='outlined' severity={regexIsMissing ? 'warning' : 'error'} sx={{ marginBlockEnd: '1rem' }}>
          {regexIsMissing
            ? `This profile needs a URL filter before any ${label} headers can be applied.`
            : `This profile has an invalid URL filter, so no ${label} headers will be applied.`}
        </Alert>
      )}

      <List>
        {headers.map((header, index) => (
          <ListItem key={header.id} disableGutters={true} sx={{ gap: '.75rem' }}>
            <Tooltip title='Activate/deactivate header'>
              <Switch
                checked={header.enabled}
                onChange={(event) => {
                  updateHeaders(type, index, 'enabled', event.target.checked);
                }}
              />
            </Tooltip>
            <TextField
              label='Name'
              variant='outlined'
              size='small'
              fullWidth={true}
              value={header.name}
              onChange={(event) => {
                updateHeaders(type, index, 'name', event.target.value);
              }}
            />
            <TextField
              label='Value'
              variant='outlined'
              size='small'
              fullWidth={true}
              value={header.value}
              onChange={(event) => {
                updateHeaders(type, index, 'value', event.target.value);
              }}
            />
            <IconButton
              aria-label='delete'
              onClick={() => {
                deleteHeader(type, index);
              }}>
              <DeleteIcon />
            </IconButton>
          </ListItem>
        ))}
      </List>
      <Button
        variant='outlined'
        startIcon={<AddIcon />}
        color='primary'
        onClick={() => {
          addHeader(type);
        }}>
        Add {label} header
      </Button>
    </>
  );
};
