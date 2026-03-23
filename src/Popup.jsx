/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Alert, AlertTitle, Box, FormControlLabel, Snackbar, Switch, Tab, Tabs } from '@mui/material';
import { useEffect, useState } from 'preact/hooks';
import { Header } from './Header.jsx';
import { HeaderList } from './HeaderList.jsx';
import { ImportExportTab } from './ImportExportTab.jsx';
import { SettingsTab } from './SettingsTab.jsx';
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
  const [ruleUpdateError, setRuleUpdateError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [regexIsValid, setRegexIsValid] = useState(false);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const regexIsMissing = activeProfile ? activeProfile.urlRegexFilter.length === 0 : true;

  // Effect: Validate regex filter against the RE2 engine
  useEffect(() => {
    if (!activeProfile || activeProfile.urlRegexFilter.trim().length === 0) {
      setRegexIsValid(false);
      return;
    }
    let cancelled = false;
    hasValidRegexFilter(activeProfile.urlRegexFilter).then((valid) => {
      if (!cancelled) setRegexIsValid(valid);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProfile?.urlRegexFilter]);

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

  // Effect 3a: Persist settings to storage immediately
  useEffect(() => {
    if (activeProfileId.length > 0) {
      chrome.storage.local.set({ enabled, profiles, activeProfileId }).then(
        () => setStorageError(''),
        (error) => {
          console.error('Failed to persist settings', error);
          setStorageError(error?.message ?? 'Failed to save settings');
        },
      );
    }
  }, [activeProfileId, enabled, profiles]);

  // Effect 3b: Rebuild declarativeNetRequest rules (debounced)
  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        const addRules = enabled ? await getRulesToAdd(profiles) : [];
        const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
        const removeRuleIds = oldRules.map((rule) => rule.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds,
          addRules,
        });
        setRuleUpdateError('');
      } catch (error) {
        console.error('Failed to update rules', error);
        setRuleUpdateError(error?.message ?? 'Failed to update rules');
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [enabled, profiles]);

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
    const newProfile = createProfile({}, profiles.length);
    setProfiles((currentProfiles) => [...currentProfiles, newProfile]);
    setActiveProfileId(newProfile.id);
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
    chrome.downloads.download(
      {
        url,
        filename: 'rubric-export.json',
        saveAs: !isFirefox,
      },
      () => {
        URL.revokeObjectURL(url);
      },
    );
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

      <Header
        enabled={enabled}
        setEnabled={setEnabled}
        profiles={profiles}
        activeProfile={activeProfile}
        setActiveProfileId={setActiveProfileId}
        addProfile={addProfile}
        deleteActiveProfile={deleteActiveProfile}
      />

      <Box display='flex' flexWrap='wrap' gap='0.75rem' alignItems='center' marginBlockStart='1rem'>
        <FormControlLabel
          control={
            <Switch
              checked={activeProfile?.enabled ?? true}
              onChange={(event) => {
                updateActiveProfile((profile) => ({ ...profile, enabled: event.target.checked }));
              }}
            />
          }
          label='Enable profile'
        />
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', marginBlock: '1rem' }}>
        <Tabs value={activeTabIndex} onChange={handleChangeTab} aria-label='Switch between tabs'>
          <Tab id='tab-0' aria-controls='tabpanel-0' label='Request headers' />
          <Tab id='tab-1' aria-controls='tabpanel-1' label='Response headers' />
          <Tab id='tab-2' aria-controls='tabpanel-2' label='Settings' />
          <Tab id='tab-3' aria-controls='tabpanel-3' label='Import/export' sx={{ marginInlineStart: 'auto' }} />
        </Tabs>
      </Box>

      {activeTabIndex === 0 && activeProfile && (
        <Box id='tabpanel-0' aria-labelledby='tab-0'>
          <HeaderList
            type='requestHeaders'
            headers={activeProfile.requestHeaders}
            regexIsMissing={regexIsMissing}
            regexIsValid={regexIsValid}
            updateHeaders={updateHeaders}
            deleteHeader={deleteHeader}
            addHeader={addHeader}
          />
        </Box>
      )}

      {activeTabIndex === 1 && activeProfile && (
        <Box id='tabpanel-1' aria-labelledby='tab-1'>
          <HeaderList
            type='responseHeaders'
            headers={activeProfile.responseHeaders}
            regexIsMissing={regexIsMissing}
            regexIsValid={regexIsValid}
            updateHeaders={updateHeaders}
            deleteHeader={deleteHeader}
            addHeader={addHeader}
          />
        </Box>
      )}

      {activeTabIndex === 2 && activeProfile && (
        <SettingsTab
          activeProfile={activeProfile}
          regexIsMissing={regexIsMissing}
          regexIsValid={regexIsValid}
          updateActiveProfile={updateActiveProfile}
        />
      )}

      {activeTabIndex === 3 && (
        <ImportExportTab
          importText={importText}
          setImportText={setImportText}
          importSettings={importSettings}
          handleFileSelected={handleFileSelected}
          exportSettings={exportSettings}
        />
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
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={5000}
        open={ruleUpdateError.length > 0}
        onClose={() => setRuleUpdateError('')}>
        <Alert variant='outlined' severity='error' sx={{ width: '100%' }}>
          Failed to update rules: {ruleUpdateError}
        </Alert>
      </Snackbar>
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={5000}
        open={storageError.length > 0}
        onClose={() => setStorageError('')}>
        <Alert variant='outlined' severity='error' sx={{ width: '100%' }}>
          Failed to save settings: {storageError}
        </Alert>
      </Snackbar>
    </>
  );
};
