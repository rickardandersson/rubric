/*
 * Copyright (c) 2023, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

const allResourceTypes = Object.values(chrome.declarativeNetRequest.ResourceType);

const isValidRegexFilter = (regexFilter) => {
  try {
    new RegExp(regexFilter);
  } catch (e) {
    return false;
  }
  return true;
};

export const getRulesToAdd = (requestHeaders, responseHeaders, urlRegexFilter, limitToLocalhost) => {
  const addRules = [];

  // Construct request header rule
  const enabledRequestHeaders = requestHeaders.filter((header) => header.enabled && header.name.length > 0 && header.value.length > 0);
  if (enabledRequestHeaders.length > 0) {
    const rule = {
      id: 1,
      priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [] },
      condition: { resourceTypes: allResourceTypes },
    };
    if (urlRegexFilter.length > 0 && isValidRegexFilter(urlRegexFilter)) {
      rule.condition.regexFilter = urlRegexFilter;
    }

    // Add a set operation for each header
    enabledRequestHeaders.forEach((header) => {
      rule.action.requestHeaders.push({ operation: 'set', header: header.name, value: header.value });
    });
    addRules.push(rule);
  }

  // Construct response header rule
  const enabledResponseHeaders = responseHeaders.filter((header) => header.enabled && header.name.length > 0 && header.value.length > 0);
  if (enabledResponseHeaders.length > 0) {
    const rule = {
      id: 2,
      priority: 1,
      action: { type: 'modifyHeaders', responseHeaders: [] },
      condition: { resourceTypes: allResourceTypes },
    };
    if (urlRegexFilter.length > 0 && isValidRegexFilter(urlRegexFilter)) {
      rule.condition.regexFilter = urlRegexFilter;
    }
    if (limitToLocalhost) {
      rule.condition.initiatorDomains = ['localhost'];
    }

    // Add a set operation for each header
    enabledResponseHeaders.forEach((header) => {
      rule.action.responseHeaders.push({ operation: 'set', header: header.name, value: header.value });
    });
    addRules.push(rule);
  }

  return addRules;
};

export const isFirefox = /Firefox\/[0-9]+/.test(navigator.userAgent);
