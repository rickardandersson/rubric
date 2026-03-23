/*
 * Copyright (c) 2023-2026, Rickard Andersson <rickard.andersson@gmail.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock chrome APIs and navigator before importing utils.js,
// since it reads chrome.declarativeNetRequest.ResourceType at module load time.
const RESOURCE_TYPES = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'xmlhttprequest', 'other'];

globalThis.chrome = {
  declarativeNetRequest: {
    ResourceType: Object.fromEntries(RESOURCE_TYPES.map((t) => [t.toUpperCase(), t])),
    isRegexSupported: vi.fn(),
  },
};

// Mock navigator.userAgent for the isFirefox check
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' },
  writable: true,
});

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

const {
  createEmptyHeader,
  createProfile,
  normalizeProfiles,
  hasLegacySettings,
  getProfilesFromStorage,
  parseImportedSettings,
  hasValidRegexFilter,
  getRulesToAdd,
  isFirefox,
} = await import('./utils.js');

beforeEach(() => {
  uuidCounter = 0;
  vi.clearAllMocks();
});

// ─── createEmptyHeader ───────────────────────────────────────────────

describe('createEmptyHeader', () => {
  it('returns a header with empty name, value, enabled true, and a unique id', () => {
    const header = createEmptyHeader();
    expect(header).toEqual({
      id: expect.any(String),
      name: '',
      value: '',
      enabled: true,
    });
  });

  it('generates unique ids across calls', () => {
    const a = createEmptyHeader();
    const b = createEmptyHeader();
    expect(a.id).not.toBe(b.id);
  });
});

// ─── createProfile ───────────────────────────────────────────────────

describe('createProfile', () => {
  it('creates a default profile with index-based name', () => {
    const profile = createProfile({}, 0);
    expect(profile).toEqual({
      id: expect.any(String),
      name: 'Profile 1',
      enabled: true,
      requestHeaders: [],
      responseHeaders: [],
      urlRegexFilter: '',
      limitToLocalHost: false,
    });
  });

  it('uses provided overrides', () => {
    const profile = createProfile(
      {
        id: 'custom-id',
        name: 'My Profile',
        enabled: false,
        urlRegexFilter: 'https://.*',
        limitToLocalHost: true,
        requestHeaders: [{ name: 'X-Foo', value: 'bar' }],
        responseHeaders: [{ name: 'X-Baz', value: 'qux', enabled: false }],
      },
      5,
    );

    expect(profile.id).toBe('custom-id');
    expect(profile.name).toBe('My Profile');
    expect(profile.enabled).toBe(false);
    expect(profile.urlRegexFilter).toBe('https://.*');
    expect(profile.limitToLocalHost).toBe(true);
    expect(profile.requestHeaders).toHaveLength(1);
    expect(profile.requestHeaders[0]).toMatchObject({ name: 'X-Foo', value: 'bar' });
    expect(profile.responseHeaders).toHaveLength(1);
    expect(profile.responseHeaders[0]).toMatchObject({ name: 'X-Baz', value: 'qux', enabled: false });
  });

  it('normalizes headers — adds id and defaults', () => {
    const profile = createProfile({
      requestHeaders: [{ name: 'X-Test' }],
    });
    const header = profile.requestHeaders[0];
    expect(header.id).toEqual(expect.any(String));
    expect(header.value).toBe('');
    expect(header.enabled).toBe(true);
  });

  it('falls back to index-based name for empty/whitespace name', () => {
    expect(createProfile({ name: '' }, 2).name).toBe('Profile 3');
    expect(createProfile({ name: '   ' }, 0).name).toBe('Profile 1');
  });

  it('falls back to index-based name for non-string name', () => {
    expect(createProfile({ name: 42 }, 0).name).toBe('Profile 1');
    expect(createProfile({ name: null }, 1).name).toBe('Profile 2');
  });

  it('handles non-array requestHeaders/responseHeaders gracefully', () => {
    const profile = createProfile({ requestHeaders: 'not-an-array', responseHeaders: 123 });
    expect(profile.requestHeaders).toEqual([]);
    expect(profile.responseHeaders).toEqual([]);
  });

  it('defaults urlRegexFilter to empty string for non-string values', () => {
    expect(createProfile({ urlRegexFilter: 42 }).urlRegexFilter).toBe('');
    expect(createProfile({ urlRegexFilter: null }).urlRegexFilter).toBe('');
  });
});

// ─── normalizeProfiles ───────────────────────────────────────────────

describe('normalizeProfiles', () => {
  it('returns a single default profile for empty array', () => {
    const profiles = normalizeProfiles([]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Profile 1');
  });

  it('returns a single default profile for non-array input', () => {
    expect(normalizeProfiles(null)).toHaveLength(1);
    expect(normalizeProfiles(undefined)).toHaveLength(1);
    expect(normalizeProfiles('string')).toHaveLength(1);
  });

  it('normalizes each profile in the array', () => {
    const profiles = normalizeProfiles([{ name: 'A' }, { name: 'B' }]);
    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe('A');
    expect(profiles[1].name).toBe('B');
    // Each profile should have all required fields
    for (const p of profiles) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('enabled');
      expect(p).toHaveProperty('requestHeaders');
      expect(p).toHaveProperty('responseHeaders');
      expect(p).toHaveProperty('urlRegexFilter');
      expect(p).toHaveProperty('limitToLocalHost');
    }
  });

  it('uses index-based naming for profiles without names', () => {
    const profiles = normalizeProfiles([{}, {}, {}]);
    expect(profiles[0].name).toBe('Profile 1');
    expect(profiles[1].name).toBe('Profile 2');
    expect(profiles[2].name).toBe('Profile 3');
  });
});

// ─── hasLegacySettings ───────────────────────────────────────────────

describe('hasLegacySettings', () => {
  it('returns false for empty settings', () => {
    expect(hasLegacySettings({})).toBe(false);
    expect(hasLegacySettings()).toBe(false);
  });

  it('detects legacy requestHeaders', () => {
    expect(hasLegacySettings({ requestHeaders: [{ name: 'X-Foo', value: 'bar' }] })).toBe(true);
  });

  it('detects legacy responseHeaders', () => {
    expect(hasLegacySettings({ responseHeaders: [{ name: 'X-Foo', value: 'bar' }] })).toBe(true);
  });

  it('detects legacy urlRegexFilter', () => {
    expect(hasLegacySettings({ urlRegexFilter: 'https://.*' })).toBe(true);
  });

  it('detects legacy limitToLocalHost', () => {
    expect(hasLegacySettings({ limitToLocalHost: true })).toBe(true);
  });

  it('ignores empty arrays and blank strings', () => {
    expect(hasLegacySettings({ requestHeaders: [], responseHeaders: [], urlRegexFilter: '' })).toBe(false);
    expect(hasLegacySettings({ urlRegexFilter: '   ' })).toBe(false);
  });

  it('does not treat limitToLocalHost: false as legacy', () => {
    expect(hasLegacySettings({ limitToLocalHost: false })).toBe(false);
  });
});

// ─── getProfilesFromStorage ──────────────────────────────────────────

describe('getProfilesFromStorage', () => {
  it('returns normalized profiles when settings has profiles array', () => {
    const settings = {
      profiles: [{ name: 'My Profile', enabled: true }],
    };
    const profiles = getProfilesFromStorage(settings);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('My Profile');
    expect(profiles[0]).toHaveProperty('id');
  });

  it('migrates legacy settings (no profiles array) into a single profile', () => {
    const settings = {
      requestHeaders: [{ name: 'X-Foo', value: 'bar' }],
      responseHeaders: [{ name: 'X-Baz', value: 'qux' }],
      urlRegexFilter: 'https://.*',
      limitToLocalHost: true,
    };
    const profiles = getProfilesFromStorage(settings);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].requestHeaders).toHaveLength(1);
    expect(profiles[0].responseHeaders).toHaveLength(1);
    expect(profiles[0].urlRegexFilter).toBe('https://.*');
    expect(profiles[0].limitToLocalHost).toBe(true);
  });

  it('returns a default profile for empty settings', () => {
    const profiles = getProfilesFromStorage({});
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Profile 1');
  });

  it('returns a default profile when called with no argument', () => {
    const profiles = getProfilesFromStorage();
    expect(profiles).toHaveLength(1);
  });

  it('ignores profiles if it is an empty array', () => {
    const profiles = getProfilesFromStorage({ profiles: [] });
    // Empty array falls through to legacy path, which creates a default profile
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Profile 1');
  });
});

// ─── parseImportedSettings ───────────────────────────────────────────

describe('parseImportedSettings', () => {
  it('parses a valid export with profiles', () => {
    const input = JSON.stringify({
      enabled: true,
      profiles: [
        {
          name: 'Test',
          enabled: true,
          requestHeaders: [{ name: 'X-Foo', value: 'bar' }],
          responseHeaders: [],
          urlRegexFilter: 'https://.*',
        },
      ],
    });

    const result = parseImportedSettings(input);
    expect(result.enabled).toBe(true);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].name).toBe('Test');
    expect(result.profiles[0].requestHeaders[0]).toMatchObject({ name: 'X-Foo', value: 'bar' });
  });

  it('handles legacy single-profile format (no profiles array)', () => {
    const input = JSON.stringify({
      enabled: false,
      name: 'Legacy',
      requestHeaders: [{ name: 'Authorization', value: 'Bearer xyz' }],
    });

    const result = parseImportedSettings(input);
    expect(result.enabled).toBe(false);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].name).toBe('Legacy');
    expect(result.profiles[0].requestHeaders[0]).toMatchObject({ name: 'Authorization', value: 'Bearer xyz' });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseImportedSettings('not json')).toThrow();
  });

  it('normalizes profiles from imported data', () => {
    const input = JSON.stringify({
      enabled: true,
      profiles: [{ requestHeaders: [{ name: 'X-Test' }] }],
    });

    const result = parseImportedSettings(input);
    const header = result.profiles[0].requestHeaders[0];
    // normalizeHeader should have filled in defaults
    expect(header.value).toBe('');
    expect(header.enabled).toBe(true);
    expect(header.id).toEqual(expect.any(String));
  });
});

// ─── hasValidRegexFilter ─────────────────────────────────────────────

describe('hasValidRegexFilter', () => {
  it('returns true for a valid non-empty regex', async () => {
    chrome.declarativeNetRequest.isRegexSupported.mockResolvedValue({ isSupported: true });
    expect(await hasValidRegexFilter('https://.*')).toBe(true);
  });

  it('returns false for an empty string', async () => {
    expect(await hasValidRegexFilter('')).toBe(false);
    expect(chrome.declarativeNetRequest.isRegexSupported).not.toHaveBeenCalled();
  });

  it('returns false for a whitespace-only string', async () => {
    expect(await hasValidRegexFilter('   ')).toBe(false);
    expect(chrome.declarativeNetRequest.isRegexSupported).not.toHaveBeenCalled();
  });

  it('returns false for an unsupported regex', async () => {
    chrome.declarativeNetRequest.isRegexSupported.mockResolvedValue({ isSupported: false });
    expect(await hasValidRegexFilter('(?<=foo)bar')).toBe(false);
  });

  it('trims the regex before validating', async () => {
    chrome.declarativeNetRequest.isRegexSupported.mockResolvedValue({ isSupported: true });
    await hasValidRegexFilter('  https://.*  ');
    expect(chrome.declarativeNetRequest.isRegexSupported).toHaveBeenCalledWith({ regex: 'https://.*' });
  });
});

// ─── getRulesToAdd ───────────────────────────────────────────────────

describe('getRulesToAdd', () => {
  beforeEach(() => {
    chrome.declarativeNetRequest.isRegexSupported.mockResolvedValue({ isSupported: true });
  });

  const makeProfile = (overrides = {}) => ({
    id: 'p1',
    name: 'Test',
    enabled: true,
    requestHeaders: [],
    responseHeaders: [],
    urlRegexFilter: 'https://example\\.com/.*',
    limitToLocalHost: false,
    ...overrides,
  });

  it('returns empty array for no profiles', async () => {
    expect(await getRulesToAdd([])).toEqual([]);
  });

  it('skips disabled profiles', async () => {
    const profiles = [makeProfile({ enabled: false })];
    expect(await getRulesToAdd(profiles)).toEqual([]);
  });

  it('skips profiles with empty urlRegexFilter', async () => {
    const profiles = [makeProfile({ urlRegexFilter: '' })];
    expect(await getRulesToAdd(profiles)).toEqual([]);
  });

  it('skips profiles with invalid regex', async () => {
    chrome.declarativeNetRequest.isRegexSupported.mockResolvedValue({ isSupported: false });
    const profiles = [
      makeProfile({
        requestHeaders: [{ name: 'X-Foo', value: 'bar', enabled: true }],
      }),
    ];
    expect(await getRulesToAdd(profiles)).toEqual([]);
  });

  it('generates a request header rule', async () => {
    const profiles = [
      makeProfile({
        requestHeaders: [
          { name: 'X-Foo', value: 'bar', enabled: true },
          { name: 'X-Baz', value: 'qux', enabled: true },
        ],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { operation: 'set', header: 'X-Foo', value: 'bar' },
          { operation: 'set', header: 'X-Baz', value: 'qux' },
        ],
      },
      condition: {
        resourceTypes: RESOURCE_TYPES,
        regexFilter: 'https://example\\.com/.*',
      },
    });
  });

  it('generates a response header rule', async () => {
    const profiles = [
      makeProfile({
        responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*', enabled: true }],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ operation: 'set', header: 'Access-Control-Allow-Origin', value: '*' }],
      },
    });
  });

  it('adds initiatorDomains for limitToLocalHost on response headers', async () => {
    const profiles = [
      makeProfile({
        limitToLocalHost: true,
        responseHeaders: [{ name: 'X-Frame-Options', value: 'ALLOW', enabled: true }],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules[0].condition.initiatorDomains).toEqual(['localhost']);
  });

  it('does NOT add initiatorDomains for request headers even with limitToLocalHost', async () => {
    const profiles = [
      makeProfile({
        limitToLocalHost: true,
        requestHeaders: [{ name: 'X-Foo', value: 'bar', enabled: true }],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules[0].condition.initiatorDomains).toBeUndefined();
  });

  it('skips disabled headers', async () => {
    const profiles = [
      makeProfile({
        requestHeaders: [
          { name: 'X-Enabled', value: 'yes', enabled: true },
          { name: 'X-Disabled', value: 'no', enabled: false },
        ],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules).toHaveLength(1);
    expect(rules[0].action.requestHeaders).toHaveLength(1);
    expect(rules[0].action.requestHeaders[0].header).toBe('X-Enabled');
  });

  it('skips headers with empty name or value', async () => {
    const profiles = [
      makeProfile({
        requestHeaders: [
          { name: '', value: 'bar', enabled: true },
          { name: 'X-Foo', value: '', enabled: true },
          { name: '  ', value: 'bar', enabled: true },
          { name: 'X-Foo', value: '  ', enabled: true },
          { name: 'X-Valid', value: 'valid', enabled: true },
        ],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules).toHaveLength(1);
    expect(rules[0].action.requestHeaders).toHaveLength(1);
    expect(rules[0].action.requestHeaders[0].header).toBe('X-Valid');
  });

  it('generates separate rules for request and response headers', async () => {
    const profiles = [
      makeProfile({
        requestHeaders: [{ name: 'X-Req', value: 'req', enabled: true }],
        responseHeaders: [{ name: 'X-Res', value: 'res', enabled: true }],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules).toHaveLength(2);
    expect(rules[0].id).toBe(1);
    expect(rules[0].action.requestHeaders).toBeDefined();
    expect(rules[1].id).toBe(2);
    expect(rules[1].action.responseHeaders).toBeDefined();
  });

  it('generates no rules for a profile with only disabled/empty headers', async () => {
    const profiles = [
      makeProfile({
        requestHeaders: [{ name: '', value: '', enabled: true }],
        responseHeaders: [{ name: 'X-Foo', value: 'bar', enabled: false }],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules).toEqual([]);
  });

  it('assigns incrementing rule IDs across multiple profiles', async () => {
    const profiles = [
      makeProfile({
        id: 'p1',
        requestHeaders: [{ name: 'X-A', value: 'a', enabled: true }],
        responseHeaders: [{ name: 'X-B', value: 'b', enabled: true }],
      }),
      makeProfile({
        id: 'p2',
        requestHeaders: [{ name: 'X-C', value: 'c', enabled: true }],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules).toHaveLength(3);
    expect(rules[0].id).toBe(1);
    expect(rules[1].id).toBe(2);
    expect(rules[2].id).toBe(3);
  });

  it('trims header names and values', async () => {
    const profiles = [
      makeProfile({
        requestHeaders: [{ name: '  X-Foo  ', value: '  bar  ', enabled: true }],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules[0].action.requestHeaders[0]).toMatchObject({
      header: 'X-Foo',
      value: 'bar',
    });
  });

  it('trims urlRegexFilter', async () => {
    const profiles = [
      makeProfile({
        urlRegexFilter: '  https://example\\.com/.*  ',
        requestHeaders: [{ name: 'X-Foo', value: 'bar', enabled: true }],
      }),
    ];

    const rules = await getRulesToAdd(profiles);
    expect(rules[0].condition.regexFilter).toBe('https://example\\.com/.*');
  });
});

// ─── isFirefox ───────────────────────────────────────────────────────

describe('isFirefox', () => {
  it('is false for Chrome user agent', () => {
    expect(isFirefox).toBe(false);
  });
});
