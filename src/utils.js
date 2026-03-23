/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

const allResourceTypes = Object.values(chrome.declarativeNetRequest.ResourceType);

const createProfileId = () => globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createHeaderId = () => globalThis.crypto?.randomUUID?.() ?? `header-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeHeader = (header) => ({
  id: header?.id ?? createHeaderId(),
  name: typeof header?.name === 'string' ? header.name : '',
  value: typeof header?.value === 'string' ? header.value : '',
  enabled: header?.enabled ?? true,
});

const createProfileName = (index) => `Profile ${index + 1}`;

const isValidRegexFilter = async (regexFilter) => {
  const result = await chrome.declarativeNetRequest.isRegexSupported({ regex: regexFilter });
  return result.isSupported;
};

export const createEmptyHeader = () => ({ id: createHeaderId(), name: '', value: '', enabled: true });

export const createProfile = (overrides = {}, index = 0) => ({
  id: overrides.id ?? createProfileId(),
  name: typeof overrides.name === 'string' && overrides.name.trim().length > 0 ? overrides.name : createProfileName(index),
  enabled: overrides.enabled ?? true,
  requestHeaders: Array.isArray(overrides.requestHeaders) ? overrides.requestHeaders.map(normalizeHeader) : [],
  responseHeaders: Array.isArray(overrides.responseHeaders) ? overrides.responseHeaders.map(normalizeHeader) : [],
  urlRegexFilter: typeof overrides.urlRegexFilter === 'string' ? overrides.urlRegexFilter : '',
  limitToLocalHost: overrides.limitToLocalHost ?? false,
});

export const normalizeProfiles = (profiles) => {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return [createProfile()];
  }

  return profiles.map((profile, index) => createProfile(profile, index));
};

export const hasLegacySettings = (settings = {}) => {
  const hasRequestHeaders = Array.isArray(settings.requestHeaders) && settings.requestHeaders.length > 0;
  const hasResponseHeaders = Array.isArray(settings.responseHeaders) && settings.responseHeaders.length > 0;
  const hasUrlRegexFilter = typeof settings.urlRegexFilter === 'string' && settings.urlRegexFilter.trim().length > 0;

  return hasRequestHeaders || hasResponseHeaders || hasUrlRegexFilter || settings.limitToLocalHost === true;
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

export const hasValidRegexFilter = async (regexFilter) => regexFilter.trim().length > 0 && (await isValidRegexFilter(regexFilter.trim()));

export const getRulesToAdd = async (profiles) => {
  const addRules = [];
  let nextRuleId = 1;

  for (const profile of profiles) {
    if (!profile.enabled || !(await hasValidRegexFilter(profile.urlRegexFilter))) {
      continue;
    }

    // Construct request header rule
    const enabledRequestHeaders = profile.requestHeaders.filter(
      (header) => header.enabled && header.name.trim().length > 0 && header.value.trim().length > 0,
    );
    if (enabledRequestHeaders.length > 0) {
      const rule = {
        id: nextRuleId++,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders: [] },
        condition: { resourceTypes: allResourceTypes, regexFilter: profile.urlRegexFilter.trim() },
      };

      // Add a set operation for each header
      enabledRequestHeaders.forEach((header) => {
        rule.action.requestHeaders.push({ operation: 'set', header: header.name.trim(), value: header.value.trim() });
      });
      addRules.push(rule);
    }

    // Construct response header rule
    const enabledResponseHeaders = profile.responseHeaders.filter(
      (header) => header.enabled && header.name.trim().length > 0 && header.value.trim().length > 0,
    );
    if (enabledResponseHeaders.length > 0) {
      const rule = {
        id: nextRuleId++,
        priority: 1,
        action: { type: 'modifyHeaders', responseHeaders: [] },
        condition: { resourceTypes: allResourceTypes, regexFilter: profile.urlRegexFilter.trim() },
      };
      if (profile.limitToLocalHost) {
        rule.condition.initiatorDomains = ['localhost'];
      }

      // Add a set operation for each header
      enabledResponseHeaders.forEach((header) => {
        rule.action.responseHeaders.push({ operation: 'set', header: header.name.trim(), value: header.value.trim() });
      });
      addRules.push(rule);
    }
  }

  return addRules;
};

export const isFirefox = /Firefox\/[0-9]+/.test(navigator.userAgent);
