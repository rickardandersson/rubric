/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { Box, Button, TextField } from '@mui/material';
import { isFirefox } from './utils.js';

export const ImportExportTab = ({ importText, setImportText, importSettings, handleFileSelected, exportSettings }) => {
  return (
    <Box id='tabpanel-3' aria-labelledby='tab-3' paddingBlockStart='1rem'>
      <Box>
        {isFirefox ? (
          <Box display='flex' flexDirection='column' alignItems='flex-start' gap='1rem'>
            <TextField
              label='Import JSON'
              fullWidth={true}
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
              }}
              multiline
              rows={6}
              helperText='Paste the contents of a Rubric JSON export file and click "Import".'
            />
            <Button
              variant='outlined'
              startIcon={<FileUploadOutlinedIcon />}
              color='primary'
              disabled={importText.length === 0}
              onClick={() => {
                importSettings(importText);
              }}>
              Import
            </Button>
          </Box>
        ) : (
          <Button component='label' variant='outlined' startIcon={<FileUploadOutlinedIcon />}>
            Import
            <input type='file' onChange={handleFileSelected} hidden />
          </Button>
        )}
        <Box paddingBlockStart='1rem'>
          <Button variant='outlined' startIcon={<FileDownloadOutlinedIcon />} color='primary' onClick={exportSettings}>
            Export
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
