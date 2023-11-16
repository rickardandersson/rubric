/*
 * Copyright (c) 2023, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { useEffect, useState } from 'preact/hooks';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  Snackbar,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import Link from '@mui/material/Link';
import { Header } from './Header.jsx';
import { getRulesToAdd, isFirefox } from './utils.js';

export const Popup = () => {
  const [enabled, setEnabled] = useState(true);
  const [requestHeaders, setRequestHeaders] = useState([]);
  const [responseHeaders, setResponseHeaders] = useState([]);
  const [urlRegexFilter, setUrlRegexFilter] = useState('');
  const [limitToLocalHost, setLimitToLocalHost] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [requiresPermissions, setRequiresPermissions] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSuccessful, setImportSuccessful] = useState(false);
  const [importFailed, setImportFailed] = useState(false);

  // Side effect for initial load
  useEffect(async () => {
    // Get settings from storage
    const result = await chrome.storage.local.get(['enabled', 'requestHeaders', 'responseHeaders', 'urlRegexFilter', 'limitToLocalHost']);
    setEnabled(result.enabled ?? true);
    setRequestHeaders(result.requestHeaders ?? []);
    setResponseHeaders(result.responseHeaders ?? []);
    setUrlRegexFilter(result.urlRegexFilter ?? '');
    setLimitToLocalHost(result.limitToLocalHost ?? false);

    // Check if we have the required host permissions
    const hasPermissions = await chrome.permissions.contains({
      origins: ['<all_urls>'],
    });
    if (!hasPermissions) {
      setRequiresPermissions(true);
    }
  }, []);

  // Side effect for changes to settings
  useEffect(async () => {
    // Save settings to storage
    await chrome.storage.local.set({ enabled, requestHeaders, responseHeaders, urlRegexFilter, limitToLocalHost });

    // Update declarativeNetRequest dynamic rules
    const addRules = enabled ? getRulesToAdd(requestHeaders, responseHeaders, urlRegexFilter, limitToLocalHost) : [];
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = oldRules.map((rule) => rule.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules,
    });
  }, [requestHeaders, responseHeaders, urlRegexFilter, limitToLocalHost, enabled]);

  const handleChangeTab = (event, newValue) => {
    setActiveTabIndex(newValue);
  };

  // Helper function for updating request headers from onchange/onblur events
  const updateRequestHeaders = (index, property, value) => {
    const oldValue = requestHeaders[index][property];
    console.log(`updateRequestHeaders: index=${index}, property=${property}, oldValue=${oldValue}, value=${value}`);
    if (oldValue !== value) {
      const newRequestHeaders = [...requestHeaders];
      newRequestHeaders[index][property] = typeof value === 'string' ? value.trim() : value;
      setRequestHeaders(newRequestHeaders);
    }
  };

  const deleteRequestHeader = (index) => {
    const newRequestHeaders = [...requestHeaders];
    newRequestHeaders.splice(index, 1);
    setRequestHeaders(newRequestHeaders);
  };

  // Helper function for updating response headers from onchange/onblur events
  const updateResponseHeaders = (index, property, value) => {
    const oldValue = responseHeaders[index][property];
    if (oldValue !== value) {
      const newResponseHeaders = [...responseHeaders];
      newResponseHeaders[index][property] = typeof value === 'string' ? value.trim() : value;
      setResponseHeaders(newResponseHeaders);
    }
  };

  const deleteResponseHeader = (index) => {
    const newResponseHeaders = [...responseHeaders];
    newResponseHeaders.splice(index, 1);
    setResponseHeaders(newResponseHeaders);
  };

  const exportSettings = () => {
    // Construct the content of the export file
    let exportObject = {
      requestHeaders: requestHeaders.length > 0 ? requestHeaders : undefined,
      responseHeaders: responseHeaders.length > 0 ? responseHeaders : undefined,
      urlRegexFilter: urlRegexFilter.length > 0 ? urlRegexFilter : undefined,
      limitToLocalHost: limitToLocalHost ? limitToLocalHost : undefined,
    };

    // Create a blog and download it
    let blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    let url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: 'rubric-export.json', // This appears to be ignored?
      saveAs: true,
    });
  };

  const importSettings = (settingsText) => {
    try {
      // Parse the import file and update state accordingly
      let importObject = JSON.parse(settingsText);
      setRequestHeaders(importObject.requestHeaders ?? requestHeaders);
      setResponseHeaders(importObject.responseHeaders ?? responseHeaders);
      setUrlRegexFilter(importObject.urlRegexFilter ?? urlRegexFilter);
      setLimitToLocalHost(importObject.limitToLocalHost ?? limitToLocalHost);
      setImportSuccessful(true);
    } catch (error) {
      setImportFailed(true);
      console.error('Failed to import settings', error);
    }
  };

  const handleFileSelected = (event) => {
    let [file] = event.target.files;
    if (!file) {
      console.error('No file selected for import');
      return;
    }

    let reader = new FileReader();
    reader.addEventListener(
      'load',
      () => {
        importSettings(reader.result);
      },
      false,
    );

    reader.readAsText(file);
  };

  return (
    <>
      {requiresPermissions && (
        <Alert variant='outlined' severity='error' sx={{ marginBlockEnd: '2rem' }}>
          <AlertTitle>Permission required</AlertTitle>
          In order for this extension to be able to inject HTTP headers into any and all requests that are made by the browser, it needs the
          permission "Access your data for all web sites". You can grant this permission by right-clicking the extension, selecting "Manage" and then
          on the "Permissions" tab, toggle the optional permission.
        </Alert>
      )}

      <Header enabled={enabled} setEnabled={setEnabled} />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', marginBlock: '1rem' }}>
        <Tabs value={activeTabIndex} onChange={handleChangeTab} aria-label='Switch between tabs'>
          <Tab id='tab-0' aria-controls='tabpanel-0' label='Request headers' />
          <Tab id='tab-1' aria-controls='tabpanel-1' label='Response headers' />
          <Tab id='tab-2' aria-controls='tabpanel-2' label='Settings' />
          <Tab id='tab-3' aria-controls='tabpanel-3' label='Import/export' />
        </Tabs>
      </Box>

      {activeTabIndex === 0 && (
        <Box id='tabpanel-0' aria-labelledby='tab-0'>
          <List>
            {requestHeaders.map((header, index) => (
              <ListItem key={index} disableGutters={true} sx={{ gap: '.75rem' }}>
                <Checkbox
                  checked={header.enabled}
                  onChange={(event) => {
                    updateRequestHeaders(index, 'enabled', event.target.checked);
                  }}
                />
                <TextField
                  label='Name'
                  variant='outlined'
                  size='small'
                  fullWidth={true}
                  value={header.name}
                  onBlur={(event) => {
                    updateRequestHeaders(index, 'name', event.target.value);
                  }}
                />
                <TextField
                  label='Value'
                  variant='outlined'
                  size='small'
                  fullWidth={true}
                  value={header.value}
                  onBlur={(event) => {
                    updateRequestHeaders(index, 'value', event.target.value);
                  }}
                />
                <IconButton
                  aria-label='delete'
                  onClick={() => {
                    deleteRequestHeader(index);
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
              setRequestHeaders([...requestHeaders, { name: '', value: '', enabled: true }]);
            }}>
            Add request header
          </Button>
          {requestHeaders.length > 0 && urlRegexFilter.length === 0 && (
            <Alert variant='outlined' severity='warning' sx={{ marginBlockStart: '2rem' }}>
              You have no URL filter provided in the Settings tab. Any request headers you add here will be sent to all domains/paths. Be careful not
              to leak secrets!
            </Alert>
          )}
        </Box>
      )}

      {activeTabIndex === 1 && (
        <Box id='tabpanel-1' aria-labelledby='tab-1'>
          <List>
            {responseHeaders.map((header, index) => (
              <ListItem key={index} disableGutters={true} sx={{ gap: '.75rem' }}>
                <Checkbox
                  checked={header.enabled}
                  onChange={(event) => {
                    updateResponseHeaders(index, 'enabled', event.target.checked);
                  }}
                />
                <TextField
                  label='Name'
                  variant='outlined'
                  size='small'
                  fullWidth={true}
                  value={header.name}
                  onBlur={(event) => {
                    updateResponseHeaders(index, 'name', event.target.value);
                  }}
                />
                <TextField
                  label='Value'
                  variant='outlined'
                  size='small'
                  fullWidth={true}
                  value={header.value}
                  onBlur={(event) => {
                    updateResponseHeaders(index, 'value', event.target.value);
                  }}
                />
                <IconButton
                  aria-label='delete'
                  onClick={() => {
                    deleteResponseHeader(index);
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
              setResponseHeaders([...responseHeaders, { name: '', value: '', enabled: true }]);
            }}>
            Add response header
          </Button>
        </Box>
      )}

      {activeTabIndex === 2 && (
        <Box id='tabpanel-2' aria-labelledby='tab-2' paddingBlockStart='1rem'>
          <TextField
            label='URL filter (regex)'
            variant='outlined'
            size='small'
            helperText='A regular expression (RE2 format) that limits which URLs to apply custom headers to. E.g. https:\/\/.*\.example\.(com|org)\/.*'
            fullWidth={true}
            value={urlRegexFilter}
            onBlur={(event) => {
              if (urlRegexFilter !== event.target.value) {
                setUrlRegexFilter(event.target.value.trim());
              }
            }}
          />
          <FormControlLabel
            sx={{ marginBlockStart: '1rem' }}
            control={
              <Checkbox
                checked={limitToLocalHost}
                onChange={() => {
                  setLimitToLocalHost(!limitToLocalHost);
                }}
              />
            }
            label='Only apply response headers to responses originating from localhost'
          />
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
      )}

      {activeTabIndex === 3 && (
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
              <Button
                variant='outlined'
                startIcon={<FileDownloadOutlinedIcon />}
                color='primary'
                onClick={exportSettings}
                disabled={requestHeaders.length === 0 && responseHeaders.length === 0 && urlRegexFilter.length === 0}>
                Export
              </Button>
            </Box>
          </Box>
        </Box>
      )}
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={3000}
        open={importSuccessful}
        onClose={() => setImportSuccessful(false)}>
        <Alert variant='outlined' severity='success' sx={{ width: '100%' }}>
          Settings successfully imported.
        </Alert>
      </Snackbar>
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={3000}
        open={importFailed}
        onClose={() => setImportFailed(false)}>
        <Alert variant='outlined' severity='error' sx={{ width: '100%' }}>
          Failed to import settings.
        </Alert>
      </Snackbar>
    </>
  );
};
