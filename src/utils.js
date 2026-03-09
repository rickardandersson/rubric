/*
 * Copyright (c) 2023, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

const allResourceTypes = Object.values(chrome.declarativeNetRequest.ResourceType);

const createProfileId = () => globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeHeader = (header) => ({
  name: typeof header?.name === 'string' ? header.name.trim() : '',
  value: typeof header?.value === 'string' ? header.value.trim() : '',
  enabled: header?.enabled ?? true,
});

const createProfileName = (index) => `Profile ${index + 1}`;

const isValidRegexFilter = (regexFilter) => {
  try {
    new RegExp(regexFilter);
  } catch {
    return false;
  }
  return true;
};

export const createEmptyHeader = () => ({ name: '', value: '', enabled: true });

export const createProfile = (overrides = {}, index = 0) => ({
  id: overrides.id ?? createProfileId(),
  name: typeof overrides.name === 'string' && overrides.name.trim().length > 0 ? overrides.name.trim() : createProfileName(index),
  enabled: overrides.enabled ?? true,
  requestHeaders: Array.isArray(overrides.requestHeaders) ? overrides.requestHeaders.map(normalizeHeader) : [],
  responseHeaders: Array.isArray(overrides.responseHeaders) ? overrides.responseHeaders.map(normalizeHeader) : [],
  urlRegexFilter: typeof overrides.urlRegexFilter === 'string' ? overrides.urlRegexFilter.trim() : '',
  limitToLocalHost: overrides.limitToLocalHost ?? false,
});

export const normalizeProfiles = (profiles) => {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return [createProfile()];
  }

  return profiles.map((profile, index) => createProfile(profile, index));
};

export const getProfilesFromStorage = (settings = {}) => {
  if (Array.isArray(settings.profiles) && settings.profiles.length > 0) {
    return normalizeProfiles(settings.profiles);
  }

  return [
    createProfile({
      requestHeaders: settings.requestHeaders,
      responseHeaders: settings.responseHeaders,
      urlRegexFilter: settings.urlRegexFilter,
      limitToLocalHost: settings.limitToLocalHost,
    }),
  ];
};

export const parseImportedSettings = (settingsText) => {
  const importObject = JSON.parse(settingsText);
  const profiles = Array.isArray(importObject.profiles)
    ? normalizeProfiles(importObject.profiles)
    : [
        createProfile({
          name: importObject.name,
          requestHeaders: importObject.requestHeaders,
          responseHeaders: importObject.responseHeaders,
          urlRegexFilter: importObject.urlRegexFilter,
          limitToLocalHost: importObject.limitToLocalHost,
        }),
      ];

  return {
    enabled: importObject.enabled,
    profiles,
  };
};

export const hasValidRegexFilter = (regexFilter) => regexFilter.length > 0 && isValidRegexFilter(regexFilter);

export const getRulesToAdd = (profiles) => {
  const addRules = [];
  let nextRuleId = 1;

  normalizeProfiles(profiles).forEach((profile) => {
    if (!profile.enabled || !hasValidRegexFilter(profile.urlRegexFilter)) {
      return;
    }

    // Construct request header rule
    const enabledRequestHeaders = profile.requestHeaders.filter((header) => header.enabled && header.name.length > 0 && header.value.length > 0);
    if (enabledRequestHeaders.length > 0) {
      const rule = {
        id: nextRuleId++,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders: [] },
        condition: { resourceTypes: allResourceTypes, regexFilter: profile.urlRegexFilter },
      };

      // Add a set operation for each header
      enabledRequestHeaders.forEach((header) => {
        rule.action.requestHeaders.push({ operation: 'set', header: header.name, value: header.value });
      });
      addRules.push(rule);
    }

    // Construct response header rule
    const enabledResponseHeaders = profile.responseHeaders.filter((header) => header.enabled && header.name.length > 0 && header.value.length > 0);
    if (enabledResponseHeaders.length > 0) {
      const rule = {
        id: nextRuleId++,
        priority: 1,
        action: { type: 'modifyHeaders', responseHeaders: [] },
        condition: { resourceTypes: allResourceTypes, regexFilter: profile.urlRegexFilter },
      };
      if (profile.limitToLocalHost) {
        rule.condition.initiatorDomains = ['localhost'];
      }

      // Add a set operation for each header
      enabledResponseHeaders.forEach((header) => {
        rule.action.responseHeaders.push({ operation: 'set', header: header.name, value: header.value });
      });
      addRules.push(rule);
    }
  });

  return addRules;
};

export const isFirefox = /Firefox\/[0-9]+/.test(navigator.userAgent);
