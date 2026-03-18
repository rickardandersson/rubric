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
  MenuItem,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import Link from '@mui/material/Link';
import { Header } from './Header.jsx';
import {
  createEmptyHeader,
  createProfile,
  getProfilesFromStorage,
  getRulesToAdd,
  hasLegacySettings,
  hasValidRegexFilter,
  isFirefox,
  parseImportedSettings,
} from './utils.js';

export const Popup = () => {
  const [enabled, setEnabled] = useState(true);
  const [profiles, setProfiles] = useState([createProfile()]);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [requiresPermissions, setRequiresPermissions] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSuccessful, setImportSuccessful] = useState(false);
  const [importFailed, setImportFailed] = useState(false);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const regexIsMissing = activeProfile ? activeProfile.urlRegexFilter.length === 0 : true;
  const regexIsValid = activeProfile ? hasValidRegexFilter(activeProfile.urlRegexFilter) : false;

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      const result = await chrome.storage.local.get([
        'enabled',
        'profiles',
        'activeProfileId',
        'requestHeaders',
        'responseHeaders',
        'urlRegexFilter',
        'limitToLocalHost',
      ]);
      const storedProfiles = getProfilesFromStorage(result);
      const storedActiveProfileId = storedProfiles.some((profile) => profile.id === result.activeProfileId)
        ? result.activeProfileId
        : storedProfiles[0].id;
      const hasPermissions = await chrome.permissions.contains({
        origins: ['<all_urls>'],
      });

      if (cancelled) {
        return;
      }

      setEnabled(result.enabled ?? true);
      setProfiles(storedProfiles);
      setActiveProfileId(storedActiveProfileId);
      setRequiresPermissions(!hasPermissions);

      if (!Array.isArray(result.profiles) && hasLegacySettings(result)) {
        await chrome.storage.local.set({
          profiles: storedProfiles,
          activeProfileId: storedActiveProfileId,
        });
        await chrome.storage.local.remove(['requestHeaders', 'responseHeaders', 'urlRegexFilter', 'limitToLocalHost']);
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (profiles.length === 0) {
      const fallbackProfile = createProfile();
      setProfiles([fallbackProfile]);
      setActiveProfileId(fallbackProfile.id);
      return;
    }

    if (!profiles.some((profile) => profile.id === activeProfileId)) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId]);

  useEffect(() => {
    const persistSettings = async () => {
      await chrome.storage.local.set({ enabled, profiles, activeProfileId });

      const addRules = enabled ? getRulesToAdd(profiles) : [];
      const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
      const removeRuleIds = oldRules.map((rule) => rule.id);

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules,
      });
    };

    if (activeProfileId.length > 0) {
      persistSettings();
    }
  }, [activeProfileId, enabled, profiles]);

  const handleChangeTab = (_event, newValue) => {
    setActiveTabIndex(newValue);
  };

  const updateProfile = (profileId, updater) => {
    setProfiles((currentProfiles) =>
      currentProfiles.map((profile, index) => {
        if (profile.id !== profileId) {
          return profile;
        }

        const nextProfile = typeof updater === 'function' ? updater(profile) : updater;
        return createProfile(nextProfile, index);
      }),
    );
  };

  const updateActiveProfile = (updater) => {
    if (!activeProfile) {
      return;
    }

    updateProfile(activeProfile.id, updater);
  };

  const addProfile = () => {
    let newProfile;

    setProfiles((currentProfiles) => {
      newProfile = createProfile({}, currentProfiles.length);
      return [...currentProfiles, newProfile];
    });

    if (newProfile) {
      setActiveProfileId(newProfile.id);
    }
  };

  const deleteActiveProfile = () => {
    if (!activeProfile || profiles.length === 1) {
      return;
    }

    const activeIndex = profiles.findIndex((profile) => profile.id === activeProfile.id);
    const nextActiveProfile = profiles[activeIndex - 1] ?? profiles[activeIndex + 1] ?? profiles[0];

    setProfiles((currentProfiles) => currentProfiles.filter((profile) => profile.id !== activeProfile.id));
    setActiveProfileId(nextActiveProfile.id);
  };

  const updateHeaders = (type, index, property, value) => {
    updateActiveProfile((profile) => ({
      ...profile,
      [type]: profile[type].map((header, headerIndex) =>
        headerIndex === index
          ? {
              ...header,
              [property]: value,
            }
          : header,
      ),
    }));
  };

  const addHeader = (type) => {
    updateActiveProfile((profile) => ({
      ...profile,
      [type]: [...profile[type], createEmptyHeader()],
    }));
  };

  const deleteHeader = (type, index) => {
    updateActiveProfile((profile) => ({
      ...profile,
      [type]: profile[type].filter((_header, headerIndex) => headerIndex !== index),
    }));
  };

  const exportSettings = () => {
    const exportObject = {
      enabled,
      profiles,
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url,
      filename: 'rubric-export.json',
      saveAs: !isFirefox,
    });
  };

  const importSettings = (settingsText) => {
    try {
      const importObject = parseImportedSettings(settingsText);
      setEnabled(importObject.enabled ?? enabled);
      setProfiles(importObject.profiles);
      setActiveProfileId(importObject.profiles[0].id);
      setImportSuccessful(true);
      setImportFailed(false);
    } catch (error) {
      setImportFailed(true);
      setImportSuccessful(false);
      console.error('Failed to import settings', error);
    }
  };

  const handleFileSelected = (event) => {
    const [file] = event.target.files;
    if (!file) {
      console.error('No file selected for import');
      return;
    }

    const reader = new FileReader();
    reader.addEventListener(
      'load',
      () => {
        importSettings(reader.result);
      },
      false,
    );

    reader.readAsText(file);
    event.target.value = '';
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

      <Box display='flex' flexWrap='wrap' gap='0.75rem' alignItems='center' marginBlockStart='1rem'>
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
              {profile.name}
            </MenuItem>
          ))}
        </TextField>

        <FormControlLabel
          control={
            <Checkbox
              checked={activeProfile?.enabled ?? true}
              onChange={(event) => {
                updateActiveProfile((profile) => ({ ...profile, enabled: event.target.checked }));
              }}
            />
          }
          label='Profile enabled'
        />

        <Button variant='outlined' startIcon={<AddIcon />} onClick={addProfile}>
          Add profile
        </Button>

        <IconButton aria-label='delete profile' disabled={profiles.length === 1} onClick={deleteActiveProfile}>
          <DeleteIcon />
        </IconButton>
      </Box>

      <Typography variant='body2' color='text.secondary' sx={{ marginBlockStart: '0.5rem' }}>
        Each profile is tied to its own URL regex and can manage separate request and response headers.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', marginBlock: '1rem' }}>
        <Tabs value={activeTabIndex} onChange={handleChangeTab} aria-label='Switch between tabs'>
          <Tab id='tab-0' aria-controls='tabpanel-0' label='Request headers' />
          <Tab id='tab-1' aria-controls='tabpanel-1' label='Response headers' />
          <Tab id='tab-2' aria-controls='tabpanel-2' label='Settings' />
          <Tab id='tab-3' aria-controls='tabpanel-3' label='Import/export' />
        </Tabs>
      </Box>

      {activeTabIndex === 0 && activeProfile && (
        <Box id='tabpanel-0' aria-labelledby='tab-0'>
          {(regexIsMissing || !regexIsValid) && (
            <Alert variant='outlined' severity={regexIsMissing ? 'warning' : 'error'} sx={{ marginBlockEnd: '1rem' }}>
              {regexIsMissing
                ? 'This profile needs a URL regex before any request headers can be applied.'
                : 'This profile has an invalid URL regex, so no request header rules will be created.'}
            </Alert>
          )}

          <List>
            {activeProfile.requestHeaders.map((header, index) => (
              <ListItem key={index} disableGutters={true} sx={{ gap: '.75rem' }}>
                <Checkbox
                  checked={header.enabled}
                  onChange={(event) => {
                    updateHeaders('requestHeaders', index, 'enabled', event.target.checked);
                  }}
                />
                <TextField
                  label='Name'
                  variant='outlined'
                  size='small'
                  fullWidth={true}
                  value={header.name}
                  onChange={(event) => {
                    updateHeaders('requestHeaders', index, 'name', event.target.value);
                  }}
                />
                <TextField
                  label='Value'
                  variant='outlined'
                  size='small'
                  fullWidth={true}
                  value={header.value}
                  onChange={(event) => {
                    updateHeaders('requestHeaders', index, 'value', event.target.value);
                  }}
                />
                <IconButton
                  aria-label='delete'
                  onClick={() => {
                    deleteHeader('requestHeaders', index);
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
              addHeader('requestHeaders');
            }}>
            Add request header
          </Button>
        </Box>
      )}

      {activeTabIndex === 1 && activeProfile && (
        <Box id='tabpanel-1' aria-labelledby='tab-1'>
          {(regexIsMissing || !regexIsValid) && (
            <Alert variant='outlined' severity={regexIsMissing ? 'warning' : 'error'} sx={{ marginBlockEnd: '1rem' }}>
              {regexIsMissing
                ? 'This profile needs a URL regex before any response headers can be applied.'
                : 'This profile has an invalid URL regex, so no response header rules will be created.'}
            </Alert>
          )}

          <List>
            {activeProfile.responseHeaders.map((header, index) => (
              <ListItem key={index} disableGutters={true} sx={{ gap: '.75rem' }}>
                <Checkbox
                  checked={header.enabled}
                  onChange={(event) => {
                    updateHeaders('responseHeaders', index, 'enabled', event.target.checked);
                  }}
                />
                <TextField
                  label='Name'
                  variant='outlined'
                  size='small'
                  fullWidth={true}
                  value={header.name}
                  onChange={(event) => {
                    updateHeaders('responseHeaders', index, 'name', event.target.value);
                  }}
                />
                <TextField
                  label='Value'
                  variant='outlined'
                  size='small'
                  fullWidth={true}
                  value={header.value}
                  onChange={(event) => {
                    updateHeaders('responseHeaders', index, 'value', event.target.value);
                  }}
                />
                <IconButton
                  aria-label='delete'
                  onClick={() => {
                    deleteHeader('responseHeaders', index);
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
              addHeader('responseHeaders');
            }}>
            Add response header
          </Button>
        </Box>
      )}

      {activeTabIndex === 2 && activeProfile && (
        <Box id='tabpanel-2' aria-labelledby='tab-2' paddingBlockStart='1rem'>
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
                  : 'This regular expression limits which URLs this profile applies custom headers to. E.g. https://.*.example.(com|org)/.*'
            }
            onChange={(event) => {
              updateActiveProfile((profile) => ({ ...profile, urlRegexFilter: event.target.value }));
            }}
          />
          <FormControlLabel
            sx={{ marginBlockStart: '1rem' }}
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
              <Button variant='outlined' startIcon={<FileDownloadOutlinedIcon />} color='primary' onClick={exportSettings}>
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
