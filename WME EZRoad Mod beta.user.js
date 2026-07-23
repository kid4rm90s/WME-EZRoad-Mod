// ==UserScript==
// @name         WME EZRoad Mod Beta
// @namespace    https://greasyfork.org/users/1087400
// @version      2.7.1.1
// @description  Easily update roads
// @author       https://greasyfork.org/en/users/1087400-kid4rm90s
// @include 	   /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @exclude      https://www.waze.com/user/*editor/*
// @exclude      https://www.waze.com/*/user/*editor/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        unsafeWindow
// @icon         https://www.google.com/s2/favicons?sz=64&domain=waze.com
// @license      GNU GPL(v3)
// @connect      greasyfork.org
// @connect      githubusercontent.com
// @require      https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js
// @require      https://greasyfork.org/scripts/560385/code/WazeToastr.js
// @require https://cdn.jsdelivr.net/gh/TheEditorX/wme-sdk-plus@latest/wme-sdk-plus.js
// @downloadURL https://raw.githubusercontent.com/kid4rm90s/WME-EZRoad-Mod/main/WME%20EZRoad%20Mod%20beta.user.js
// @updateURL https://raw.githubusercontent.com/kid4rm90s/WME-EZRoad-Mod/main/WME%20EZRoad%20Mod%20beta.user.js

// ==/UserScript==

/*Script modified from WME EZRoad (https://greasyfork.org/en/scripts/518381-wme-ezsegments) original author: Michaelrosstarr and thanks to him*/
/*For the toggling U-turns feature, code is adapted from WME Switch Uturns (https://greasyfork.org/en/scripts/457553-wme-switch-uturns) original authors: ixxvivxxi, uranik, turbopirate, AntonShevchuk and thanks to them*/
/*For the segment connection validation logic, approach adapted from WME Validator (https://greasyfork.org/en/scripts/1571-wme-validator) — checks 107/108 'Node A/B: No connection (slow)' — thanks to the validator team*/

(function main() {
  ('use strict');
  const updateMessage = `<strong>Version 2.7.1.1 - 2026-07-23:</strong><br>
    - Migrated legacy keyboard shortcuts to sdk<br>
    - Minor bug fixes and stability improvements<br>`;
  const scriptName = GM_info.script.name;
  const scriptVersion = GM_info.script.version;
  const downloadUrl = 'https://raw.githubusercontent.com/kid4rm90s/WME-EZRoad-Mod/main/WME%20EZRoad%20Mod%20beta.user.js';
  const forumURL = 'https://greasyfork.org/scripts/528552-wme-ezroad-mod/feedback';
  let wmeSDK;
  let roadTypeLocalizedNames = {};
  
  const roadTypes = [
    { id: 1, name: 'Motorway', value: 3 },
    { id: 2, name: 'Ramp', value: 4 },
    { id: 3, name: 'Major Highway', value: 6 },
    { id: 4, name: 'Minor Highway', value: 7 },
    { id: 5, name: 'Primary Street', value: 2 },
    { id: 6, name: 'Street', value: 1 },
    { id: 7, name: 'Narrow Street', value: 22 },
    { id: 8, name: 'Offroad', value: 8 },
    { id: 9, name: 'Parking Road', value: 20 },
    { id: 10, name: 'Private Road', value: 17 },
    { id: 11, name: 'Ferry', value: 15 },
    { id: 12, name: 'Railway', value: 18 },
    { id: 13, name: 'Runway', value: 19 },
    { id: 14, name: 'Foothpath', value: 5 },
    { id: 15, name: 'Pedestrianised Area', value: 10 },
    { id: 16, name: 'Stairway', value: 16 },
  ];
  const defaultOptions = {
    roadType: 1,
    unpaved: false,
    setStreet: false,
    setStreetCity: false,
    setStreetState: false,
    autosave: false,
    setSpeed: 40,
    setLock: false,
    updateSpeed: false,
    copySegmentName: false,
    locks: roadTypes.map((roadType) => ({ id: roadType.id, lock: String(1) })),
    speeds: roadTypes.map((roadType) => ({ id: roadType.id, speed: 40 })),
    copySegmentAttributes: false,
    showSegmentLength: false,
    checkGeometryIssues: false,
    geometryIssueThreshold: 2,
    validateNodeConnection: false,
    connectionCheckRadius: 5,
    enableUTurn: false,
    restrictExceptMotorbike: false,
    updateLanes: false,
    sdkShortcuts: {},
  };

  const locks = [
    { id: 1, value: '1' },
    { id: 2, value: '2' },
    { id: 3, value: '3' },
    { id: 4, value: '4' },
    { id: 5, value: '5' },
    { id: 6, value: '6' },
    { id: 'HRCS', value: 'HRCS' },
  ];

  const UserRankRequiredForGeometryFix = 3; // Minimum user rank required to use the geometry fix feature - only show for L3 and above (rank >= 2 in SDK)

// Prefer the SDK's localized road type name (respects the editor's language setting),
// falling back to our hardcoded label if the lookup isn't available for some reason.
  const roadTypeName = (roadType) => roadTypeLocalizedNames[roadType.value] || roadType.name;

  const log = (message) => {
    if (typeof message === 'string') {
      console.log(`$${scriptName}: ` + message);
    } else {
      console.log(`$${scriptName}: `, message);
    }
  };

  // ===== WME SDK SHORTCUT FORMAT CONVERTERS (PIE-style) =====
  const _KEYCODE_TO_CHAR = {
    65:'A',66:'B',67:'C',68:'D',69:'E',70:'F',71:'G',72:'H',73:'I',74:'J',75:'K',76:'L',
    77:'M',78:'N',79:'O',80:'P',81:'Q',82:'R',83:'S',84:'T',85:'U',86:'V',87:'W',88:'X',
    89:'Y',90:'Z',
    48:'0',49:'1',50:'2',51:'3',52:'4',53:'5',54:'6',55:'7',56:'8',57:'9',
    112:'F1',113:'F2',114:'F3',115:'F4',116:'F5',117:'F6',
    118:'F7',119:'F8',120:'F9',121:'F10',122:'F11',123:'F12',
    32:'Space',13:'Enter',9:'Tab',27:'Esc',8:'Backspace',46:'Delete',
    36:'Home',35:'End',33:'PageUp',34:'PageDown',45:'Insert',
    37:'\u2190',38:'\u2191',39:'\u2192',40:'\u2193',
    188:',',190:'.',191:'/',186:';',222:"'",219:'[',221:']',220:'\\',189:'-',187:'=',192:'',
  };

  const _CHAR_TO_KEYCODE = Object.fromEntries(
    Object.entries(_KEYCODE_TO_CHAR).map(([code, char]) => [char.toUpperCase(), Number(code)])
  );

  const _MOD_CHAR_TO_VAL = { C: 1, S: 2, A: 4 };

  function _comboToRaw(str) {
    if (!str || str === '' || str === '-1' || str === 'None') return null;
    if (/^\d+,-?\d+$/.test(str)) {
      const keyCode = parseInt(str.split(',')[1], 10);
      return keyCode < 0 ? null : str;
    }
    const upperStr = String(str).toUpperCase();
    if (/^[A-Z0-9]$/.test(upperStr)) return '0,' + upperStr.charCodeAt(0);
    if (_CHAR_TO_KEYCODE[upperStr] !== undefined) return '0,' + _CHAR_TO_KEYCODE[upperStr];

    const letterMatch = upperStr.match(/^([ACS]+)\+([A-Z0-9])$/);
    if (letterMatch) {
      const modValue = letterMatch[1].split('').reduce((acc, char) => acc | (_MOD_CHAR_TO_VAL[char] || 0), 0);
      return modValue + ',' + letterMatch[2].charCodeAt(0);
    }
    const numericMatch = upperStr.match(/^([ACS]+)\+(\d+)$/);
    if (numericMatch) {
      const modValue = numericMatch[1].split('').reduce((acc, char) => acc | (_MOD_CHAR_TO_VAL[char] || 0), 0);
      return modValue + ',' + numericMatch[2];
    }
    const specialMatch = upperStr.match(/^([ACS]+)\+(.+)$/);
    if (specialMatch && _CHAR_TO_KEYCODE[specialMatch[2]] !== undefined) {
      const modValue = specialMatch[1].split('').reduce((acc, char) => acc | (_MOD_CHAR_TO_VAL[char] || 0), 0);
      return modValue + ',' + _CHAR_TO_KEYCODE[specialMatch[2]];
    }
    return null;
  }

  function _rawToCombo(str) {
    const raw = _comboToRaw(str);
    if (!raw) return null;
    const parts = raw.split(',');
    const modValue = parseInt(parts[0], 10);
    const keyCode = parseInt(parts[1], 10);
    const keyChar = _KEYCODE_TO_CHAR[keyCode] || String(keyCode);
    let modifiers = '';
    if (modValue & 1) modifiers += 'C';
    if (modValue & 2) modifiers += 'S';
    if (modValue & 4) modifiers += 'A';
    return modifiers ? modifiers + '+' + keyChar : keyChar;
  }

  function _normalizeShortcut(value) {
    const src = value && typeof value === 'object' ? (value.raw ?? value.combo) : value;
    const raw = _comboToRaw(src);
    const combo = _rawToCombo(raw);
    return { raw: raw, combo: combo };
  }

  // ===== LEGACY ACTION ID → SDK SETTINGSKEY MAPPING (for firstCall migration) =====
  const _LEGACY_ACTION_TO_SETTINGSKEY = {
    'WME_EZRoad_Mod_SetStreetNameToNone': 'setStreet',
    'WME_EZRoad_Mod_SetCityAsNone': 'setStreetCity',
    'WME_EZRoad_Mod_AutosaveOnAction': 'autosave',
    'WME_EZRoad_Mod_SetAsUnpaved': 'unpaved',
    'WME_EZRoad_Mod_SetLockLevel': 'setLock',
    'WME_EZRoad_Mod_UpdateSpeedLimits': 'updateSpeed',
    'WME_EZRoad_Mod_EnableUTurn': 'enableUTurn',
    'WME_EZRoad_Mod_AllowNodeUturns': 'AllowNodeUturns',
    'WME_EZRoad_Mod_DisallowNodeUturns': 'DisallowNodeUturns',
    'WME_EZRoad_Mod_ToggleSegmentUturnA': 'ToggleSegmentUturnA',
    'WME_EZRoad_Mod_ToggleSegmentUturnB': 'ToggleSegmentUturnB',
    'WME_EZRoad_Mod_CopyConnectedSegmentName': 'copySegmentName',
    'WME_EZRoad_Mod_CopyConnectedSegmentAttribute': 'copySegmentAttributes',
    'WME_EZRoad_Mod_ShowSegmentLength': 'showSegmentLength',
    'WME_EZRoad_Mod_CheckGeometryIssues': 'checkGeometryIssues',
    'WME_EZRoad_Mod_RestrictMotorbikesOnly': 'restrictExceptMotorbike',
    'WME_EZRoad_Mod_SplitSegment': 'SplitSegment',
    'WME_EZRoad_Mod_UpdateLaneCount': 'updateLanes',
    'WME_EZRoad_Mod_validateNodeConnection': 'validateNodeConnection',
  };

  // ===== SDK SHORTCUT DEFINITIONS (data-driven, no hardcoded keys) =====
  let _sdkShortcutDefs = null; // Built in initScript after roadTypeName is fully ready

  function buildSDKShortcutDefs() {
    const defs = [];
    // Road type selection shortcuts
    roadTypes.forEach(function(rt) {
      defs.push({
        id: 'EZRoad_Mod_SelectRoadType_' + rt.id,
        description: 'Selected road type - ' + roadTypeName(rt),
        settingsKey: 'RT_' + rt.id,
        callback: function() {
          var opts = getOptions();
          opts.roadType = rt.value;
          saveOptions(opts);
          $('input[name=\"defaultRoad\"]').each(function() {
            if (parseInt($(this).attr('data-road-value'), 10) === rt.value) {
              $(this).prop('checked', true);
            } else {
              $(this).prop('checked', false);
            }
          });
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(scriptName, 'Selected road type: <b>' + roadTypeName(rt) + '</b>', false, false, 1500);
          }
        },
      });
    });
    // Quick Update shortcut
    defs.push({
      id: 'EZRoad_Mod_QuickUpdate',
      description: 'Quick Update Segments',
      settingsKey: 'QuickUpdate',
      callback: handleUpdate,
    });
    // Motorcycle restriction shortcut
    defs.push({
      id: 'EZRoad_Mod_MotorcycleOnlyRestriction',
      description: 'Apply Motorbike-Only Restriction',
      settingsKey: 'MotorcycleOnly',
      callback: function() {
        var selection = wmeSDK.Editing.getSelection();
        if (!selection || selection.objectType !== 'segment' || !selection.ids || selection.ids.length === 0) {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, 'Please select one or more segments first', false, false, 3000);
          }
          return;
        }
        applyMotorbikeOnlyRestriction(selection.ids[0]).then(function(result) {
          if (result === true) {
            if (WazeToastr?.Alerts) {
              WazeToastr.Alerts.success(scriptName, 'Motorbike-only restriction applied to ' + selection.ids.length + ' segment(s) \u2713', false, false, 3000);
            }
          } else if (result === 'not_supported') {
            if (WazeToastr?.Alerts) {
              WazeToastr.Alerts.warning(scriptName, 'Segment not found or is pedestrian type, cannot apply motorbike restriction', false, false, 5000);
            }
          } else if (result === 'not_supported type') {
            log(scriptName + ' Segment not supported type, cannot apply motorbike restriction');
          }
        }).catch(function(error) {
          console.error(scriptName + ' Error applying motorbike restriction:', error);
        });
      },
    });
    // Split segment shortcut
    defs.push({
      id: 'EZRoad_Mod_SplitSegment',
      description: 'Split Segment Mode',
      settingsKey: 'SplitSegment',
      callback: toggleSplitMode,
    });
    // ===== FEATURE-TOGGLE SHORTCUTS (migrated from legacy W.accelerators) =====
    defs.push({
      id: 'EZRoad_Mod_SetStreetToNone',
      description: 'Set Street Name to None',
      settingsKey: 'setStreet',
      callback: function() { handleToggle('setStreet', 'Set Street Name to None'); },
    });
    defs.push({
      id: 'EZRoad_Mod_SetCityAsNone',
      description: 'Set City as None',
      settingsKey: 'setStreetCity',
      callback: function() { handleToggle('setStreetCity', 'Set City as None'); },
    });
    defs.push({
      id: 'EZRoad_Mod_AutosaveOnAction',
      description: 'Autosave on Action',
      settingsKey: 'autosave',
      callback: function() { handleToggle('autosave', 'Autosave on Action'); },
    });
    defs.push({
      id: 'EZRoad_Mod_SetAsUnpaved',
      description: 'Set as Unpaved',
      settingsKey: 'unpaved',
      callback: function() { handleToggle('unpaved', 'Set as Unpaved'); },
    });
    defs.push({
      id: 'EZRoad_Mod_SetLockLevel',
      description: 'Set Lock Level',
      settingsKey: 'setLock',
      callback: function() { handleToggle('setLock', 'Set Lock Level'); },
    });
    defs.push({
      id: 'EZRoad_Mod_UpdateSpeedLimits',
      description: 'Update Speed Limits',
      settingsKey: 'updateSpeed',
      callback: function() { handleToggle('updateSpeed', 'Update Speed Limits'); },
    });
    defs.push({
      id: 'EZRoad_Mod_EnableUTurn',
      description: 'Enable U-Turn',
      settingsKey: 'enableUTurn',
      callback: function() { handleToggle('enableUTurn', 'Enable U-Turn'); },
    });
    defs.push({
      id: 'EZRoad_Mod_AllowNodeUturns',
      description: 'Allow All U-Turns at Node',
      settingsKey: 'AllowNodeUturns',
      callback: function() {
        const selection = wmeSDK.Editing.getSelection();
        if (selection && selection.objectType === 'node' && selection.ids && selection.ids.length > 0) {
          const result = switchNodeUturn(selection.ids[0], true);
          if (result.success && WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(scriptName, result.message, false, false, 3000);
          } else if (!result.success && WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, result.message, false, false, 3000);
          }
        } else {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, 'Please select a node', false, false, 3000);
          }
        }
      },
    });
    defs.push({
      id: 'EZRoad_Mod_DisallowNodeUturns',
      description: 'Disallow All U-Turns at Node',
      settingsKey: 'DisallowNodeUturns',
      callback: function() {
        const selection = wmeSDK.Editing.getSelection();
        if (selection && selection.objectType === 'node' && selection.ids && selection.ids.length > 0) {
          const result = switchNodeUturn(selection.ids[0], false);
          if (result.success && WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(scriptName, result.message, false, false, 3000);
          } else if (!result.success && WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, result.message, false, false, 3000);
          }
        } else {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, 'Please select a node', false, false, 3000);
          }
        }
      },
    });
    defs.push({
      id: 'EZRoad_Mod_ToggleSegmentUturnA',
      description: 'Toggle U-Turn at Segment Direction A',
      settingsKey: 'ToggleSegmentUturnA',
      callback: function() {
        const selection = wmeSDK.Editing.getSelection();
        if (selection && selection.objectType === 'segment' && selection.ids && selection.ids.length > 0) {
          const result = switchSegmentUturn(selection.ids[0], 'A');
          if (result.success && WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(scriptName, result.message, false, false, 3000);
          } else if (!result.success && WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, result.message, false, false, 3000);
          }
        } else {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, 'Please select a segment', false, false, 3000);
          }
        }
      },
    });
    defs.push({
      id: 'EZRoad_Mod_ToggleSegmentUturnB',
      description: 'Toggle U-Turn at Segment Direction B',
      settingsKey: 'ToggleSegmentUturnB',
      callback: function() {
        const selection = wmeSDK.Editing.getSelection();
        if (selection && selection.objectType === 'segment' && selection.ids && selection.ids.length > 0) {
          const result = switchSegmentUturn(selection.ids[0], 'B');
          if (result.success && WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(scriptName, result.message, false, false, 3000);
          } else if (!result.success && WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, result.message, false, false, 3000);
          }
        } else {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(scriptName, 'Please select a segment', false, false, 3000);
          }
        }
      },
    });
    defs.push({
      id: 'EZRoad_Mod_CopyConnectedSegmentName',
      description: 'Copy Connected Segment Name',
      settingsKey: 'copySegmentName',
      callback: function() { handleToggle('copySegmentName', 'Copy Connected Segment Name'); },
    });
    defs.push({
      id: 'EZRoad_Mod_CopyConnectedSegmentAttribute',
      description: 'Copy Connected Segment Attribute',
      settingsKey: 'copySegmentAttributes',
      callback: function() { handleToggle('copySegmentAttributes', 'Copy Connected Segment Attribute'); },
    });
    defs.push({
      id: 'EZRoad_Mod_ShowSegmentLength',
      description: 'Show Segment Length <=20m',
      settingsKey: 'showSegmentLength',
      callback: function() { handleToggle('showSegmentLength', 'Show Segment Length <=20m'); },
    });
    defs.push({
      id: 'EZRoad_Mod_CheckGeometryIssues',
      description: 'Check Geometry Issues',
      settingsKey: 'checkGeometryIssues',
      callback: function() { handleToggle('checkGeometryIssues', 'Check Geometry Issues'); },
    });
    defs.push({
      id: 'EZRoad_Mod_RestrictMotorbikesOnly',
      description: 'Toggle Restrict Except Motorbike',
      settingsKey: 'restrictExceptMotorbike',
      callback: function() { handleToggle('restrictExceptMotorbike', 'Restrict Except Motorbike'); },
    });
    defs.push({
      id: 'EZRoad_Mod_UpdateLaneCount',
      description: 'Enable Road Width (No of Lanes) buttons',
      settingsKey: 'updateLanes',
      callback: function() { handleToggle('updateLanes', 'Enable Road Width (No of Lanes) buttons'); },
    });
    defs.push({
      id: 'EZRoad_Mod_ValidateNodeConnection',
      description: 'Validate Node Connection',
      settingsKey: 'validateNodeConnection',
      callback: function() { handleToggle('validateNodeConnection', 'Validate Node Connection'); },
    });
    return defs;
  }

  unsafeWindow.SDK_INITIALIZED.then(initScript);

  function initScript() {
    wmeSDK = getWmeSdk({
      scriptId: 'wme-ez-roads-mod',
      scriptName: 'EZ Roads Mod',
    });
      try {
        wmeSDK.DataModel.Segments.getRoadTypes().forEach(rt => {
            roadTypeLocalizedNames[rt.id] = rt.localizedName || rt.name;
        });
    } catch (e) {
        log(`Could not load localized road type names: ${e}`);
    }

    // Build SDK shortcut definitions (after roadTypeLocalizedNames is ready)
    _sdkShortcutDefs = buildSDKShortcutDefs();

    // Migrate old shortcutKey to new sdkShortcuts format
    const currentOpts = getOptions();
    if (currentOpts.sdkShortcuts && !currentOpts.sdkShortcuts.QuickUpdate && currentOpts.shortcutKey) {
      currentOpts.sdkShortcuts.QuickUpdate = _normalizeShortcut(currentOpts.shortcutKey);
      delete currentOpts.shortcutKey;
      saveOptions(currentOpts);
    }

    // ===== firstCall: Migrate legacy W.accelerators shortcut keys to SDK sdkShortcuts =====
    // Reads localStorage[scriptName + 'KBS'] (array of { shortcutString: actionId }),
    // maps each legacy action ID to the SDK settingsKey, and stores the normalized key.
    // Runs only once per page load; deletes legacy key afterward.
    (function migrateLegacyShortcuts() {
      const legacyKey = scriptName + 'KBS';
      var legacyRaw;
      try {
        legacyRaw = JSON.parse(localStorage.getItem(legacyKey));
        if (!Array.isArray(legacyRaw)) return;
      } catch (e) {
        return; // No legacy data or parse error — skip
      }

      var opts = getOptions();
      if (!opts.sdkShortcuts) opts.sdkShortcuts = {};
      var migrated = false;

      for (var i = 0; i < legacyRaw.length; i++) {
        var entry = legacyRaw[i];
        // Each entry is { shortcutString: actionId }
        var keys = Object.keys(entry);
        if (keys.length === 0) continue;
        var shortcutString = keys[0]; // e.g. "A+82" or "-1"
        var actionId = entry[shortcutString];
        var settingsKey = _LEGACY_ACTION_TO_SETTINGSKEY[actionId];
        if (!settingsKey) continue; // Unknown action — skip

        // Skip entries with no key assigned ("-1" or null)
        if (!shortcutString || shortcutString === '-1' || shortcutString === 'None') continue;

        // Skip if this settingsKey already has a non-null combo in new format
        if (opts.sdkShortcuts[settingsKey] && opts.sdkShortcuts[settingsKey].combo !== null) continue;

        opts.sdkShortcuts[settingsKey] = _normalizeShortcut(shortcutString);
        migrated = true;
        log(`Migrated legacy shortcut "${actionId}" (${shortcutString}) → ${settingsKey}: ${opts.sdkShortcuts[settingsKey].combo}`);
      }

      if (migrated) {
        saveOptions(opts);
        localStorage.removeItem(legacyKey);
        log(`Legacy shortcut migration complete. Removed legacy key "${legacyKey}".`);
      }
    })();

    // Register the shortcut group in WME's Keyboard Shortcuts dialog
    try {
      if (wmeSDK.Shortcuts && wmeSDK.Shortcuts.addShortcutGroup) {
        var groups = wmeSDK.Shortcuts.getAllShortcutGroups();
        var groupExists = groups && groups.some(function(g) { return g.groupName === 'EZRoad Mod - Feature Toggles'; });
        if (!groupExists) {
          wmeSDK.Shortcuts.addShortcutGroup({ groupName: 'EZRoad Mod - Feature Toggles' });
          log('Registered shortcut group: EZRoad Mod - Feature Toggles');
        }
      }
    } catch (e) {
      log('Could not register shortcut group: ' + e);
    }

      WME_EZRoads_Mod_bootstrap();
  }

  const getCurrentCountry = () => {
    return wmeSDK.DataModel.Countries.getTopCountry();
  };

  const getTopCity = () => {
    return wmeSDK.DataModel.Cities.getTopCity();
  };

  const getAllCities = () => {
    return wmeSDK.DataModel.Cities.getAll();
  };

  // --- NEW: Helper to get all connected segment IDs ---
  function getConnectedSegmentIDs(segmentId) {
    // Returns unique IDs of all segments connected to the given segment
    const segs = [...wmeSDK.DataModel.Segments.getConnectedSegments({ segmentId, reverseDirection: false }), ...wmeSDK.DataModel.Segments.getConnectedSegments({ segmentId, reverseDirection: true })];
    const ids = segs.map((segment) => segment.id);
    // Remove duplicates
    return [...new Set(ids)];
  }

  // --- NEW: Helper to get the first connected segment's address (recursively) ---
  function getFirstConnectedSegmentAddress(segmentId) {
    const nonMatches = [];
    const segmentIDsToSearch = [segmentId];
    const hasValidCity = (id) => {
      try {
        const addr = wmeSDK.DataModel.Segments.getAddress({ segmentId: id });
        // Check if address has a city and the city is not empty
        if (addr && addr.city && addr.city.id) {
          const city = wmeSDK.DataModel.Cities.getById({ cityId: addr.city.id });
          // Ensure city object is fully loaded with name property
          return city && !city.isEmpty && city.name !== undefined;
        }
      } catch (e) {
        log(`Error checking city for segment ${id}: ${e}`);
      }
      return false;
    };
    while (segmentIDsToSearch.length > 0) {
      const startSegmentID = segmentIDsToSearch.pop();
      const connectedSegmentIDs = getConnectedSegmentIDs(startSegmentID);
      log(`Checking connected segments for segment ${startSegmentID}: ${connectedSegmentIDs.join(', ')}`);

      const hasValidCitySegmentId = connectedSegmentIDs.find(hasValidCity);
      if (hasValidCitySegmentId) {
        const addr = wmeSDK.DataModel.Segments.getAddress({ segmentId: hasValidCitySegmentId });
        log(`Found valid city in connected segment ${hasValidCitySegmentId}`);
        return addr;
      }
      nonMatches.push(startSegmentID);
      connectedSegmentIDs.forEach((segmentID) => {
        if (!nonMatches.includes(segmentID) && !segmentIDsToSearch.includes(segmentID)) {
          segmentIDsToSearch.push(segmentID);
        }
      });
    }
    log('No valid city found in any connected segments');
    return null;
  }

  // --- Helper to get the direction value from a segment for copying ---
  function getDirectionFromSegment(segment) {
    if (!segment) return null;
    if (segment.isTwoWay) return 'TWO_WAY';
    if (segment.isAtoB) return 'A_TO_B';
    if (segment.isBtoA) return 'B_TO_A';
    return null;
  }

  // --- Helper to copy all flag attributes from one segment to another ---
  function copyFlagAttributes(fromSegmentId, toSegmentId) {
    const fromSeg = wmeSDK.DataModel.Segments.getById({ segmentId: fromSegmentId });
    const toSeg = wmeSDK.DataModel.Segments.getById({ segmentId: toSegmentId });

    if (!fromSeg || !toSeg || !fromSeg.flagAttributes) {
      return;
    }

    try {
      // Use WME SDK updateSegment to copy unpaved flag attribute
      const fromUnpavedValue = fromSeg.flagAttributes.unpaved === true;
      const toUnpavedValue = toSeg.flagAttributes && toSeg.flagAttributes.unpaved === true;

      // Only update if values differ
      if (fromUnpavedValue !== toUnpavedValue) {
        wmeSDK.DataModel.Segments.updateSegment({
          segmentId: toSegmentId,
          flagAttributes: {
            unpaved: fromUnpavedValue
          }
        });
        log(`Copied flag attribute unpaved=${fromUnpavedValue} via SDK from segment ${fromSegmentId} to ${toSegmentId}`);
      } else {
        log(`Flag attribute unpaved already matches (${fromUnpavedValue}) between segments`);
      }
    } catch (e) {
      log(`Error copying flag attributes via SDK: ${e}`);
    }
  }

  // --- NEW: Helper to apply motorbike-only restrictions to a segment via UI automation ---
  function applyMotorbikeOnlyRestriction(segmentId) {
    /**
     * Applies vehicle restrictions to allow only motorbikes on a segment.
     * Uses DOM manipulation to automate the WME UI since the SDK doesn't support this yet.
     */
    return new Promise((resolve) => {
      try {
        const segment = wmeSDK.DataModel.Segments.getById({ segmentId });
        if (!segment || isNonDrivableType(segment.roadType)) {
          const roadTypeName = segment ? roadTypes.find(rt => rt.value === segment.roadType)?.name || 'Unknown' : 'N/A';
          log(`Segment ${segmentId} not found or pedestrian type ${roadTypeName} (${segment?.roadType || 'N/A'}), cannot apply motorbike restriction`);
          WazeToastr.Alerts.warning(`${scriptName}`, `Segment not found or "${roadTypeName}" is not supported type, cannot apply motorbike restriction`, false, false, 5000);
          resolve('not_supported type');
          return;
        }

        log(`Applying motorbike-only restriction to segment ${segmentId} via UI automation`);

        /* ===== WME SDK APPROACH (NOT YET SUPPORTED - COMMENTED OUT FOR FUTURE USE) =====
        // Get SDK constants - try different possible locations
        const RESTRICTION_TYPE = wmeSDK.RESTRICTION_TYPE || wmeSDK.Constants?.RESTRICTION_TYPE || {
          FREE: 'FREE',
          BLOCKED: 'BLOCKED',
          DIFFICULT: 'DIFFICULT',
          TOLL: 'TOLL'
        };

        const VEHICLE_TYPE = wmeSDK.VEHICLE_TYPE || wmeSDK.Constants?.VEHICLE_TYPE || {
          MOTORCYCLE: 'MOTORCYCLE',
          CAR: 'CAR',
          TAXI: 'TAXI',
          BUSES: 'BUSES',
          TRUCKS: 'TRUCKS',
          SCOOTERS: 'SCOOTERS'
        };

        // Create motorcycle-only restriction using SDK constants and structure
        // Only motorcycles are allowed (FREE restriction), all other vehicles are BLOCKED
        const motorcycleOnlyRestriction = {
          driveProfiles: {
            // FREE: Only motorcycles can pass freely
            [RESTRICTION_TYPE.FREE]: [
              {
                vehicleTypes: [VEHICLE_TYPE.MOTORCYCLE],
                licensePlateNumber: '',
                numPassengers: 0,
                subscriptions: [],
              },
            ],
            // BLOCKED: All other vehicle types are blocked
            [RESTRICTION_TYPE.BLOCKED]: [
              {
                vehicleTypes: [
                  VEHICLE_TYPE.CAR,
                  VEHICLE_TYPE.TAXI,
                  VEHICLE_TYPE.BUSES,
                  VEHICLE_TYPE.TRUCKS,
                  VEHICLE_TYPE.SCOOTERS,
                ],
                licensePlateNumber: '',
                numPassengers: 0,
                subscriptions: [],
              },
            ],
            [RESTRICTION_TYPE.DIFFICULT]: [],
            [RESTRICTION_TYPE.TOLL]: [],
          },
          isExpired: false,
        };

        // Try applying via SDK (currently not working)
        // Method 1: Try Segments.addRestriction
        if (wmeSDK.DataModel.Segments.addRestriction) {
          wmeSDK.DataModel.Segments.addRestriction({
            segmentId,
            restriction: motorcycleOnlyRestriction,
          });
        }
        
        // Method 2: Try Segments.addSegmentRestriction
        if (wmeSDK.DataModel.Segments.addSegmentRestriction) {
          wmeSDK.DataModel.Segments.addSegmentRestriction({
            segmentId,
            restriction: motorcycleOnlyRestriction,
          });
        }
        
        // Method 3: Try updateSegment with restrictions array
        const currentRestrictions = segment.restrictions || [];
        wmeSDK.DataModel.Segments.updateSegment({
          segmentId,
          restrictions: [...currentRestrictions, motorcycleOnlyRestriction],
        });
        
        // Method 4: Try SegmentRestrictions API if it exists
        if (wmeSDK.DataModel.SegmentRestrictions?.addRestriction) {
          wmeSDK.DataModel.SegmentRestrictions.addRestriction({
            segmentId,
            restriction: motorcycleOnlyRestriction,
            direction: 'BOTH',
          });
        }
        ===== END WME SDK APPROACH ===== */

        // Helper function to wait for element
        const waitForElement = (selector, timeout = 5000) => {
          return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
              const element = document.querySelector(selector);
              if (element) {
                clearInterval(checkInterval);
                resolve(element);
              } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                reject(new Error(`Timeout waiting for element: ${selector}`));
              }
            }, 100);
          });
        };

        // Helper to click element
        const clickElement = (element) => {
          if (element) {
            element.click();
            log(`Clicked: ${element.tagName} ${element.className}`);
            return true;
          }
          return false;
        };

        // Step 1: Click "Add restrictions" button
        setTimeout(() => {
          const addRestrictionsBtn = document.querySelector('wz-button.edit-restrictions');
          if (!addRestrictionsBtn) {
            log('Add restrictions button not found');
            resolve('not_supported');
            return;
          }
          clickElement(addRestrictionsBtn);

          // Step 2: Wait for modal and click "Add new" for bidirectional (2-way)
          setTimeout(() => {
            waitForElement('.bidi-restrictions-summary .do-create')
              .then((addNewBtn) => {
                clickElement(addNewBtn);

                // Step 3: Wait for disposition dropdown and select "Entire Segment" (value="1")
                setTimeout(() => {
                  waitForElement('select[name="disposition"]')
                    .then((dispositionSelect) => {
                      dispositionSelect.value = '1'; // Entire Segment
                      dispositionSelect.dispatchEvent(new Event('change', { bubbles: true }));
                      log('Selected: Entire Segment');

                      // Step 4: Click the plus icon to add restriction type
                      setTimeout(() => {
                        const plusIcon = document.querySelector('.fa-plus');
                        if (plusIcon && clickElement(plusIcon)) {
                          
                          // Step 5: Wait for and click "Vehicle type" option
                          setTimeout(() => {
                            waitForElement('wz-menu-item')
                              .then(() => {
                                const menuItems = document.querySelectorAll('wz-menu-item');
                                let vehicleTypeItem = null;
                                menuItems.forEach(item => {
                                  if (item.textContent.includes('Vehicle type')) {
                                    vehicleTypeItem = item;
                                  }
                                });
                                
                                if (vehicleTypeItem && clickElement(vehicleTypeItem)) {
                                  
                                  // Step 6: Wait for vehicle type dropdown and select Motorcycle
                                  setTimeout(() => {
                                    waitForElement('.do-set-vehicle-type')
                                      .then(() => {
                                        const vehicleOptions = document.querySelectorAll('.do-set-vehicle-type');
                                        let motorcycleOption = null;
                                        vehicleOptions.forEach(option => {
                                          if (option.textContent.toLowerCase().includes('motorcycle')) {
                                            motorcycleOption = option;
                                          }
                                        });

                                        if (motorcycleOption && clickElement(motorcycleOption)) {
                                          log('Selected: Motorcycle');

                                          // Step 7: Click the Add button
                                          setTimeout(() => {
                                            waitForElement('button.do-create')
                                              .then((addBtn) => {
                                                if (clickElement(addBtn)) {
                                                  log('Clicked Add button');

                                                  // Click Apply button to save
                                                  setTimeout(() => {
                                                    const applyBtn = document.querySelector('button.do-apply');
                                                    if (applyBtn && clickElement(applyBtn)) {
                                                      log('Successfully applied motorbike-only restriction via UI automation');
                                                      resolve(true);
                                                    } else {
                                                      log('Apply button not found');
                                                      resolve('not_supported');
                                                    }
                                                  }, 100);
                                                } else {
                                                  resolve('not_supported');
                                                }
                                              })
                                              .catch(err => {
                                                log(`Error finding Add button: ${err}`);
                                                resolve('not_supported');
                                              });
                                          }, 100);
                                        } else {
                                          log('Motorcycle option not found');
                                          resolve('not_supported');
                                        }
                                      })
                                      .catch(err => {
                                        log(`Error finding vehicle options: ${err}`);
                                        resolve('not_supported');
                                      });
                                  }, 100);
                                } else {
                                  log('Vehicle type menu item not found');
                                  resolve('not_supported');
                                }
                              })
                              .catch(err => {
                                log(`Error finding menu items: ${err}`);
                                resolve('not_supported');
                              });
                          }, 100);
                        } else {
                          log('Plus icon not found');
                          resolve('not_supported');
                        }
                      }, 100);
                    })
                    .catch(err => {
                      log(`Error finding disposition dropdown: ${err}`);
                      resolve('not_supported');
                    });
                }, 100);
              })
              .catch(err => {
                log(`Error finding Add new button: ${err}`);
                resolve('not_supported');
              });
          }, 100);
        }, 50);

      } catch (error) {
        log(`Error in applyMotorbikeOnlyRestriction: ${error}`);
        resolve(false);
      }
    });
  }

  const saveOptions = (options) => {
    window.localStorage.setItem('WME_EZRoads_Mod_Options', JSON.stringify(options));
    // Note: We don't clear current preset here, we check for modifications instead
  };

  const getOptions = () => {
    const savedOptions = JSON.parse(window.localStorage.getItem('WME_EZRoads_Mod_Options')) || {};
    // Deep merge for locks and speeds arrays
    const mergeById = (defaults, saved, key) => {
      if (!Array.isArray(defaults)) return defaults;
      if (!Array.isArray(saved)) return defaults;
      return defaults.map((def) => {
        const found = saved.find((s) => s.id === def.id);
        return found ? { ...def, ...found } : def;
      });
    };
    const mergedLocks = mergeById(
      defaultOptions.locks,
      (savedOptions.locks || []).map((l) => ({ ...l, lock: String(l.lock) })),
      'locks'
    );
    const mergedSpeeds = mergeById(defaultOptions.speeds, savedOptions.speeds || [], 'speeds');
    return {
      ...defaultOptions,
      ...savedOptions,
      locks: mergedLocks,
      speeds: mergedSpeeds,
    };
  };

  const saveCustomPreset = (presetName) => {
    const options = getOptions();
    const presets = getCustomPresets();
    presets[presetName] = {
      locks: options.locks,
      speeds: options.speeds,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem('WME_EZRoads_Mod_CustomPresets', JSON.stringify(presets));
    // If we're saving the current preset, it's now in sync
    const currentPreset = getCurrentPresetName();
    if (currentPreset === presetName) {
      setCurrentPresetName(presetName); // Refresh to confirm it's current
    }
    return true;
  };

  const loadCustomPreset = (presetName) => {
    const presets = getCustomPresets();
    if (!presets[presetName]) return false;
    const options = getOptions();
    options.locks = presets[presetName].locks;
    options.speeds = presets[presetName].speeds;
    saveOptions(options);
    setCurrentPresetName(presetName);
    return true;
  };

  const deleteCustomPreset = (presetName) => {
    const presets = getCustomPresets();
    if (!presets[presetName]) return false;
    delete presets[presetName];
    window.localStorage.setItem('WME_EZRoads_Mod_CustomPresets', JSON.stringify(presets));
    // Clear current preset if we're deleting it
    if (getCurrentPresetName() === presetName) {
      setCurrentPresetName(null);
    }
    return true;
  };

  const getCustomPresets = () => {
    const presets = JSON.parse(window.localStorage.getItem('WME_EZRoads_Mod_CustomPresets')) || {};
    return presets;
  };

  const getCurrentPresetName = () => {
    return window.localStorage.getItem('WME_EZRoads_Mod_CurrentPreset') || null;
  };

  const setCurrentPresetName = (presetName) => {
    if (presetName) {
      window.localStorage.setItem('WME_EZRoads_Mod_CurrentPreset', presetName);
    } else {
      window.localStorage.removeItem('WME_EZRoads_Mod_CurrentPreset');
    }
  };

  const isCurrentPresetModified = () => {
    const currentPresetName = getCurrentPresetName();
    if (!currentPresetName) return false;

    const presets = getCustomPresets();
    const preset = presets[currentPresetName];
    if (!preset) {
      setCurrentPresetName(null);
      return false;
    }

    const currentOptions = getOptions();
    // Compare locks and speeds
    const locksMatch = JSON.stringify(currentOptions.locks) === JSON.stringify(preset.locks);
    const speedsMatch = JSON.stringify(currentOptions.speeds) === JSON.stringify(preset.speeds);

    return !(locksMatch && speedsMatch);
  };

  // Helper function to handle toggle logic
  function handleToggle(optionKey, featureName) {
    const options = getOptions();
    options[optionKey] = !options[optionKey];
    saveOptions(options);
    
    // Update checkbox in DOM
    const checkboxId = optionKey;
    const $checkbox = $(`#${checkboxId}`);
    
    if ($checkbox.length > 0) {
      $checkbox.prop('checked', options[optionKey]);
      
      // Trigger the same logic that would be triggered by manual checkbox click
      // Mutually exclusive logic for setStreet and copySegmentName
      if (optionKey === 'setStreet' && options[optionKey]) {
        $('#copySegmentName').prop('checked', false);
        saveOptions({ ...getOptions(), copySegmentName: false });
      }
      if (optionKey === 'copySegmentName' && options[optionKey]) {
        $('#setStreet').prop('checked', false);
        saveOptions({ ...getOptions(), setStreet: false });
      }
      
      // Mutual exclusion logic for copySegmentAttributes
      if (optionKey === 'copySegmentAttributes') {
        if (options[optionKey]) {
          // Uncheck all other checkboxes except autosave, showSegmentLength, checkGeometryIssues, validateNodeConnection, restrictExceptMotorbike
          $('.ezroadsmod-other-checkbox').each(function () {
            $(this).prop('checked', false);
          });
          const newOpts = getOptions();
          newOpts.setStreet = false;
          newOpts.setStreetCity = false;
          newOpts.unpaved = false;
          newOpts.setLock = false;
          newOpts.updateSpeed = false;
          newOpts.enableUTurn = false;
          newOpts.copySegmentName = false;
          newOpts.copySegmentAttributes = true;
          saveOptions(newOpts);
        }
      } else if (optionKey !== 'autosave' && optionKey !== 'showSegmentLength' && optionKey !== 'checkGeometryIssues' && optionKey !== 'validateNodeConnection' && optionKey !== 'restrictExceptMotorbike') {
        // If any other checkbox (except autosave, showSegmentLength, checkGeometryIssues, validateNodeConnection, restrictExceptMotorbike) is checked, uncheck copySegmentAttributes
        if (options[optionKey]) {
          $('#copySegmentAttributes').prop('checked', false);
          const newOpts = getOptions();
          newOpts.copySegmentAttributes = false;
          saveOptions(newOpts);
        }
      }
      
      // Handle Segment Length / Geometry Check / Segment Connection toggle
      if (optionKey === 'showSegmentLength' || optionKey === 'checkGeometryIssues' || optionKey === 'validateNodeConnection' || optionKey === 'copySegmentAttributes') {
        if (typeof handleSegmentLengthToggle === 'function') {
          handleSegmentLengthToggle();
        }
      }
    }
    
    // Show notification
    if (WazeToastr?.Alerts) {
      const status = options[optionKey] ? 'Enabled' : 'Disabled';
      WazeToastr.Alerts.info(`${scriptName}`, `${featureName}: ${status}`, false, false, 2000);
    }
    console.log(`[${scriptName}] [${featureName}] Toggled to: ${options[optionKey]}`);
  }
  
  
  const WME_EZRoads_Mod_bootstrap = () => {
    if (!document.getElementById('edit-panel') || !wmeSDK.DataModel.Countries.getTopCountry()) {
      setTimeout(WME_EZRoads_Mod_bootstrap, 250);
      return;
    }

    if (wmeSDK.State.isReady) {
      WME_EZRoads_Mod_init();
    } else {
      wmeSDK.Events.once({ eventName: 'wme-ready' }).then(WME_EZRoads_Mod_init());
    }
  };

  let openPanel;

  const WME_EZRoads_Mod_init = () => {
    log('Initing');

    // Initialize all WME SDK shortcuts (feature toggles + actions) using unified PIE-style pattern
    // Replaces legacy W.accelerators system for all 30+ shortcuts
    initializeSDKShortcuts();
    // Auto-save SDK shortcut key changes on page unload + polling
    window.addEventListener('beforeunload', checkSDKShortcutsChanged);
    setInterval(checkSDKShortcutsChanged, 5000);

    // All shortcuts (feature toggles + actions) are now registered via initializeSDKShortcuts()
    // using the unified PIE-style pattern. Legacy W.accelerators system has been removed.
    log('All shortcuts initialized via SDK (unified PIE-style pattern)');
    
    // --- ENHANCED: Add event listeners to each road-type chip for direct click handling ---
    // Global flag to suppress attribute copy when chip is clicked
    window.suppressCopySegmentAttributes = false;
    function addRoadTypeChipListeners() {
      const chipSelect = document.querySelector('.road-type-chip-select');
      if (!chipSelect) return;
      const chips = chipSelect.querySelectorAll('wz-checkable-chip');
      chips.forEach((chip) => {
        if (!chip._ezroadmod_listener) {
          chip._ezroadmod_listener = true;
          chip.addEventListener('click', function () {
            // Log every chip click for debugging
            log(`${scriptName} Chip clicked: value=` + chip.getAttribute('value') + ', checked=' + chip.getAttribute('checked'));
            setTimeout(() => {
              // Only act if this chip is now the selected one (checked="")
              if (chip.getAttribute('checked') === '') {
                const rtValue = parseInt(chip.getAttribute('value'), 10);
                log(`${scriptName} Detected chip selection, applying EZRoadMod logic for roadType value: ` + rtValue);
                if (isNaN(rtValue)) return;
                const options = getOptions();
                options.roadType = rtValue;
                saveOptions(options);
                if (typeof updateRoadTypeRadios === 'function') {
                  updateRoadTypeRadios(rtValue);
                }
                const selection = wmeSDK.Editing.getSelection();
                if (selection && selection.objectType === 'segment') {
                  wmeSDK.Editing.setSelection({ selection });
                }
                setTimeout(() => {
                  log(`${scriptName} Calling handleUpdate() after chip click for roadType value: ` + rtValue);
                  window.suppressCopySegmentAttributes = true;
                  Promise.resolve(handleUpdate()).finally(() => {
                    window.suppressCopySegmentAttributes = false;
                  });
                }, 100);
              }
            }, 50);
          });
        }
      });
    }

    // Call after panel is available and after any UI changes that might re-render the chips
    setTimeout(addRoadTypeChipListeners, 1200);
    // Also call after every edit panel mutation to re-attach listeners
    // Observe the edit panel for segment changes and add the quick update button
    const roadObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const addedNode = mutation.addedNodes[i];
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            let editSegment = addedNode.querySelector('#segment-edit-general');
            if (editSegment) {
              openPanel = editSegment;
              const parentElement = editSegment.parentNode;
              if (!parentElement.querySelector('[data-ez-roadmod-button="true"]')) {
                log('Creating Quick Set Road button for this panel');
                const quickButton = document.createElement('wz-button');
                quickButton.setAttribute('type', 'button');
                quickButton.setAttribute('style', 'margin-bottom: 5px; width: 100%');
                quickButton.setAttribute('disabled', 'false');
                quickButton.setAttribute('data-ez-roadmod-button', 'true');
                quickButton.setAttribute('id', 'ez-roadmod-quick-button-' + Date.now()); // Unique ID using timestamp
                quickButton.classList.add('send-button', 'ez-comment-button');
                quickButton.textContent = 'Quick Update Segment';
                parentElement.insertBefore(quickButton, editSegment);
                quickButton.addEventListener('mousedown', () => handleUpdate());
                log('Button created for current panel');
              } else {
                log('This panel already has the button, skipping creation');
              }
              // Always re-attach chip listeners after panel mutation
              addRoadTypeChipListeners();
              // Add lane count buttons if enabled
              addLaneCountButtons();
            }
          }
        }
      });
    });
    roadObserver.observe(document.getElementById('edit-panel'), {
      childList: true,
      subtree: true,
    });

    constructSettings();

    function updateRoadTypeRadios(newValue) {
      $(`input[name="defaultRoad"]`).each(function () {
        if (parseInt($(this).attr('data-road-value'), 10) === newValue) {
          $(this).prop('checked', true);
        } else {
          $(this).prop('checked', false);
        }
      });
    }

    // Initialize segment length display layer
    initSegmentLengthLayer();

    // Inject Dashboard Buttons
    setInterval(addGeometryFixButton, 2000);
    setInterval(addConnectionCheckButton, 2000);

    log('Completed Init');
  };

  // ===== Geometry Quality Check Helper =====
  /**
   * Checks if any intermediate geometry nodes are too close to segment endpoints
   * @param {Object} segment - WME segment object
   * @param {number} thresholdMeters - Distance threshold in meters (default: 2)
   * @returns {Object} { hasIssue: boolean, details: Array }
   */
  function checkGeometryNodePlacement(segment, thresholdMeters = 2) {
    if (!segment || !segment.geometry || !segment.geometry.coordinates) {
      return { hasIssue: false, details: [] };
    }

    if (typeof turf === 'undefined') {
      log('ERROR: Turf.js is not loaded!');
      return { hasIssue: false, details: [] };
    }

    const coords = segment.geometry.coordinates;

    // Need at least 3 points (start, intermediate, end) to have geometry nodes
    if (coords.length < 3) {
      return { hasIssue: false, details: [] };
    }

    const nodeA = turf.point(coords[0]); // First coordinate (Node A)
    const nodeB = turf.point(coords[coords.length - 1]); // Last coordinate (Node B)
    const issues = [];

    // Check intermediate points (geometry nodes)
    for (let i = 1; i < coords.length - 1; i++) {
      const geometryNode = turf.point(coords[i]);

      // Calculate distance to Node A
      const distanceToA = turf.distance(geometryNode, nodeA, { units: 'meters' });
      if (distanceToA <= thresholdMeters) {
        issues.push({
          nodeIndex: i,
          distanceToA: distanceToA,
          distanceToB: null,
          closeTo: 'A',
          coordinates: coords[i],
        });
      }

      // Calculate distance to Node B
      const distanceToB = turf.distance(geometryNode, nodeB, { units: 'meters' });
      if (distanceToB <= thresholdMeters) {
        issues.push({
          nodeIndex: i,
          distanceToA: null,
          distanceToB: distanceToB,
          closeTo: 'B',
          coordinates: coords[i],
        });
      }
    }

    return {
      hasIssue: issues.length > 0,
      details: issues,
      segmentId: segment.id,
      totalGeometryNodes: coords.length - 2, // Exclude start and end
    };
  }

  // ===== Segment Connection Validation Helper =====
  // Per-rebuild caches to avoid redundant node lookups and distance calculations
  // across multiple segments sharing the same node. Cleared each rebuild cycle.
  // _nodeConnectionMap is built upfront from ALL segments (by fromNodeId/toNodeId)
  // to avoid relying on node.connectedSegmentIds which may be incomplete during panning.
  let _nodeConnectionMap = null;   // Map<nodeId, number> - count of segments connected to each node
  let _nodeDistanceCache = null;  // Map<nodeId, {distance: number|null, coordinates: Array}>

  /**
   * Checks if a segment's A or B node is disconnected (no other segments attached)
   * but is within the given radius of another segment's geometry.
   * Uses the pre-built _nodeConnectionMap (from ALL segments' fromNodeId/toNodeId)
   * for reliable dangling detection, avoiding SDK node.connectedSegmentIds
   * which may be incomplete during panning.
   * Results are cached per nodeId across the current rebuild cycle.
   * @param {Object} segment - WME segment object
   * @param {number} radiusMeters - Search radius in meters (default: 5)
   * @param {Array} allSegments - Array of all segments for proximity check
   * @returns {Object} { hasIssue: boolean, details: Array }
   */
  function checkSegmentConnection(segment, radiusMeters = 5, allSegments = []) {
    if (!segment || !segment.geometry || !segment.geometry.coordinates) {
      return { hasIssue: false, details: [] };
    }

    if (typeof turf === 'undefined') {
      log('ERROR: Turf.js is not loaded!');
      return { hasIssue: false, details: [] };
    }

    const issues = [];
    const segmentId = segment.id;

    // Initialize distance cache on first call per rebuild cycle
    if (!_nodeDistanceCache) _nodeDistanceCache = new Map();

    /**
     * Checks if a node is truly dangling (no other segments connected to it).
     * Uses the pre-built _nodeConnectionMap (built from ALL segments' fromNodeId/toNodeId)
     * instead of node.connectedSegmentIds, which may be incomplete during panning.
     * A node is dangling if it has ≤1 segment connected (i.e. only the current segment).
     */
    function isNodeDangling(nodeId) {
      const count = _nodeConnectionMap ? _nodeConnectionMap.get(nodeId) : 0;
      return !count || count <= 1;
    }

    /**
     * Checks if a node is "partial" (data incomplete — at the edge of the loaded area).
     * Matches WME Validator's check: W.model.nodes.getObjectById().attributes.partial
     * Partial nodes may have unloaded connected segments, so connection checks should be skipped.
     */
    function isNodePartial(nodeId) {
      try {
        if (typeof W !== 'undefined' && W.model && W.model.nodes) {
          const wNode = W.model.nodes.getObjectById(nodeId);
          return wNode && wNode.attributes && wNode.attributes.partial === true;
        }
      } catch (e) {
        // W model not available — assume not partial
      }
      return false;
    }

    /**
     * Gets or computes the closest distance from a node to any other drivable segment.
     * Applies elevation and drivability filters (matching WME Validator 107/108).
     * Cached per nodeId to avoid redundant O(n) scans.
     */
    function getNodeClosestDistance(nodeId) {
      if (_nodeDistanceCache.has(nodeId)) {
        return _nodeDistanceCache.get(nodeId);
      }

      let distance = null;
      let coords = null;
      try {
        const node = wmeSDK.DataModel.Nodes.getById({ nodeId });
        if (node && node.geometry && node.geometry.coordinates) {
          coords = node.geometry.coordinates;
          const nodePoint = turf.point(coords);
          distance = findClosestSegmentDistance(nodePoint, segmentId, allSegments, segment.elevationLevel, radiusMeters);
        }
      } catch (e) {
        log(`Error computing distance for node ${nodeId}: ${e}`);
      }

      const result = { distance, coordinates: coords };
      _nodeDistanceCache.set(nodeId, result);
      return result;
    }

    // Helper: compute the direction angle (radians) at the node from the segment's geometry.
    // For side A (fromNode), segment runs coords[0] → coords[1].
    // For side B (toNode), segment runs coords[last-1] → coords[last]; we use the reversed
    // direction (from node backward) to keep the perpendicular placement consistent.
    function getSegmentAngleAtNode(side, geometryCoords) {
      const coords = geometryCoords;
      if (side === 'A') {
        return Math.atan2(coords[1][1] - coords[0][1], coords[1][0] - coords[0][0]);
      } else {
        const last = coords.length - 1;
        return Math.atan2(coords[last - 1][1] - coords[last][1], coords[last - 1][0] - coords[last][0]);
      }
    }

    // Check A side (fromNode) — skip partial nodes (incomplete data at map edge)
    if (segment.fromNodeId != null) {
      const nodeId = segment.fromNodeId;
      if (!isNodePartial(nodeId) && isNodeDangling(nodeId)) {
        const cached = getNodeClosestDistance(nodeId);
        if (cached.distance !== null && cached.distance <= radiusMeters && cached.coordinates) {
          issues.push({
            side: 'A',
            nodeId: nodeId,
            coordinates: cached.coordinates,
            distance: cached.distance,
            segmentId: segmentId,
            angle: getSegmentAngleAtNode('A', segment.geometry.coordinates),
          });
        }
      }
    }

    // Check B side (toNode) — skip partial nodes (incomplete data at map edge)
    if (segment.toNodeId != null) {
      const nodeId = segment.toNodeId;
      if (!isNodePartial(nodeId) && isNodeDangling(nodeId)) {
        const cached = getNodeClosestDistance(nodeId);
        if (cached.distance !== null && cached.distance <= radiusMeters && cached.coordinates) {
          issues.push({
            side: 'B',
            nodeId: nodeId,
            coordinates: cached.coordinates,
            distance: cached.distance,
            segmentId: segmentId,
            angle: getSegmentAngleAtNode('B', segment.geometry.coordinates),
          });
        }
      }
    }

    return {
      hasIssue: issues.length > 0,
      details: issues,
      segmentId: segment.id,
    };
  }

  /**
   * Finds the minimum distance from a point to any other drivable segment's geometry (excluding self).
   * Applies elevation and drivability filters matching WME Validator (checks 107/108) behavior:
   *   - Skips segments at different elevation levels
   *   - Skips non-drivable segments (footpath, pedestrian, stairway, ferry, railway, runway)
   *   - Skips segments with null fromNode/toNode (newly split unsaved segments)
   * @param {Object} point - Turf.js point
   * @param {number} excludeSegmentId - Segment ID to exclude from search
   * @param {Array} allSegments - Array of all segments
   * @param {number} segmentElevation - Elevation level of the segment being checked
   * @param {number} radiusMeters - Search radius in meters (for spatial pre-filter)
   * @returns {number|null} Minimum distance in meters, or null if no segments to check
   */
  function findClosestSegmentDistance(point, excludeSegmentId, allSegments, segmentElevation, radiusMeters) {
    let minDistance = null;

    // Pre-compute the point's bounding box for the search radius.
    // 1 degree of latitude ≈ 111320 m; longitude degrees vary with cos(lat).
    const [plon, plat] = point.geometry.coordinates;
    const latRad = radiusMeters / 111320;
    const lonRad = radiusMeters / (111320 * Math.cos(plat * Math.PI / 180));
    const pMinLat = plat - latRad, pMaxLat = plat + latRad;
    const pMinLon = plon - lonRad, pMaxLon = plon + lonRad;

    allSegments.forEach((otherSeg) => {
      if (otherSeg.id === excludeSegmentId) return;
      if (!otherSeg.geometry || !otherSeg.geometry.coordinates || otherSeg.geometry.coordinates.length < 2) return;

      // Skip segments with null nodes (newly split unsaved segments) — matches WME Validator
      if (otherSeg.fromNodeId == null && otherSeg.toNodeId == null) return;

      // Only consider segments at the same elevation level — matches WME Validator 107/108
      if (typeof segmentElevation === 'number' && typeof otherSeg.elevationLevel === 'number' &&
          segmentElevation !== otherSeg.elevationLevel) return;

      // Skip non-drivable segments in proximity check — matches WME Validator
      if (isNonDrivableType(otherSeg.roadType)) return;

      try {
        const coords = otherSeg.geometry.coordinates;

        // Spatial bounding box pre-filter: compute the segment's bounding box and
        // check overlap with the point's radius box. If no overlap, the segment
        // cannot be within radiusMeters — skip the expensive pointToLineDistance.
        let segMinLat = coords[0][1], segMaxLat = coords[0][1];
        let segMinLon = coords[0][0], segMaxLon = coords[0][0];
        for (let i = 1; i < coords.length; i++) {
          const lon = coords[i][0], lat = coords[i][1];
          if (lat < segMinLat) segMinLat = lat;
          else if (lat > segMaxLat) segMaxLat = lat;
          if (lon < segMinLon) segMinLon = lon;
          else if (lon > segMaxLon) segMaxLon = lon;
        }
        // No overlap between segment bounding box and point's radius box
        if (segMaxLat < pMinLat || segMinLat > pMaxLat ||
            segMaxLon < pMinLon || segMinLon > pMaxLon) {
          return;
        }

        // Precise distance to the full segment geometry using pointToLineDistance
        const dist = turf.pointToLineDistance(point, otherSeg.geometry, { units: 'meters' });
        if (minDistance === null || dist < minDistance) {
          minDistance = dist;
        }
      } catch (e) {
        // Skip segments with invalid geometry
      }
    });

    return minDistance;
  }

  // ===== Segment Connection Highlight Layer =====
  const CONNECTION_HIGHLIGHT_LAYER = 'EZRoadMod.connectionHighlight';

  // ===== Segment Length Display Functionality =====
  let segmentLengthContainer = null;
  let segmentLabelCache = []; // Cache segment data and label elements

  // Store last map bounds to detect changes
  let lastBounds = null;
  let lastZoom = null;
  let updateInterval = null;
  let isMapMoving = false;
  let updateFrameRequest = null;
  let moveEndTimer = null;

  // Define helper functions first
  function clearSegmentLengthDisplay() {
    if (segmentLengthContainer) {
      segmentLengthContainer.innerHTML = '';
    }
    segmentLabelCache = [];
  }

  // Rebuild segment data and create new labels (expensive - only on zoom/data changes)
  function rebuildSegmentLengthDisplay() {
    const options = getOptions();

    // Update dashboard count if exists (even if hidden)
    const countBadge = document.getElementById('ezroad-geometry-error-count');

    if ((!options.showSegmentLength && !options.checkGeometryIssues && !options.validateNodeConnection) || !segmentLengthContainer) {
      if (countBadge) countBadge.style.display = 'none';
      return;
    }

    clearSegmentLengthDisplay();

    // Clear per-rebuild caches for segment connection validation
    _nodeConnectionMap = null;
    _nodeDistanceCache = null;

    if (typeof turf === 'undefined') {
      log('ERROR: Turf.js is not loaded!');
      return;
    }

    // Build node connection map from ALL loaded segments
    // (using fromNodeId/toNodeId instead of node.connectedSegmentIds,
    //  which may be incomplete during panning).
    // Maps each nodeId to the count of segments connected to it.
    try {
      _nodeConnectionMap = new Map();
      const allSegments = wmeSDK.DataModel.Segments.getAll();
      for (const seg of allSegments) {
        if (seg.fromNodeId != null) {
          _nodeConnectionMap.set(seg.fromNodeId, (_nodeConnectionMap.get(seg.fromNodeId) || 0) + 1);
        }
        if (seg.toNodeId != null) {
          _nodeConnectionMap.set(seg.toNodeId, (_nodeConnectionMap.get(seg.toNodeId) || 0) + 1);
        }
      }
    } catch (e) {
      log(`Error building node connection map: ${e}`);
      _nodeConnectionMap = new Map();
    }

    let issueCount = 0; // Count for geometry nodes near endpoints (📍 pin icon - bug button)
    const segmentsWithIssues = new Set(); // Track unique segments with geometry node issues
    let connectionIssueCount = 0; // Count for segment connection issues (⚠️ warning icon)
    const segmentsWithConnectionIssues = new Set(); // Track unique segments with connection issues

    try {
      const currentZoom = wmeSDK.Map.getZoomLevel();
      // Check if any feature can be shown at this zoom level
      const canShowGeometry = options.checkGeometryIssues && currentZoom >= 18;
      const canShowLength = options.showSegmentLength && currentZoom >= 18;
      const canShowConnection = options.validateNodeConnection && currentZoom >= 16;
      if (!canShowGeometry && !canShowLength && !canShowConnection) {
        if (countBadge) countBadge.style.display = 'none';
        return;
      }

      const allSegments = wmeSDK.DataModel.Segments.getAll();
      let extent = wmeSDK.Map.getMapExtent();

      if (!extent || !allSegments || allSegments.length === 0) {
        if (countBadge) countBadge.style.display = 'none';
        return;
      }

      const mapBounds = {
        west: extent[0],
        south: extent[1],
        east: extent[2],
        north: extent[3],
      };

      // Pre-filter segments to only those overlapping the viewport.
      // This is essential for the connection check to avoid checking
      // segments across the entire map (potentially 10,000s).
      const viewportSegments = allSegments.filter((seg) => {
        if (!seg.geometry || !seg.geometry.coordinates || seg.geometry.coordinates.length < 2) return false;
        return seg.geometry.coordinates.some(
          ([lon, lat]) => lon >= mapBounds.west && lon <= mapBounds.east && lat >= mapBounds.south && lat <= mapBounds.north
        );
      });

      // Use a DocumentFragment to batch DOM insertions (Performance optimization)
      const fragment = document.createDocumentFragment();

      viewportSegments.forEach((segment) => {
        try {
          const geometry = segment.geometry;
          if (!geometry || !geometry.coordinates || geometry.coordinates.length < 2) {
            return;
          }

          // Skip roundabouts (segments that are part of a junction)
          if (segment.junctionId !== null) {
            return;
          }

          // 1. Check for geometry nodes near endpoints
          if (canShowGeometry && options.checkGeometryIssues) {
            const geoResult = checkGeometryNodePlacement(segment, options.geometryIssueThreshold);
            if (geoResult.hasIssue) {
              let hasVisibleIssue = false;
              geoResult.details.forEach((issue) => {
                // Check visibility
                if (issue.coordinates[0] < mapBounds.west || issue.coordinates[0] > mapBounds.east || issue.coordinates[1] < mapBounds.south || issue.coordinates[1] > mapBounds.north) {
                  return;
                }

                hasVisibleIssue = true;

                const pinDiv = document.createElement('div');
                pinDiv.innerHTML = '📍'; // Pin icon
                pinDiv.style.position = 'absolute';
                pinDiv.style.width = '30px';
                pinDiv.style.height = '30px';
                pinDiv.style.display = 'flex';
                pinDiv.style.alignItems = 'center';
                pinDiv.style.justifyContent = 'center';
                pinDiv.style.fontSize = '30px';
                pinDiv.style.pointerEvents = 'none';
                pinDiv.title = `Node too close to ${issue.closeTo === 'A' ? 'start' : 'end'}: ${Math.round(issue.distanceToA || issue.distanceToB * 10) / 10}m`;

                fragment.appendChild(pinDiv);

                segmentLabelCache.push({
                  lon: issue.coordinates[0],
                  lat: issue.coordinates[1],
                  labelDiv: pinDiv,
                  offsetX: 15, // Center of 30px
                  offsetY: 30, // Shift up (full height)
                });
              });
              // Count unique segments with visible issues
              if (hasVisibleIssue) {
                segmentsWithIssues.add(segment.id);
              }
            }
          }

          // 2. Check for segment connection issues (dangling node near another segment)
          // Skip non-drivable segments (footpath, pedestrian, stairway, ferry, railway, runway)
          // Skip very short segments (< connectionCheckRadius) — follows WME Validator 107/108 pattern
          if (canShowConnection && options.validateNodeConnection && !isNonDrivableType(segment.roadType)) {
            const segLength = turf.length(turf.lineString(geometry.coordinates), { units: 'meters' });
            if (segLength >= options.connectionCheckRadius) {
            // Use allSegments (not viewportSegments) for proximity check to match
            // WME Validator's approach (getAll()), ensuring nearby segments just outside
            // the viewport are still detected.
            const connResult = checkSegmentConnection(segment, options.connectionCheckRadius, allSegments);
            if (connResult.hasIssue) {
              // Always mark the segment for highlight — the segment itself is visible
              // (it passed the viewportSegments filter), even if the problematic node
              // is off-screen. Matches WME Validator behavior.
              segmentsWithConnectionIssues.add(segment.id);

              connResult.details.forEach((issue) => {
                // Skip the warning icon only if the exact node is outside the viewport
                // (icon would be off-screen), but the highlight remains.
                if (issue.coordinates[0] < mapBounds.west || issue.coordinates[0] > mapBounds.east || issue.coordinates[1] < mapBounds.south || issue.coordinates[1] > mapBounds.north) {
                  return;
                }

                const warnDiv = document.createElement('div');
                warnDiv.innerHTML = '<i class="w-icon w-icon-avoid-highways" style="font-size: 30px; color: red; background: rgba(255, 255, 255, 0.5)"></i>'; // Warning icon
                warnDiv.style.position = 'absolute';
                warnDiv.style.width = '24px';
                warnDiv.style.height = '24px';
                warnDiv.style.display = 'flex';
                warnDiv.style.alignItems = 'center';
                warnDiv.style.justifyContent = 'center';
                warnDiv.style.fontSize = '24px';
                warnDiv.style.pointerEvents = 'auto'; // Enable hover for native tooltip
                warnDiv.title = `Segment ${issue.side} side disconnected but only ${Math.round(issue.distance * 10) / 10}m from another segment`;

                fragment.appendChild(warnDiv);

                segmentLabelCache.push({
                  lon: issue.coordinates[0],
                  lat: issue.coordinates[1],
                  labelDiv: warnDiv,
                  offsetX: 12, // Base center of 24px; may be adjusted dynamically
                  offsetY: 24, // Base shift up; may be adjusted dynamically
                  angle: issue.angle, // Segment direction at node, for perpendicular offset
                });
              });
            }
            } // closes segLength >= connectionCheckRadius guard
          }

          // 3. Show Segment Length
          if (canShowLength && options.showSegmentLength) {
            const line = turf.lineString(geometry.coordinates);
            const lengthMeters = turf.length(line, { units: 'meters' });

            if (lengthMeters <= 20) {
              const midPointFeature = turf.along(line, lengthMeters / 2, { units: 'meters' });
              const midCoords = midPointFeature.geometry.coordinates;

              if (midCoords[0] >= mapBounds.west && midCoords[0] <= mapBounds.east && midCoords[1] >= mapBounds.south && midCoords[1] <= mapBounds.north) {
                // Create label element
                const labelDiv = document.createElement('div');
                labelDiv.style.position = 'absolute';
                labelDiv.style.width = '30px';
                labelDiv.style.height = '30px';
                labelDiv.style.borderRadius = '50%';
                labelDiv.style.backgroundColor = '#ff6600a1';
                labelDiv.style.display = 'flex';
                labelDiv.style.alignItems = 'center';
                labelDiv.style.justifyContent = 'center';
                labelDiv.style.color = 'white';
                labelDiv.style.fontSize = '12px';
                labelDiv.style.fontWeight = 'bold';
                labelDiv.style.pointerEvents = 'none';
                labelDiv.textContent = Math.round(lengthMeters);

                fragment.appendChild(labelDiv);

                segmentLabelCache.push({
                  lon: midCoords[0],
                  lat: midCoords[1],
                  labelDiv: labelDiv,
                  offsetX: 15,
                  offsetY: 35,
                });
              }
            }
          }
        } catch (err) {
          // Silent error handling
        }
      });

      // Batch append all elements to the DOM
      segmentLengthContainer.appendChild(fragment);

      // Update positions after creating labels
      updateSegmentLabelPositions();

      // Get final counts
      issueCount = segmentsWithIssues.size; // Number of segments with geometry node issues
      connectionIssueCount = segmentsWithConnectionIssues.size; // Number of segments with connection issues
      // Update badge count and icon color for bug icon (geometry nodes near endpoints only - 📍 pin icon)
      if (countBadge) {
        if (issueCount > 0 && options.checkGeometryIssues) {
          countBadge.value = issueCount;
          countBadge.style.display = 'inline-flex';

          // Update bug icon color to red when issues found
          const bugIcon = document.getElementById('ezroad-bug-icon');
          if (bugIcon) bugIcon.style.color = '#ff3333ff';
        } else {
          countBadge.style.display = 'none';

          // Update bug icon color to default blue when no issues
          const bugIcon = document.getElementById('ezroad-bug-icon');
          if (bugIcon) bugIcon.style.color = '#33CCFF';
        }
      }
      // Update badge count for connection validation (⚠️ warning icon)
      const connBadge = document.getElementById('ezroad-connection-error-count');
      if (connBadge) {
        if (connectionIssueCount > 0 && options.validateNodeConnection) {
          connBadge.value = connectionIssueCount;
          connBadge.style.display = 'inline-flex';
          const connIcon = document.getElementById('ezroad-connection-icon');
          if (connIcon) connIcon.style.color = '#ff3333ff';
        } else {
          connBadge.style.display = 'none';
          const connIcon = document.getElementById('ezroad-connection-icon');
          if (connIcon) connIcon.style.color = '#33CCFF';
        }
      }
      // Highlight segments with connection issues on the map
      try {
        wmeSDK.Map.removeAllFeaturesFromLayer({ layerName: CONNECTION_HIGHLIGHT_LAYER });
      } catch (e) { /* layer may not exist yet */ }

      if (connectionIssueCount > 0 && options.validateNodeConnection) {
        const highlightFeatures = [];
        segmentsWithConnectionIssues.forEach((segId) => {
          const seg = wmeSDK.DataModel.Segments.getById({ segmentId: segId });
          if (seg && seg.geometry) {
            highlightFeatures.push({
              type: 'Feature',
              id: `conn_highlight_${segId}`,
              geometry: seg.geometry,
              properties: { featureType: 'connectionHighlight' },
            });
          }
        });
        if (highlightFeatures.length > 0) {
          try {
            wmeSDK.Map.addFeaturesToLayer({
              layerName: CONNECTION_HIGHLIGHT_LAYER,
              features: highlightFeatures,
            });
          } catch (e) {
            log(`Error highlighting connection issues: ${e}`);
          }
        }
        log(`Connection issues: ${connectionIssueCount} segments with dangling endpoints near other segments`);
      }
    } catch (error) {
      log('Error rebuilding segment length display: ' + error.message);
    }
  }

  // Fast position update - only updates pixel positions of existing labels
  function updateSegmentLabelPositions() {
    if (!segmentLengthContainer || segmentLabelCache.length === 0) {
      return;
    }

    try {
      segmentLabelCache.forEach((cached) => {
        const pixel = wmeSDK.Map.getMapPixelFromLonLat({
          lonLat: { lon: cached.lon, lat: cached.lat },
        });

        if (pixel && typeof pixel.x === 'number' && typeof pixel.y === 'number') {
          let offX = cached.offsetX || 15;
          let offY = cached.offsetY || 35;

          // If the label has a segment direction angle, offset perpendicular to the
          // segment so the icon sits beside it rather than on top of it.
          if (cached.angle !== undefined) {
            // Perpendicular to the right of the segment direction in screen space.
            // Geo y is inverted in screen (y-down), so negate the geo angle.
            const screenAngle = -cached.angle + Math.PI / 2; // 90° clockwise
            // Dynamic offset based on zoom level — further out at higher zooms
            let zoom;
            try { zoom = wmeSDK.Map.getZoomLevel(); } catch (e) { zoom = 19; }
            const perpDist = zoom >= 22 ? 40 :
                            zoom === 21 ? 35 :
                            zoom === 20 ? 30 :
                            zoom === 19 ? 25 :
                            zoom === 18 ? 20 :
                            zoom === 17 ? 15 :
                                          10; // zoom 16 and below
            offX += Math.cos(screenAngle) * perpDist;
            // Negate Y because offY is subtracted (top = pixel.y - offY), so
            // to move in the positive screen-y (down) direction, offY must decrease.
            offY += -Math.sin(screenAngle) * perpDist;
          }

          cached.labelDiv.style.left = pixel.x - offX + 'px';
          cached.labelDiv.style.top = pixel.y - offY + 'px';
        }
      });
    } catch (err) {
      // Silent error handling
    }
  }

  // Poll for map changes and update display
  function checkAndUpdate() {
    // Do not update if map is currently moving
    if (typeof isMapMoving !== 'undefined' && isMapMoving) return;

    const options = getOptions();
    if (!options.showSegmentLength && !options.checkGeometryIssues && !options.validateNodeConnection) {
      if (segmentLengthContainer) segmentLengthContainer.style.display = 'none';
      return;
    } else {
      if (segmentLengthContainer) segmentLengthContainer.style.display = 'block';
    }

    try {
      let extent;
      let currentZoom;

      try {
        extent = wmeSDK.Map.getMapExtent();
        currentZoom = wmeSDK.Map.getZoomLevel();
      } catch (e) {
        return;
      }

      const currentBounds = {
        west: extent[0],
        south: extent[1],
        east: extent[2],
        north: extent[3],
      };

      // Check if map has moved or zoomed
      if (!lastBounds || lastBounds.north !== currentBounds.north || lastBounds.south !== currentBounds.south || lastBounds.east !== currentBounds.east || lastBounds.west !== currentBounds.west || lastZoom !== currentZoom) {
        lastBounds = currentBounds;
        lastZoom = currentZoom;
        rebuildSegmentLengthDisplay();
      }
    } catch (e) {}
  }

  function handleSegmentLengthToggle() {
    const options = getOptions();

    // Update button visibility immediately on toggle
    addGeometryFixButton();
    addConnectionCheckButton();

    if (options.showSegmentLength || options.checkGeometryIssues || options.validateNodeConnection) {
      if (segmentLengthContainer) segmentLengthContainer.style.display = 'block';

      // Ensure polling is active
      if (!updateInterval) {
        updateInterval = setInterval(checkAndUpdate, 500);
      }
      rebuildSegmentLengthDisplay();
    } else {
      if (segmentLengthContainer) segmentLengthContainer.style.display = 'none';
      clearSegmentLengthDisplay();

      // Stop polling
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    }
  }

  function initSegmentLengthLayer() {
    log('Initializing segment length display layer');

    // Find viewport div - prefer standard class or ID
    // Try SDK method first if possible, though getMapViewportElement might not be exposed on all versions?
    // Docs say getMapViewportElement() returns HTMLElement.
    let viewportDiv;
    try {
      viewportDiv = wmeSDK.Map.getMapViewportElement();
    } catch (e) {
      log('SDK getMapViewportElement failed, trying fallbacks');
    }

    if (!viewportDiv) {
      viewportDiv = document.querySelector('.ol-viewport') || document.querySelector('#WazeMap') || document.querySelector('#map');
    }

    if (!viewportDiv) {
      log('Map viewport not found');
      return;
    }

    // Create div container for length labels
    segmentLengthContainer = document.createElement('div');
    segmentLengthContainer.id = 'ezroad-segment-length-container';
    segmentLengthContainer.style.position = 'absolute';
    segmentLengthContainer.style.top = '0';
    segmentLengthContainer.style.left = '0';
    segmentLengthContainer.style.width = '100%';
    segmentLengthContainer.style.height = '100%';
    segmentLengthContainer.style.pointerEvents = 'none';
    segmentLengthContainer.style.zIndex = '1000';
    segmentLengthContainer.style.display = 'none'; // Hidden by default

    viewportDiv.appendChild(segmentLengthContainer);
    log('Container appended to map viewport');

    // Variables are now defined in outer scope to allow access from handleSegmentLengthToggle
    // lastBounds, lastZoom, updateInterval, isMapMoving, updateFrameRequest

    // Event handlers for map movement using SDK events
    const onMapMove = function () {
      isMapMoving = true;
      // Use requestAnimationFrame to throttle position updates during map movement
      if (updateFrameRequest) {
        return; // Already scheduled
      }

      updateFrameRequest = requestAnimationFrame(() => {
        updateFrameRequest = null;
        const options = getOptions();
        if ((options.showSegmentLength || options.checkGeometryIssues || options.validateNodeConnection) && segmentLengthContainer && segmentLengthContainer.style.display !== 'none') {
          updateSegmentLabelPositions(); // Fast position update only
        }
      });
    };

    const onMoveEnd = function () {
      isMapMoving = false;
      // Debounce rebuild to let SDK populate node/segment data after panning
      if (moveEndTimer) clearTimeout(moveEndTimer);
      moveEndTimer = setTimeout(() => {
        moveEndTimer = null;
        // Rebuild labels after movement ends (checks if segments entered/left viewport)
        const options = getOptions();
        if ((options.showSegmentLength || options.checkGeometryIssues || options.validateNodeConnection) && segmentLengthContainer) {
          segmentLengthContainer.style.display = 'block';
          rebuildSegmentLengthDisplay();

          // Update lastBounds/Zoom to prevent redundant update from interval
          try {
            let extent = wmeSDK.Map.getMapExtent();
            lastBounds = {
              west: extent[0],
              south: extent[1],
              east: extent[2],
              north: extent[3],
            };
            lastZoom = wmeSDK.Map.getZoomLevel();
          } catch (e) {}
        }
      }, 150);
    };

    const onZoomChanged = function () {
      const options = getOptions();
      if ((options.showSegmentLength || options.checkGeometryIssues || options.validateNodeConnection) && segmentLengthContainer) {
        rebuildSegmentLengthDisplay(); // Full rebuild on zoom
        try {
          let extent = wmeSDK.Map.getMapExtent();
          lastBounds = {
            west: extent[0],
            south: extent[1],
            east: extent[2],
            north: extent[3],
          };
          lastZoom = wmeSDK.Map.getZoomLevel();
        } catch (e) {}
      }
    };

    // Register SDK event listeners
    wmeSDK.Events.on({
      eventName: 'wme-map-move',
      eventHandler: onMapMove,
    });

    wmeSDK.Events.on({
      eventName: 'wme-map-move-end',
      eventHandler: onMoveEnd,
    });

    wmeSDK.Events.on({
      eventName: 'wme-map-zoom-changed',
      eventHandler: onZoomChanged,
    });

    // U-turn panel: Monitor node selection using native SDK event (wme-selection-changed)
    wmeSDK.Events.on({
      eventName: 'wme-selection-changed',
      eventHandler: () => {
        try {
          const selection = wmeSDK.Editing.getSelection();
          
          // Check if a node is selected
          if (selection && selection.objectType === 'node' && selection.ids.length > 0) {
            // Node is selected - create panel
            createUTurnPanel();
          } else {
            // Nothing selected or non-node selected - remove panel
            removeUTurnPanel();
          }
          
          // Update lane chip highlight when selection changes
          if (typeof updateLaneChipHighlight === 'function') {
            updateLaneChipHighlight();
          }
        } catch (e) {
          log(`[EZRoad] Error in selection changed handler: ${e.message}`);
        }
      },
    });

    // Update U-turn panel when turns change
    wmeSDK.Events.on({
      eventName: 'wme-after-undo',
      eventHandler: () => {
        updateUTurnPanel();
        // Refresh lane chip highlight after undo — segment lanes may have reverted
        if (typeof updateLaneChipHighlight === 'function') {
          updateLaneChipHighlight();
        }
      },
    });

    wmeSDK.Events.on({
      eventName: 'wme-after-redo-clear',
      eventHandler: () => {
        updateUTurnPanel();
        if (typeof updateLaneChipHighlight === 'function') {
          updateLaneChipHighlight();
        }
      },
    });

    // Listen for any segment data model changes (e.g., lane updates from other
    // scripts, undo of lane changes) to auto-refresh the chip highlight.
    wmeSDK.Events.on({
      eventName: 'wme-data-model-objects-changed',
      eventHandler: (data) => {
        if (data && data.dataModelName === 'Segment' && data.objectIds && data.objectIds.length > 0) {
          // Only refresh if the changed segments match the current selection
          const selection = wmeSDK.Editing.getSelection();
          if (selection && selection.objectType === 'segment' && selection.ids) {
            const hasMatch = data.objectIds.some((id) => selection.ids.includes(Number(id)));
            if (hasMatch && typeof updateLaneChipHighlight === 'function') {
              updateLaneChipHighlight();
            }
          }
        }
      },
    });

    // Initialize the connection highlight layer (even if not enabled yet — segments are drawn when issues found)
    try {
      wmeSDK.Map.addLayer({
        layerName: CONNECTION_HIGHLIGHT_LAYER,
        styleRules: [
          {
            predicate: props => props.featureType === 'connectionHighlight',
            style: { strokeColor: '#ff0000', strokeWidth: 25, strokeOpacity: 0.4 },
          },
        ],
      });
    } catch (e) {
      log(`Connection highlight layer init: ${e}`);
    }

    // Initialize polling if already enabled
    const options = getOptions();
    if (options.showSegmentLength || options.checkGeometryIssues || options.validateNodeConnection) {
      handleSegmentLengthToggle();
    }

    log('Segment length layer initialized');
  }
  // ===== End Segment Length Display Functionality =====

  // ===== Unified SDK Shortcut Registration (PIE-style) =====
  function initializeSDKShortcuts() {
    if (!wmeSDK?.Shortcuts || !_sdkShortcutDefs) return;

    // Delete any existing registrations for our shortcuts
    for (var i = 0; i < _sdkShortcutDefs.length; i++) {
      var def = _sdkShortcutDefs[i];
      if (wmeSDK.Shortcuts.isShortcutRegistered({ shortcutId: def.id })) {
        wmeSDK.Shortcuts.deleteShortcut({ shortcutId: def.id });
      }
    }

    // Load saved shortcut keys and register all
    var opts = getOptions();
    if (!opts.sdkShortcuts) opts.sdkShortcuts = {};

    for (var j = 0; j < _sdkShortcutDefs.length; j++) {
      var shortcutDef = _sdkShortcutDefs[j];
      // Normalize stored value
      var saved = opts.sdkShortcuts[shortcutDef.settingsKey];
      opts.sdkShortcuts[shortcutDef.settingsKey] = _normalizeShortcut(saved);

      try {
        wmeSDK.Shortcuts.createShortcut({
          shortcutId: shortcutDef.id,
          description: shortcutDef.description,
          callback: shortcutDef.callback,
          shortcutKeys: opts.sdkShortcuts[shortcutDef.settingsKey].combo,
        });
      } catch (error) {
        if (String(error).indexOf('already in use') !== -1) {
          // Key conflict — register without a key; user assigns in WME UI
          opts.sdkShortcuts[shortcutDef.settingsKey] = { raw: null, combo: null };
          try {
            wmeSDK.Shortcuts.createShortcut({
              shortcutId: shortcutDef.id,
              description: shortcutDef.description,
              callback: shortcutDef.callback,
              shortcutKeys: null,
            });
          } catch (error2) {
            log('Unable to create shortcut: ' + shortcutDef.id + ' - ' + error2);
          }
        } else {
          log('Unable to create shortcut: ' + shortcutDef.id + ' - ' + error);
        }
      }
    }
    saveOptions(opts);
    log('SDK shortcuts initialized (' + _sdkShortcutDefs.length + ' total)');
  }

  // ===== SDK Shortcut Persistence (auto-save on beforeunload + polling) =====
  function checkSDKShortcutsChanged() {
    if (!wmeSDK?.Shortcuts || !_sdkShortcutDefs) return;
    var triggerSave = false;
    var shortcuts = wmeSDK.Shortcuts.getAllShortcuts();

    for (var i = 0; i < shortcuts.length; i++) {
      var shortcut = shortcuts[i];
      var matchingDef = null;
      for (var j = 0; j < _sdkShortcutDefs.length; j++) {
        if (_sdkShortcutDefs[j].id === shortcut.shortcutId) {
          matchingDef = _sdkShortcutDefs[j];
          break;
        }
      }
      if (!matchingDef) continue;

      var normalized = _normalizeShortcut(shortcut.shortcutKeys);
      var opts = getOptions();
      if (!opts.sdkShortcuts) opts.sdkShortcuts = {};
      if (opts.sdkShortcuts[matchingDef.settingsKey]?.combo !== normalized.combo) {
        triggerSave = true;
        break;
      }
    }

    if (triggerSave) {
      for (var k = 0; k < shortcuts.length; k++) {
        var s = shortcuts[k];
        var matchDef = null;
        for (var l = 0; l < _sdkShortcutDefs.length; l++) {
          if (_sdkShortcutDefs[l].id === s.shortcutId) {
            matchDef = _sdkShortcutDefs[l];
            break;
          }
        }
        if (matchDef && matchDef.settingsKey) {
          var opts2 = getOptions();
          if (!opts2.sdkShortcuts) opts2.sdkShortcuts = {};
          opts2.sdkShortcuts[matchDef.settingsKey] = _normalizeShortcut(s.shortcutKeys);
          saveOptions(opts2);
        }
      }
      log('SDK shortcut changes saved.');
    }
  }

  // ===== New Feature: One-click Geometry Fix =====

  async function fixVisibleGeometryIssues() {
    const options = getOptions();
    if (!options.checkGeometryIssues) {
      if (WazeToastr?.Alerts) WazeToastr.Alerts.info(`${scriptName}`, 'Please enable "Check Geometry issues" in settings first.');
      else alert('Please enable "Check Geometry issues" in EZRoad Mod settings first.');
      return;
    }

    const allSegments = wmeSDK.DataModel.Segments.getAll();
    let extent = wmeSDK.Map.getMapExtent();
    if (!extent) return;
    const mapBounds = { west: extent[0], south: extent[1], east: extent[2], north: extent[3] };

    let fixedCount = 0;
    let errors = 0;
    let totalIssueCount = 0;

    // Filter for segments with issues in view
    const segmentsToFix = allSegments.filter((segment) => {
      if (!segment.geometry) return false;

      // Skip roundabouts (segments that are part of a junction)
      if (segment.junctionId !== null) return false;

      // Check for nodes too close to endpoints
      const result = checkGeometryNodePlacement(segment, options.geometryIssueThreshold);
      if (!result.hasIssue) return false;

      // Initial visibility check of issues
      const visibleIssues = result.details.filter((issue) => issue.coordinates[0] >= mapBounds.west && issue.coordinates[0] <= mapBounds.east && issue.coordinates[1] >= mapBounds.south && issue.coordinates[1] <= mapBounds.north);
      
      if (visibleIssues.length > 0) {
        totalIssueCount += visibleIssues.length;
        return true;
      }
      return false;
    });

    if (segmentsToFix.length === 0) {
      if (WazeToastr?.Alerts) WazeToastr.Alerts.error(`${scriptName}`, 'No visible geometry issues to fix.');
      else alert('No visible geometry issues to fix.');
      return;
    }

    const performFix = async () => {
      let fixedIssueCount = 0;
      for (const segment of segmentsToFix) {
        try {
          const result = checkGeometryNodePlacement(segment, options.geometryIssueThreshold); // Recalculate to be safe
          if (!result.hasIssue) continue;

          const idxToRemove = new Set(result.details.map((d) => d.nodeIndex));
          const oldCoords = segment.geometry.coordinates;
          const newCoords = oldCoords.filter((_, i) => !idxToRemove.has(i));

          if (newCoords.length < 2) continue; // Should not happen for geometry nodes, but safety

          await wmeSDK.DataModel.Segments.updateSegment({
            segmentId: segment.id,
            geometry: {
              type: 'LineString',
              coordinates: newCoords,
            },
          });
          fixedCount++;
          fixedIssueCount += result.details.length;
        } catch (e) {
          console.error('Failed to fix segment', segment.id, e);
          errors++;
        }
      }

      const msg = fixedIssueCount === fixedCount ? `Fixed ${fixedCount} segments.${errors > 0 ? ` (${errors} errors)` : ''}` : `Fixed ${fixedCount} segments with ${fixedIssueCount} geometry node issues.${errors > 0 ? ` (${errors} errors)` : ''}`;
      if (WazeToastr?.Alerts) WazeToastr.Alerts.success(`${scriptName}`, msg);
      else alert(msg);

      // Refresh display
      rebuildSegmentLengthDisplay();
    };

    const confirmMsg = totalIssueCount === segmentsToFix.length ? `Found ${segmentsToFix.length} segments with geometry issues. Fix them now?` : `Found ${segmentsToFix.length} segments with ${totalIssueCount} geometry node issues. Fix them now?`;

    if (WazeToastr?.Alerts?.confirm) {
      WazeToastr.Alerts.confirm(`${scriptName}`, confirmMsg, performFix, null, 'Fix', 'Cancel');
    } else if (confirm(confirmMsg)) {
      performFix();
    }
  }

  function addGeometryFixButton() {
    const options = getOptions();

    // Check user rank - only show for L3 and above (rank >= 2 in SDK)
    const userInfo = wmeSDK.State.getUserInfo();
    if (!userInfo || userInfo.rank < UserRankRequiredForGeometryFix - 1) {
      // Remove wrapper (and button inside it) if user doesn't have permission
      const existingWrapper = document.getElementById('ezroad-geometry-wrapper');
      if (existingWrapper) existingWrapper.remove();
      return;
    }

    const prefsItem = document.querySelector('wz-navigation-item[data-for="prefs"]');
    let bugBtn = document.getElementById('ezroad-fix-geometry-btn');

    if (bugBtn) {
      // Update visibility on the wrapper based on option and rank
      const existingWrapper = document.getElementById('ezroad-geometry-wrapper');
      if (existingWrapper) existingWrapper.style.display = options.checkGeometryIssues ? 'flex' : 'none';
      return;
    }

    if (!prefsItem) return;

      const wrapper = document.createElement('div');
      wrapper.id = 'ezroad-geometry-wrapper';
      wrapper.style.cssText = `display: ${options.checkGeometryIssues ? 'flex' : 'none'}; justify-content: center; align-items: center; padding-top: 12px; padding-bottom: 12px; height: auto;`;

      bugBtn = document.createElement('wz-button');
      bugBtn.color = 'text';
      bugBtn.size = 'sm';
      bugBtn.id = 'ezroad-fix-geometry-btn';
      bugBtn.type = 'button';

      // HTML content matching user request style
      bugBtn.innerHTML = `
        <i class="w-icon w-icon-bug-fill" id="ezroad-bug-icon" style="color: #33CCFF" title="Auto-fix geometry nodes near endpoints"></i>
        <wz-notification-indicator value="0" id="ezroad-geometry-error-count" class="counter" style="display: none;"></wz-notification-indicator>
      `;

      bugBtn.addEventListener('click', fixVisibleGeometryIssues);

      wrapper.appendChild(bugBtn);
    // Insert after prefs
      prefsItem.insertAdjacentElement('afterend', wrapper);
    }

  // ===== Connection Validation Dashboard Button =====
  function addConnectionCheckButton() {
    const options = getOptions();

    const prefsItem = document.querySelector('wz-navigation-item[data-for="prefs"]');
    let connBtn = document.getElementById('ezroad-connection-btn');

    if (connBtn) {
      // Update visibility on the wrapper
      const existingWrapper = document.getElementById('ezroad-connection-wrapper');
      if (existingWrapper) existingWrapper.style.display = options.validateNodeConnection ? 'flex' : 'none';
      return;
    }

    if (!prefsItem) return;

      const wrapper = document.createElement('div');
      wrapper.id = 'ezroad-connection-wrapper';
      wrapper.style.cssText = `display: ${options.validateNodeConnection ? 'flex' : 'none'}; justify-content: center; align-items: center; padding-top: 12px; padding-bottom: 12px; height: auto;`;

      connBtn = document.createElement('wz-button');
      connBtn.color = 'text';
      connBtn.size = 'sm';
      connBtn.id = 'ezroad-connection-btn';
      connBtn.type = 'button';

      connBtn.innerHTML = `
        <i class="w-icon w-icon-avoid-highways" id="ezroad-connection-icon" style="color: #33CCFF" title="Validation: disconnected nodes near other segments"></i>
        <wz-notification-indicator value="0" id="ezroad-connection-error-count" class="counter" style="display: none;"></wz-notification-indicator>
      `;

      wrapper.appendChild(connBtn);
    // Insert after prefs (next to the geometry button)
      prefsItem.insertAdjacentElement('afterend', wrapper);
    }

  // ===== Segment Splitter Feature =====
  // Uses only official WME SDK APIs:
  //   - Editing.lockEditing() / releaseEditingLock() for exclusive edit mode
  //   - Map.getMapViewportElement() + getLonLatFromMapPixel() for mouse → geo coords
  //   - Map.addLayer() / addFeaturesToLayer() / removeAllFeaturesFromLayer() / removeLayer()
  //   - DataModel.Segments.splitSegment({ segmentId, splitPoint: Point })
  //   - Events.on() returns an unsubscribe fn (stored and called on exit)

  const SPLIT_LAYER_NAME = 'EZRoadMod.segmentSplit';
  let splitEditingLock = null;
  let splitSegmentToSplit = null;
  let splitMouseDownPoint = null;
  let splitLastMouseMovePoint = null;
  let splitUnsubZoom = null;
  let splitUnsubMoveEnd = null;
  let splitPreviewFrameRequest = null;
  let splitVisibleSegments = null; // cached per zoom/pan — rebuilt only when map extent changes

  function rebuildSplitSegmentCache() {
    try {
      const [west, south, east, north] = wmeSDK.Map.getMapExtent();
      splitVisibleSegments = wmeSDK.DataModel.Segments.getAll().filter(seg => {
        if (!seg?.geometry?.coordinates) return false;
        if (seg.hasClosures) return false;
        // Skip segments with null nodes — these are newly split unsaved segments whose
        // nodes haven't been committed yet; calling splitSegment on them throws
        // "node null does not exist" from WME's SplitSegments.getSegmentNodes.
        if (seg.fromNodeId == null || seg.toNodeId == null) return false;
        try { if (!wmeSDK.DataModel.Segments.hasPermissions({ segmentId: seg.id })) return false; } catch (ex) { return false; }
        return seg.geometry.coordinates.some(([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north);
      });
    } catch (ex) { splitVisibleSegments = []; }
  }

  // Stored as named arrow functions so addEventListener / removeEventListener work correctly
  const splitKeyDown = (e) => { if (e.key === 'Escape') exitSplitMode(); };

  const splitOnMouseMove = (e) => {
    try {
      const vp = wmeSDK.Map.getMapViewportElement();
      const rect = vp.getBoundingClientRect();
      const lonLat = wmeSDK.Map.getLonLatFromMapPixel({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (!lonLat) return;
      splitLastMouseMovePoint = lonLat;
      // Throttle to one preview draw per animation frame to eliminate lag
      if (splitPreviewFrameRequest) return;
      splitPreviewFrameRequest = requestAnimationFrame(() => {
        splitPreviewFrameRequest = null;
        drawSplitPreview(splitLastMouseMovePoint);
      });
    } catch (ex) {}
  };

  const splitOnMouseDown = (e) => {
    try {
      const vp = wmeSDK.Map.getMapViewportElement();
      const rect = vp.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const lonLat = wmeSDK.Map.getLonLatFromMapPixel({ x, y });
      if (!lonLat) return;
      splitMouseDownPoint = { lon: lonLat.lon, lat: lonLat.lat, x, y };
    } catch (ex) {}
  };

  const splitOnMouseUp = (e) => {
    if (!splitSegmentToSplit || !splitMouseDownPoint) return;
    try {
      const vp = wmeSDK.Map.getMapViewportElement();
      const rect = vp.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Ignore drags — only act on clean clicks (movement < 5px)
      if (Math.abs(splitMouseDownPoint.x - x) + Math.abs(splitMouseDownPoint.y - y) > 5) return;
      const segToSplit = splitSegmentToSplit;
      const clickPoint = splitMouseDownPoint;
      exitSplitMode();
      performSplit(segToSplit, clickPoint);
    } catch (ex) {}
  };

  const splitOnZoomChanged = () => {
    rebuildSplitSegmentCache();
    try { wmeSDK.Map.removeAllFeaturesFromLayer({ layerName: SPLIT_LAYER_NAME }); } catch (ex) {}
    if (splitLastMouseMovePoint) drawSplitPreview(splitLastMouseMovePoint);
  };

  const splitOnMoveEnd = () => {
    rebuildSplitSegmentCache();
  };

  function drawSplitPreview(lonLat) {
    if (!lonLat) return;
    const mousePoint = turf.point([lonLat.lon, lonLat.lat]);
    let closest = { segment: null, details: null };
    let shortest = Infinity;
    // Use the pre-built cache — no getAll() or hasPermissions() on every frame
    const segments = splitVisibleSegments || [];
    segments.forEach(seg => {
      try {
        const details = turf.nearestPointOnLine(seg.geometry, mousePoint, { units: 'meters' });
        if (details.properties.dist < shortest) {
          closest = { segment: seg, details };
          shortest = details.properties.dist;
        }
      } catch (ex) {}
    });
    try { wmeSDK.Map.removeAllFeaturesFromLayer({ layerName: SPLIT_LAYER_NAME }); } catch (ex) {}
    if (!closest.segment) return;
    splitSegmentToSplit = closest.segment;
    const pointOnLine = closest.details;
    try {
      wmeSDK.Map.addFeaturesToLayer({
        layerName: SPLIT_LAYER_NAME,
        features: [
          {
            type: 'Feature',
            id: `pointCut_${splitSegmentToSplit.id}`,
            geometry: pointOnLine.geometry,
            properties: { featureType: 'splitPoint' },
          },
          {
            type: 'Feature',
            id: `lineCut_${splitSegmentToSplit.id}`,
            geometry: { type: 'LineString', coordinates: [mousePoint.geometry.coordinates, pointOnLine.geometry.coordinates] },
            properties: { featureType: 'splitLine' },
          },
        ],
      });
    } catch (ex) {}
  }

  function enterSplitMode() {
    if (splitEditingLock) return;
    wmeSDK.Editing.clearSelection();
    splitEditingLock = wmeSDK.Editing.lockEditing();
    try {
      wmeSDK.Map.addLayer({
        layerName: SPLIT_LAYER_NAME,
        styleRules: [
          {
            predicate: props => props.featureType === 'splitPoint',
            style: { pointRadius: 6, fillColor: 'white', fillOpacity: 1, strokeColor: '#00ece3', strokeWidth: 3 },
          },
          {
            predicate: props => props.featureType === 'splitLine',
            style: { strokeColor: 'white', strokeDashstyle: '7 5', strokeWidth: 2 },
          },
        ],
      });
    } catch (ex) { log('[Split] addLayer error: ' + ex); }
    const vp = wmeSDK.Map.getMapViewportElement();
    vp.style.cursor = 'crosshair';
    vp.addEventListener('mousemove', splitOnMouseMove);
    vp.addEventListener('mousedown', splitOnMouseDown);
    vp.addEventListener('mouseup', splitOnMouseUp);
    splitUnsubZoom = wmeSDK.Events.on({ eventName: 'wme-map-zoom-changed', eventHandler: splitOnZoomChanged });
    splitUnsubMoveEnd = wmeSDK.Events.on({ eventName: 'wme-map-move-end', eventHandler: splitOnMoveEnd });
    document.body.addEventListener('keydown', splitKeyDown);
    rebuildSplitSegmentCache();
    if (WazeToastr?.Alerts) {
      WazeToastr.Alerts.info(scriptName, 'Split Mode: hover over a segment to preview, click to split. Press <b>Esc</b> to cancel.', false, false, 4000);
    }
  }

  function exitSplitMode() {
    if (!splitEditingLock) return;
    try {
      const vp = wmeSDK.Map.getMapViewportElement();
      vp.style.cursor = '';
      vp.removeEventListener('mousemove', splitOnMouseMove);
      vp.removeEventListener('mousedown', splitOnMouseDown);
      vp.removeEventListener('mouseup', splitOnMouseUp);
    } catch (ex) {}
    if (splitUnsubZoom) { splitUnsubZoom(); splitUnsubZoom = null; }
    if (splitUnsubMoveEnd) { splitUnsubMoveEnd(); splitUnsubMoveEnd = null; }
    if (splitPreviewFrameRequest) { cancelAnimationFrame(splitPreviewFrameRequest); splitPreviewFrameRequest = null; }
    document.body.removeEventListener('keydown', splitKeyDown);
    wmeSDK.Editing.releaseEditingLock({ lockId: splitEditingLock });
    splitEditingLock = null;
    try {
      wmeSDK.Map.removeAllFeaturesFromLayer({ layerName: SPLIT_LAYER_NAME });
      wmeSDK.Map.removeLayer({ layerName: SPLIT_LAYER_NAME });
    } catch (ex) {}
    splitSegmentToSplit = null;
    splitMouseDownPoint = null;
    splitLastMouseMovePoint = null;
    splitVisibleSegments = null;
  }

  function performSplit(segment, mapPoint) {
    if (!segment) return;
    try {
      const mousePoint = turf.point([mapPoint.lon, mapPoint.lat]);
      const splitPoint = turf.nearestPointOnLine(segment.geometry, mousePoint, { units: 'meters' }).geometry;
      wmeSDK.DataModel.Segments.splitSegment({ segmentId: segment.id, splitPoint });
      if (WazeToastr?.Alerts) WazeToastr.Alerts.success(scriptName, 'Segment split!', false, false, 2000);
    } catch (ex) {
      console.error(`[${scriptName}] Split failed:`, ex);
      if (WazeToastr?.Alerts) WazeToastr.Alerts.error(scriptName, 'Split failed: ' + ex.message);
    }
  }

  function toggleSplitMode() {
    if (splitEditingLock) {
      exitSplitMode();
      return;
    }
    const sel = wmeSDK.Editing.getSelection();
    if (sel?.objectType === 'segment' && sel.ids.length > 0) {
      // Segments selected — auto-split each at its midpoint / middle geometry node
      let cutCount = 0;
      sel.ids.forEach(segId => {
        const seg = wmeSDK.DataModel.Segments.getById({ segmentId: segId });
        if (!seg || seg.junctionId) return;
        // Skip segments with null nodes (newly split unsaved segments) to prevent
        // "node null does not exist" on a second split without saving.
        if (seg.fromNodeId == null || seg.toNodeId == null) return;
        try { if (!wmeSDK.DataModel.Segments.hasPermissions({ segmentId: segId })) return; } catch (ex) { return; }
        const geo = seg.geometry;
        if (geo.coordinates.length < 2) return;
        let splitCoord;
        if (geo.coordinates.length === 2) {
          splitCoord = [
            (geo.coordinates[0][0] + geo.coordinates[1][0]) / 2,
            (geo.coordinates[0][1] + geo.coordinates[1][1]) / 2,
          ];
        } else {
          splitCoord = geo.coordinates[Math.ceil(geo.coordinates.length / 2 - 1)];
        }
        try {
          const result = wmeSDK.DataModel.Segments.splitSegment({
            segmentId: seg.id,
            splitPoint: turf.point(splitCoord).geometry,
          });
          if (result) cutCount++;
        } catch (ex) { console.error(`[${scriptName}] Auto-split failed for ${seg.id}:`, ex); }
      });
      if (cutCount > 0) {
        if (WazeToastr?.Alerts) WazeToastr.Alerts.success(scriptName, `${cutCount} segment${cutCount === 1 ? '' : 's'} split`, false, false, 2500);
      } else {
        if (WazeToastr?.Alerts) WazeToastr.Alerts.warning(scriptName, 'Selected segment(s) could not be split', false, false, 3000);
      }
    } else {
      // Nothing selected — enter interactive split mode
      enterSplitMode();
    }
  }

  // ===== End Segment Splitter Feature =====
  
  // ===== Lane Count Update Buttons =====
  /**
   * Updates the number of lanes (road width) for all given segment IDs.
   * Sets both fromLanesInfo and toLanesInfo to the specified count.
   */
  function handleLaneCountUpdate(segmentIds, laneCount) {
    if (!segmentIds || segmentIds.length === 0) {
      log('[LaneCount] No segments to update');
      return;
    }
    
    let successCount = 0;
    const totalCount = segmentIds.length;
    
    segmentIds.forEach((id) => {
      try {
        const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
        if (!seg) {
          log(`[LaneCount] Segment ${id} not found`);
          return;
        }
        // Pass null to clear both directions when laneCount is 0
        wmeSDK.DataModel.Segments.updateSegment({
          segmentId: id,
          fromLanesInfo: laneCount > 0 ? { numberOfLanes: laneCount, laneWidth: null } : null,
          toLanesInfo: laneCount > 0 ? { numberOfLanes: laneCount, laneWidth: null } : null,
        });
        successCount++;
        log(`[LaneCount] Set numberOfLanes=${laneCount} for segment ${id} (road width)`);
      } catch (e) {
        log(`[LaneCount] Error updating segment ${id}: ${e.message}`);
      }
    });
    
    if (WazeToastr?.Alerts) {
      if (successCount === totalCount) {
        WazeToastr.Alerts.success(`${scriptName}`, `Road width set to ${laneCount} lane(s) for ${successCount} segment(s).`, false, false, 2000);
      } else if (successCount > 0) {
        WazeToastr.Alerts.warning(`${scriptName}`, `Road width set to ${laneCount} lane(s) for ${successCount}/${totalCount} segment(s).`, false, false, 3000);
      } else {
        WazeToastr.Alerts.error(`${scriptName}`, 'Failed to update road width.', false, false, 3000);
      }
    }
  }

  /**
   * Creates or refreshes the lane count button row in the segment edit panel.
   * Inserted between the HOV chip container and the routing road type control.
   */
  function addLaneCountButtons() {
    const options = getOptions();
    if (!options.updateLanes) {
      // Remove existing lane buttons container if present
      const existing = document.getElementById('ezroad-lane-buttons');
      if (existing) existing.remove();
      return;
    }
    
    // Avoid duplicates
    if (document.getElementById('ezroad-lane-buttons')) return;
    
    const editGeneral = document.querySelector('#segment-edit-general');
    if (!editGeneral) return;
    
    //const routingControl = editGeneral.querySelector('.routing-road-type-control');
    const routingControl = editGeneral.querySelector('.controls.roadDetailsFlags--h4KVD');
    if (!routingControl) return;
    
    // Create container
    const container = document.createElement('div');
    container.id = 'ezroad-lane-buttons';
    container.className = 'ezroad-lane-buttons-container';
    
    // Label
    const label = document.createElement('span');
    label.className = 'ezroad-lane-label';
    label.textContent = 'Lanes:';
    container.appendChild(label);
    
    // Add 'Multiple' chip for mixed selection (similar to WME lock level selector)
    const mixedChip = document.createElement('wz-checkable-chip');
    mixedChip.className = 'ezroad-lane-chip';
    mixedChip.textContent = 'Multiple';
    mixedChip.setAttribute('size', 'md');
    mixedChip.setAttribute('value', 'MIXED');
    mixedChip.setAttribute('read-only', '');
    mixedChip.setAttribute('title', 'No of Lane Road width');
    mixedChip.style.display = 'none'; // hidden until mixed selection detected
    container.appendChild(mixedChip);
    
    // Create chips 0-8 matching WME's lock rank chip style
    for (let i = 0; i <= 8; i++) {
      const chip = document.createElement('wz-checkable-chip');
      chip.className = 'ezroad-lane-chip';
      chip.textContent = String(i);
      chip.setAttribute('size', 'md');
      chip.setAttribute('value', String(i));
      chip.setAttribute('title', 'No of Lane Road width');
      
      chip.addEventListener('click', () => {
        const selection = wmeSDK.Editing.getSelection();
        if (!selection || selection.objectType !== 'segment' || !selection.ids || selection.ids.length === 0) {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(`${scriptName}`, 'No segments selected.', false, false, 2000);
          }
          return;
        }
        handleLaneCountUpdate(selection.ids, i);
        
        // Programmatic reselect (clearSelection → setSelection) triggers the
        // wme-selection-changed event, which calls updateLaneChipHighlight()
        // automatically — same as manually deselecting and reselecting.
        // A small delay ensures the SDK has processed the updateSegment call.
        setTimeout(() => {
          try {
            const currentSelection = wmeSDK.Editing.getSelection();
            if (currentSelection && currentSelection.objectType === 'segment') {
              wmeSDK.Editing.clearSelection();
              wmeSDK.Editing.setSelection({ selection: currentSelection });
            }
          } catch (e) {
            log(`[LaneCount] Reselect error: ${e.message}`);
          }
        }, 50);
      });
      
      container.appendChild(chip);
    }
    
    // Insert after routing road type control
    routingControl.parentNode.insertBefore(container, routingControl.nextSibling);
    
    // Highlight the chip matching the currently selected segment's lane width
    updateLaneChipHighlight();
    
    log('[LaneCount] Lane count buttons added to edit panel');
  }

  /**
   * Updates the chip highlight to reflect the currently selected segment's lane width.
   */
  function updateLaneChipHighlight() {
    const container = document.getElementById('ezroad-lane-buttons');
    if (!container) return;
    
    const selection = wmeSDK.Editing.getSelection();
    if (!selection || selection.objectType !== 'segment' || !selection.ids || selection.ids.length === 0) {
      return;
    }
    
    // Determine the lane count for each selected segment and check if they differ
    function getLaneCount(seg) {
      if (seg.fromLanesInfo && seg.fromLanesInfo.numberOfLanes !== null && seg.fromLanesInfo.numberOfLanes !== undefined) {
        return seg.fromLanesInfo.numberOfLanes;
      }
      if (seg.toLanesInfo && seg.toLanesInfo.numberOfLanes !== null && seg.toLanesInfo.numberOfLanes !== undefined) {
        return seg.toLanesInfo.numberOfLanes;
      }
      return 0; // null/undefined treated as 0
    }
    
    // Check if multiple segments have different lane counts
    let uniqueCounts = new Set();
    let targetLaneCount = null;
    let isMixed = false;
    
    for (let id of selection.ids) {
      const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
      if (!seg) continue;
      const count = getLaneCount(seg);
      uniqueCounts.add(count);
      if (targetLaneCount === null) targetLaneCount = count;
    }
    
    if (uniqueCounts.size > 1) {
      isMixed = true;
    }
    
    // Clear all highlights first
    container.querySelectorAll('wz-checkable-chip.ezroad-lane-chip').forEach((c) => c.removeAttribute('checked'));
    
    // Show/hide the 'Multiple' chip based on mixed detection
    const mixedChip = container.querySelector('wz-checkable-chip.ezroad-lane-chip[value="MIXED"]');
    
    if (isMixed) {
      if (mixedChip) {
        mixedChip.style.display = '';
        mixedChip.setAttribute('checked', '');
      }
    } else {
      if (mixedChip) mixedChip.style.display = 'none';
      
      // Highlight the specific number chips 0-8 
      if (targetLaneCount !== null && targetLaneCount >= 0 && targetLaneCount <= 8) {
        const targetChip = container.querySelector(`wz-checkable-chip.ezroad-lane-chip[value="${targetLaneCount}"]`);
        if (targetChip) targetChip.setAttribute('checked', '');
      }
    }
  }
  // ===== End Lane Count Update Buttons =====

  const getEmptyCity = () => {
    return (
      wmeSDK.DataModel.Cities.getCity({
        cityName: '',
        countryId: getCurrentCountry().id,
      }) ||
      wmeSDK.DataModel.Cities.addCity({
        cityName: '',
        countryId: getCurrentCountry().id,
      })
    );
  };

  const delayedUpdate = (updateFn, delay) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        updateFn();
        resolve();
      }, delay);
    });
  };

  function getHighestSegLock(segID) {
    const segObj = wmeSDK.DataModel.Segments.getById({ segmentId: segID });
    if (!segObj) {
      console.warn(`[${scriptName}] Segment object with ID ${segID} not found in DataModel.Segments.`);
      return 1; // Default lock level if segment not found
    }
    const segType = segObj.roadType;
    const checkedSegs = [];
    let forwardLock = null;
    let reverseLock = null;

    function processForNode(forwardID) {
      checkedSegs.push(forwardID);
      const seg = wmeSDK.DataModel.Segments.getById({ segmentId: forwardID });
      if (!seg) return forwardLock;
      const forNodeId = seg.toNodeId;
      if (!forNodeId) return forwardLock;

      // Get all segments connected to this node
      const allSegs = wmeSDK.DataModel.Segments.getAll();
      const forNodeSegs = allSegs.filter((s) => s.fromNodeId === forNodeId || s.toNodeId === forNodeId).map((s) => s.id);

      // Remove the current segment from the list
      const filteredSegs = forNodeSegs.filter((id) => id !== forwardID);

      for (let i = 0; i < filteredSegs.length; i++) {
        const conSegObj = wmeSDK.DataModel.Segments.getById({
          segmentId: filteredSegs[i],
        });
        if (!conSegObj) continue;
        if (conSegObj.roadType !== segType) {
          forwardLock = Math.max(conSegObj.lockRank ?? 0, forwardLock ?? 0);
        } else {
          if (!checkedSegs.includes(conSegObj.id)) {
            const tempRank = processForNode(conSegObj.id);
            forwardLock = Math.max(tempRank ?? 0, forwardLock ?? 0);
          }
        }
      }
      return forwardLock ?? 0;
    }

    function processRevNode(reverseID) {
      checkedSegs.push(reverseID);
      const seg = wmeSDK.DataModel.Segments.getById({ segmentId: reverseID });
      if (!seg) return reverseLock;
      const revNodeId = seg.fromNodeId;
      if (!revNodeId) return reverseLock;

      // Get all segments connected to this node
      const allSegs = wmeSDK.DataModel.Segments.getAll();
      const revNodeSegs = allSegs.filter((s) => s.fromNodeId === revNodeId || s.toNodeId === revNodeId).map((s) => s.id);

      // Remove the current segment from the list
      const filteredSegs = revNodeSegs.filter((id) => id !== reverseID);

      for (let i = 0; i < filteredSegs.length; i++) {
        const conSegObj = wmeSDK.DataModel.Segments.getById({
          segmentId: filteredSegs[i],
        });
        if (!conSegObj) continue;
        if (conSegObj.roadType !== segType) {
          reverseLock = Math.max(conSegObj.lockRank ?? 0, reverseLock ?? 0);
        } else {
          if (!checkedSegs.includes(conSegObj.id)) {
            const tempRank = processRevNode(conSegObj.id);
            reverseLock = Math.max(tempRank ?? 0, reverseLock ?? 0);
          }
        }
      }
      return reverseLock ?? 0;
    }

    let calculatedLock = Math.max(processForNode(segID), processRevNode(segID));
    return Math.min(calculatedLock, 6); // Limit to L6
  }

  function pushCityNameAlert(cityId, alertMessageParts) {
    let cityName = '';
    if (cityId) {
      try {
        const city = wmeSDK.DataModel.Cities.getById({ cityId });
        // Ensure city is fully loaded before accessing name
        cityName = city && city.name !== undefined ? city.name : '';
      } catch (e) {
        log(`[${scriptName}] Error getting city name for cityId ${cityId}: ${e}`);
        cityName = '';
      }
    }
    alertMessageParts.push(`City Name: <b>${cityName || 'None'}</b>`);
  }

  // Helper: Returns true if the roadType is non-drivable (Footpath, Pedestrianised Area, Stairway, Ferry, Railway, Runway)
  // Uses the WME SDK's isRoadTypeDrivable method which is more reliable and future-proof
  function isNonDrivableType(roadType) {
    try {
      return !wmeSDK.DataModel.Segments.isRoadTypeDrivable({ roadType });
    } catch (e) {
      // Fallback: hardcoded list if SDK method fails (e.g., during early init)
      return [5, 10, 16, 15, 18, 19].includes(roadType);
    }
  }

  // Helper: Enable all turns at both nodes of a segment for routable road types
  function enableAllTurnsForSegment(segmentId) {
    try {
      const seg = wmeSDK.DataModel.Segments.getById({ segmentId });
      if (!seg || isNonDrivableType(seg.roadType)) {
        log(`[${scriptName}] Skipping turn enablement for non-routable segment ${segmentId}`);
        return;
      }

      const nodes = [seg.fromNodeId, seg.toNodeId].filter(nodeId => nodeId !== null);
      
      nodes.forEach(nodeId => {
        try {
          // Check if we can edit turns at this node
          if (!wmeSDK.DataModel.Turns.canEditTurnsThroughNode({ nodeId })) {
            log(`[${scriptName}] Cannot edit turns at node ${nodeId}`);
            return;
          }

          // Get all turns through the node
          const turns = wmeSDK.DataModel.Turns.getTurnsThroughNode({ nodeId });
          
          // Enable all turns that aren't already allowed
          turns.forEach(turn => {
            try {
              if (!turn.isAllowed) {
                wmeSDK.DataModel.Turns.updateTurn({ 
                  turnId: turn.id, 
                  isAllowed: true 
                });
                log(`[${scriptName}] Enabled turn ${turn.id} at node ${nodeId}`);
              }
            } catch (turnError) {
              log(`[${scriptName}] Could not enable turn ${turn.id}: ${turnError.message}`);
            }
          });
        } catch (nodeError) {
          log(`[${scriptName}] Error processing turns at node ${nodeId}: ${nodeError.message}`);
        }
      });
      
      log(`[${scriptName}] Completed turn enablement for segment ${segmentId}`);
    } catch (error) {
      console.error(`[${scriptName}] Error enabling turns for segment ${segmentId}:`, error);
    }
  }

  // Helper: If switching between pedestrian and non-pedestrian types, delete and recreate the segment
  function recreateSegmentIfNeeded(segmentId, targetRoadType, copyConnectedNameData) {
    const seg = wmeSDK.DataModel.Segments.getById({ segmentId });
    if (!seg) {
      log(`[${scriptName}] Segment ${segmentId} not found`);
      return segmentId;
    }

    const currentIsPed = isNonDrivableType(seg.roadType);
    const targetIsPed = isNonDrivableType(targetRoadType);

    if (currentIsPed !== targetIsPed) {
      // Show confirmation dialog before swapping
      let swapMsg = currentIsPed
        ? 'You are about to convert a Pedestrian type segment (Footpath, Pedestrianised Area, or Stairway) to a regular street type. This will delete and recreate the segment. Continue?'
        : 'You are about to convert a regular street segment to a Pedestrian type (Footpath, Pedestrianised Area, or Stairway). This will delete and recreate the segment. Continue?';
      
      // Define the recreation logic as a function to avoid duplication
      const performRecreation = () => {
        try {
        // Save geometry and address
        const geometry = seg.geometry;
        const oldPrimaryStreetId = seg.primaryStreetId;
        const oldAltStreetIds = Array.isArray(seg.alternateStreetIds) ? seg.alternateStreetIds : [];
        
        log(`[${scriptName}] Deleting segment ${segmentId} for road type conversion`);
        
        // Delete old segment
        try {
          wmeSDK.DataModel.Segments.deleteSegment({ segmentId });
        } catch (ex) {
          const errorMsg = 'Segment could not be deleted. Please check for restrictions or junctions.';
          log(`[${scriptName}] Delete failed: ${ex.message}`);
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.error(scriptName, errorMsg);
          } else {
            alert(errorMsg);
          }
          return null;
        }

        // Create new segment
        log(`[${scriptName}] Creating new segment with road type ${targetRoadType}`);
        const newSegmentId = wmeSDK.DataModel.Segments.addSegment({ geometry, roadType: targetRoadType });
        
        if (!newSegmentId) {
          log(`[${scriptName}] Failed to create new segment`);
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.error(scriptName, 'Failed to create new segment');
          }
          return null;
        }

        // Ensure primaryStreetId is valid (not null or undefined)
        let validPrimaryStreetId = oldPrimaryStreetId;
        if (!validPrimaryStreetId) {
          // Use a blank street in the current city
          let segCityId = getTopCity()?.id;
          if (!segCityId) {
            // fallback to country if city is not available
            segCityId = getCurrentCountry()?.id;
          }
          let blankStreet = wmeSDK.DataModel.Streets.getStreet({
            cityId: segCityId,
            streetName: '',
          });
          if (!blankStreet) {
            blankStreet = wmeSDK.DataModel.Streets.addStreet({
              streetName: '',
              cityId: segCityId,
            });
          }
          validPrimaryStreetId = blankStreet.id;
        }

        // Restore address with valid primaryStreetId
        log(`[${scriptName}] Restoring address for new segment ${newSegmentId}`);
        wmeSDK.DataModel.Segments.updateAddress({
          segmentId: newSegmentId,
          addressData: {
            primaryStreetId: validPrimaryStreetId,
            alternateStreetIds: oldAltStreetIds,
          },
        });

        // If we have connected segment name data to copy, apply it now
        if (copyConnectedNameData && copyConnectedNameData.primaryStreetId) {
          log(`[${scriptName}] Applying connected segment name data`);
          wmeSDK.DataModel.Segments.updateAddress({
            segmentId: newSegmentId,
            addressData: {
              primaryStreetId: copyConnectedNameData.primaryStreetId,
              alternateStreetIds: Array.isArray(copyConnectedNameData.alternateStreetIds) ? copyConnectedNameData.alternateStreetIds : [],
            },
          });
        }

        // Reselect new segment
        wmeSDK.Editing.setSelection({ selection: { ids: [newSegmentId], objectType: 'segment' } });

        // If converting from pedestrian to routable, enable all turns
        if (currentIsPed && !targetIsPed) {
          // Use setTimeout to ensure segment is fully created before enabling turns
          setTimeout(() => {
            log(`[${scriptName}] Enabling turns after conversion from pedestrian to routable type`);
            enableAllTurnsForSegment(newSegmentId);
          }, 300);
        }

        log(`[${scriptName}] Successfully recreated segment: ${segmentId} -> ${newSegmentId}`);
        
        // Show success message
        const successMsg = currentIsPed 
          ? 'Segment successfully converted from Pedestrian type to regular street type!'
          : 'Segment successfully converted to Pedestrian type!';
        if (WazeToastr?.Alerts) {
          WazeToastr.Alerts.success(scriptName, successMsg, false, false, 3000);
        } else {
          alert(`${scriptName}: ${successMsg}`);
        }
        
        return newSegmentId;
        
      } catch (error) {
        log(`[${scriptName}] Error during segment recreation: ${error.message}`);
        console.error(`[${scriptName}] Segment recreation error:`, error);
        if (WazeToastr?.Alerts) {
          WazeToastr.Alerts.error(scriptName, `Error recreating segment: ${error.message}`);
        } else {
          alert(`${scriptName}: Error recreating segment: ${error.message}`);
        }
        return null;
      }
      };
      
      // Show confirmation dialog
      if (WazeToastr?.Alerts?.confirm) {
        WazeToastr.Alerts.confirm(
          scriptName,
          swapMsg,
          performRecreation, // OK callback - perform the recreation
          () => {
            // User cancelled
            log(`[${scriptName}] Segment recreation cancelled by user`);
          },
          'Continue',
          'Cancel'
        );
        return undefined; // Return undefined to indicate async dialog is pending
      } else if (!window.confirm(swapMsg)) {
        log(`[${scriptName}] Segment recreation cancelled by user`);
        return null; // Cancel operation
      }
      
      // For window.confirm (synchronous), perform recreation immediately
      return performRecreation();
    }
    return segmentId;
  }

  // Helper: Ensure WazeActionSetTurn is available (load if needed)
  function ensureWazeActionSetTurnLoaded() {
    if (typeof WazeActionSetTurn === 'function') {
      return true; // Already loaded
    }
    
    try {
      const SetTurnModule = require('Waze/Model/Graph/Actions/SetTurn');
      WazeActionSetTurn = SetTurnModule.default || SetTurnModule;
      log('[EZRoad] WazeActionSetTurn loaded successfully');
      return typeof WazeActionSetTurn === 'function';
    } catch (e) {
      log(`[EZRoad] Failed to load WazeActionSetTurn: ${e.message}`);
      return false;
    }
  }

  // Helper: Count U-turns at a specific node
  // @param {number} nodeId - The node ID
  // @return {{allowed: number, disallowed: number}}
  function countNodeUturns(nodeId) {
    let turns = wmeSDK.DataModel.Turns.getTurnsThroughNode({ nodeId });
    turns = turns.filter((turn) => turn.isUTurn);
    return {
      allowed: turns.filter((turn) => turn.isAllowed).length,
      disallowed: turns.filter((turn) => !turn.isAllowed).length
    };
  }

  // Helper: Count all U-turns in the current map view
  // @return {{nodes: number, allowed: number, disallowed: number}}
  function countAllUturns() {
    let counters = {
      nodes: 0,
      allowed: 0,
      disallowed: 0
    };
    
    try {
      // Get all visible nodes
      const allNodes = wmeSDK.DataModel.Nodes.getNodes();
      
      for (const nodeId in allNodes) {
        const node = allNodes[nodeId];
        if (node && node.connectedSegmentIds && node.connectedSegmentIds.length >= 2) {
          const counter = countNodeUturns(nodeId);
          if (counter.allowed > 0 || counter.disallowed > 0) {
            counters.nodes++;
            counters.allowed += counter.allowed;
            counters.disallowed += counter.disallowed;
          }
        }
      }
    } catch (e) {
      log(`[EZRoad] Error counting U-turns: ${e.message}`);
    }
    
    return counters;
  }

  // Helper: Get the currently selected node using SDK selection API
  function getSelectedNode() {
    try {
      const selection = wmeSDK.Editing.getSelection();
      
      // Check if exactly one node is selected
      if (selection && selection.objectType === 'node' && selection.ids.length === 1) {
        const nodeId = selection.ids[0];
        return { id: nodeId }; // Return object with id property for compatibility
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  // Helper: Create or update U-turn panel when node is selected
  let uTurnPanelContainer = null;
  let createPanelRetry = null; // Retry timeout reference
  
  function createUTurnPanel(retryCount = 0) {
    // Clear any pending retries
    if (createPanelRetry) {
      clearTimeout(createPanelRetry);
      createPanelRetry = null;
    }
    
    // Remove existing panel first
    removeUTurnPanel();
    
    try {
      // Find the connections-edit container in the node panel
      let connectionsContainer = document.querySelector('.connections-edit');
      
      if (!connectionsContainer) {
        log(`[EZRoad] connections-edit container not found (attempt ${retryCount + 1}/5)`);
        
        // Retry up to 5 times with 100ms delays for DOM to update
        if (retryCount < 5) {
          createPanelRetry = setTimeout(() => createUTurnPanel(retryCount + 1), 100);
          return;
        }
        
        log('[EZRoad] Failed to find connections-edit after 5 retries. Available DOM:', 
            document.querySelector('#edit-panel')?.className || 'edit-panel not found');
        return;
      }
      
      const container = document.createElement('div');
      container.id = 'ezroad-uturns-panel';
      container.className = 'ezroad-uturns-container';
      container.style.marginTop = '12px';
      container.style.paddingTop = '12px';
      container.style.borderTop = '1px solid #e0e0e0';
      
      // Title
      const title = document.createElement('p');
      title.innerHTML = '<strong>U-Turns</strong>';
      title.style.margin = '0 0 8px 0';
      title.style.fontSize = '14px';
      container.appendChild(title);
      
      // Counter text
      const counterText = document.createElement('p');
      counterText.id = 'ezroad-uturns-counter-text';
      counterText.style.fontSize = '12px';
      counterText.style.margin = '0 0 8px 0';
      counterText.style.color = 'inherit';
      container.appendChild(counterText);
      
      // Allow button
      const allowBtn = document.createElement('wz-button');
      allowBtn.id = 'ezroad-uturns-allow-btn';
      allowBtn.color = 'shadowed';
      allowBtn.size = 'md';
      allowBtn.innerHTML = 'Allow All U-Turns';
      allowBtn.style.marginBottom = '4px';
      allowBtn.style.display = 'none';
      allowBtn.style.width = '100%';
      allowBtn.addEventListener('click', () => {
        const node = getSelectedNode();
        if (node) switchNodeUturn(node.id, true);
      });
      container.appendChild(allowBtn);
      
      // Disallow button
      const disallowBtn = document.createElement('wz-button');
      disallowBtn.id = 'ezroad-uturns-disallow-btn';
      disallowBtn.color = 'shadowed';
      disallowBtn.size = 'md';
      disallowBtn.innerHTML = 'Disallow All U-Turns';
      disallowBtn.style.display = 'none';
      disallowBtn.style.width = '100%';
      disallowBtn.addEventListener('click', () => {
        const node = getSelectedNode();
        if (node) switchNodeUturn(node.id, false);
      });
      container.appendChild(disallowBtn);
      
      // Append to connections container
      connectionsContainer.appendChild(container);
      uTurnPanelContainer = container;
      log('[EZRoad] U-turn panel created successfully');
      updateUTurnPanel();
    } catch (e) {
      log(`[EZRoad] Error creating U-turn panel: ${e.message}`);
    }
  }

  // Helper: Remove U-turn panel
  function removeUTurnPanel() {
    // Clear any pending retry timeouts
    if (createPanelRetry) {
      clearTimeout(createPanelRetry);
      createPanelRetry = null;
    }
    
    const panel = document.querySelector('#ezroad-uturns-panel');
    if (panel) {
      panel.remove();
      uTurnPanelContainer = null;
    }
  }

  // Helper: Update U-turn panel counter and button visibility
  function updateUTurnPanel() {
    try {
      const node = getSelectedNode();
      if (!node || !uTurnPanelContainer) return;
      
      const counter = countNodeUturns(node.id);
      const counterText = document.getElementById('ezroad-uturns-counter-text');
      const allowBtn = document.getElementById('ezroad-uturns-allow-btn');
      const disallowBtn = document.getElementById('ezroad-uturns-disallow-btn');
      
      if (counterText) {
        counterText.innerHTML = `Allowed: ${counter.allowed}<br/>Disallowed: ${counter.disallowed}`;
      }
      
      // Show allow button only if there are disallowed U-turns
      if (allowBtn) allowBtn.style.display = counter.disallowed > 0 ? 'flex' : 'none';
      // Show disallow button only if there are allowed U-turns
      if (disallowBtn) disallowBtn.style.display = counter.allowed > 0 ? 'flex' : 'none';
    } catch (e) {
      log(`[EZRoad] Error updating U-turn panel: ${e.message}`);
    }
  }

  // Helper: Allow/Disallow all U-turns at a selected node
  function switchNodeUturn(nodeId, status) {
    if (!nodeId) {
      log('[EZRoad] switchNodeUturn: No nodeId provided');
      return { success: false, message: 'No node selected' };
    }
    
    // Ensure WazeActionSetTurn is available
    if (!ensureWazeActionSetTurnLoaded()) {
      log('[EZRoad] switchNodeUturn: Could not load WazeActionSetTurn');
      return { success: false, message: 'WazeActionSetTurn not available. Please wait for WME to fully load and try again.' };
    }
    
    if (!wmeSDK.DataModel.Turns.canEditTurnsThroughNode({ nodeId })) {
      log(`[EZRoad] switchNodeUturn: Cannot edit turns at node ${nodeId}`);
      return { success: false, message: 'Cannot edit turns at this node' };
    }
    
    let turns = wmeSDK.DataModel.Turns.getTurnsThroughNode({ nodeId });
    turns = turns.filter((turn) => turn.isUTurn);
    turns = turns.filter((turn) => turn.isAllowed !== status);
    
    if (turns.length === 0) {
      log(`[EZRoad] Node ${nodeId}: all U-turns are already ${status ? 'ALLOWED' : 'DISALLOWED'}`);
      return { success: true, message: `All U-turns already ${status ? 'allowed' : 'disallowed'}`, count: 0 };
    }
    
    // Use W model with SDK node ID
    try {
      if (typeof W === 'undefined' || !W.model || !W.model.getTurnGraph || !W.model.actionManager) {
        log('[EZRoad] switchNodeUturn: W model not available');
        return { success: false, message: 'W model not available' };
      }
      
      const wNode = W.model.nodes.getObjectById(nodeId);
      if (!wNode) {
        log(`[EZRoad] switchNodeUturn: Could not get W model node ${nodeId}`);
        return { success: false, message: 'Could not retrieve node' };
      }
      
      let successCount = 0;
      for (let i = 0; i < turns.length; i++) {
        let turn = turns[i];
        const wSeg = W.model.segments.getObjectById(turn.fromSegmentId);
        if (wSeg) {
          const wTurn = W.model.getTurnGraph().getTurnThroughNode(wNode, wSeg, wSeg);
          if (wTurn) {
            W.model.actionManager.add(
              new WazeActionSetTurn(
                W.model.getTurnGraph(),
                wTurn.withTurnData(wTurn.getTurnData().withState(status ? 1 : 0)) // 1 = ALLOW, 0 = DISALLOW
              )
            );
            successCount++;
            log(`[EZRoad] Turn ${turn.id} switched to ${status ? 'ALLOW' : 'DISALLOW'}`);
          }
        }
      }
      
      updateUTurnPanel();
      return { success: true, message: `${successCount} U-turns ${status ? 'allowed' : 'disallowed'}`, count: successCount };
    } catch (e) {
      log(`[EZRoad] Error switching node U-turns: ${e.message}`);
      updateUTurnPanel();
      return { success: false, message: `Error: ${e.message}` };
    }
  }

  // Helper: Toggle U-turn for a specific segment direction (checks current state, then flips)
  function switchSegmentUturn(segmentId, direction = 'A') {
    if (!segmentId) {
      log('[EZRoad] switchSegmentUturn: No segmentId provided');
      return { success: false, message: 'No segment provided' };
    }
    
    // Ensure WazeActionSetTurn is available
    if (!ensureWazeActionSetTurnLoaded()) {
      log('[EZRoad] switchSegmentUturn: Could not load WazeActionSetTurn');
      return { success: false, message: 'WazeActionSetTurn not available. Please wait for WME to fully load and try again.' };
    }
    
    const segment = wmeSDK.DataModel.Segments.getById({ segmentId });
    if (!segment) {
      log(`[EZRoad] switchSegmentUturn: Segment ${segmentId} not found`);
      return { success: false, message: 'Segment not found' };
    }
    
    if (!segment.isTwoWay) {
      log(`[EZRoad] switchSegmentUturn: Segment ${segmentId} is not two-way`);
      return { success: false, message: 'Segment is not two-way' };
    }
    
    const nodeId = direction === 'A' ? segment.fromNodeId : segment.toNodeId;
    if (!nodeId) {
      log(`[EZRoad] switchSegmentUturn: No node at direction ${direction}`);
      return { success: false, message: `No node at direction ${direction}` };
    }
    
    if (!wmeSDK.DataModel.Turns.canEditTurnsThroughNode({ nodeId })) {
      log(`[EZRoad] switchSegmentUturn: Cannot edit turns at node ${nodeId}`);
      return { success: false, message: 'Cannot edit turns at this node' };
    }
    
    // Get current state
    let isCurrentlyAllowed = wmeSDK.DataModel.Turns.isTurnAllowed({ fromSegmentId: segmentId, nodeId: nodeId, toSegmentId: segmentId });
    let newStatus = !isCurrentlyAllowed; // Toggle
    
    let turns = wmeSDK.DataModel.Turns.getTurnsThroughNode({ nodeId });
    turns = turns.filter((turn) => turn.isUTurn);
    turns = turns.filter((turn) => turn.fromSegmentId === segmentId && turn.toSegmentId === segmentId);
    
    if (turns.length === 0) {
      log(`[EZRoad] switchSegmentUturn: No U-turn found at segment ${segmentId} direction ${direction}`);
      return { success: false, message: 'No U-turn found' };
    }
    
    // Use W model with SDK node ID
    try {
      if (typeof W === 'undefined' || !W.model || !W.model.getTurnGraph || !W.model.actionManager) {
        log('[EZRoad] switchSegmentUturn: W model not available');
        return { success: false, message: 'W model not available' };
      }
      
      const wSeg = W.model.segments.getObjectById(segmentId);
      const wNode = W.model.nodes.getObjectById(nodeId);
      
      if (!wSeg || !wNode) {
        log(`[EZRoad] switchSegmentUturn: Could not get W model objects`);
        return { success: false, message: 'Could not retrieve W model objects' };
      }
      
      const turn = W.model.getTurnGraph().getTurnThroughNode(wNode, wSeg, wSeg);
      if (!turn) {
        log(`[EZRoad] switchSegmentUturn: Could not get turn through node`);
        return { success: false, message: 'Could not retrieve turn' };
      }
      
      W.model.actionManager.add(
        new WazeActionSetTurn(
          W.model.getTurnGraph(),
          turn.withTurnData(turn.getTurnData().withState(newStatus ? 1 : 0)) // 1 = ALLOW, 0 = DISALLOW (toggle)
        )
      );
      
      log(`[EZRoad] U-turn at segment ${segmentId} direction ${direction} toggled to ${newStatus ? 'ALLOW' : 'DISALLOW'}`);
      updateUTurnPanel();
      return { success: true, message: `U-turn toggled to ${newStatus ? 'allowed' : 'disallowed'}`, count: 1 };
    } catch (e) {
      log(`[EZRoad] Error toggling segment U-turn: ${e.message}`);
      updateUTurnPanel();
      return { success: false, message: `Error: ${e.message}` };
    }
  }

  const handleUpdate = () => {
    const selection = wmeSDK.Editing.getSelection();

    if (!selection || selection.objectType !== 'segment') return;

    // Ensure segments are loaded before processing
    try {
      // Validate that segments exist and are accessible
      for (let id of selection.ids) {
        const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
        if (!seg) {
          log(`Segment ${id} not fully loaded, waiting...`);
          // Retry after a short delay
          setTimeout(() => handleUpdate(), 200);
          return;
        }
      }
    } catch (e) {
      log(`[${scriptName}] Error validating segments: ${e}`);
      return;
    }

    log(`[${scriptName}] Updating RoadType`);
    const options = getOptions();
    let alertMessageParts = [];
    let updatedRoadType = false;
    let updatedLockLevel = false;
    let updatedSpeedLimit = false;
    let updatedPaved = false;
    let updatedCityName = false;
    let updatedSegmentName = false;
    let updatedUTurn = false;
    const updatePromises = [];

    // If copySegmentAttributes is checked, copy all attributes from a connected segment
    if (options.copySegmentAttributes && !window.suppressCopySegmentAttributes) {
      selection.ids.forEach((id) => {
        updatePromises.push(
          delayedUpdate(() => {
            try {
              const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
              const fromNode = seg.fromNodeId;
              const toNode = seg.toNodeId;
              const connectedSegIds = getConnectedSegmentIDs(id);
              // Gather all segments connected to both nodes (excluding self)
              const fromNodeSegs = connectedSegIds.map((sid) => wmeSDK.DataModel.Segments.getById({ segmentId: sid })).filter((s) => s && (s.fromNodeId === fromNode || s.fromNodeId === toNode || s.toNodeId === fromNode || s.toNodeId === toNode) && s.id !== id);
              // Prefer the first fromNode segment with a valid primary street name (and optionally other attributes)
              let preferredSeg = fromNodeSegs.find((s) => {
                if (!s) return false;
                const street = wmeSDK.DataModel.Streets.getById({ streetId: s.primaryStreetId });
                return street && street.name;
              });
              let segsToTry = [];
              if (preferredSeg) {
                segsToTry.push(preferredSeg.id);
                // Add the rest, excluding preferredSeg.id
                segsToTry = segsToTry.concat(connectedSegIds.filter((cid) => cid !== preferredSeg.id));
              } else {
                segsToTry = connectedSegIds;
              }
              let found = false;
              for (let connectedSegId of segsToTry) {
                const connectedSeg = wmeSDK.DataModel.Segments.getById({ segmentId: connectedSegId });
                if (!connectedSeg) continue;
                const street = wmeSDK.DataModel.Streets.getById({ streetId: connectedSeg.primaryStreetId });
                if (street && street.name) {
                  try {
                    wmeSDK.DataModel.Segments.updateSegment({
                      segmentId: id,
                      fwdSpeedLimit: connectedSeg.fwdSpeedLimit,
                      revSpeedLimit: connectedSeg.revSpeedLimit,
                      roadType: connectedSeg.roadType,
                      lockRank: connectedSeg.lockRank,
                      elevationLevel: connectedSeg.elevationLevel,
                      direction: getDirectionFromSegment(connectedSeg),
                    });
                  } catch (updateError) {
                    log(`[${scriptName}] updateSegment error (will retry with individual properties): ` + updateError);
                    // Fallback: try updating properties individually
                    const propsToTry = [
                      { name: 'fwdSpeedLimit', value: connectedSeg.fwdSpeedLimit },
                      { name: 'revSpeedLimit', value: connectedSeg.revSpeedLimit },
                      { name: 'roadType', value: connectedSeg.roadType },
                      { name: 'lockRank', value: connectedSeg.lockRank },
                      { name: 'elevationLevel', value: connectedSeg.elevationLevel },
                      { name: 'direction', value: getDirectionFromSegment(connectedSeg) },
                    ];
                    for (let prop of propsToTry) {
                      try {
                        if (prop.value !== undefined && prop.value !== null) {
                          const updateObj = { segmentId: id };
                          updateObj[prop.name] = prop.value;
                          wmeSDK.DataModel.Segments.updateSegment(updateObj);
                        }
                      } catch (e) {
                        log(`[${scriptName}] Failed to update ${prop.name}: ` + e);
                      }
                    }
                  }
                  try {
                    wmeSDK.DataModel.Segments.updateAddress({
                      segmentId: id,
                      addressData: {
                        primaryStreetId: connectedSeg.primaryStreetId,
                        alternateStreetIds: connectedSeg.alternateStreetIds || [],
                      },
                    });
                  } catch (addrError) {
                    log(`[${scriptName}] updateAddress error: ` + addrError);
                  }
                  // Copy all flag attributes
                  copyFlagAttributes(connectedSeg.id, id);
                  alertMessageParts.push(`[${scriptName}] Copied all attributes from connected segment.`);
                  found = true;
                  break;
                }
              }
              // If no connected segment with valid street name was found, fallback to any connected segment (like the other logic)
              if (!found) {
                let fallbackSegId = null;
                const segObj = wmeSDK.DataModel.Segments.getById({ segmentId: id });
                const fromNode = segObj.fromNodeId;
                const toNode = segObj.toNodeId;
                const allSegs = wmeSDK.DataModel.Segments.getAll();
                for (let s of allSegs) {
                  if (s.id !== id && (s.fromNodeId === fromNode || s.toNodeId === fromNode || s.fromNodeId === toNode || s.toNodeId === toNode)) {
                    fallbackSegId = s.id;
                    break;
                  }
                }
                if (fallbackSegId) {
                  const connectedSeg = wmeSDK.DataModel.Segments.getById({ segmentId: fallbackSegId });
                  try {
                    wmeSDK.DataModel.Segments.updateSegment({
                      segmentId: id,
                      fwdSpeedLimit: connectedSeg.fwdSpeedLimit,
                      revSpeedLimit: connectedSeg.revSpeedLimit,
                      roadType: connectedSeg.roadType,
                      lockRank: connectedSeg.lockRank,
                      elevationLevel: connectedSeg.elevationLevel,
                      direction: getDirectionFromSegment(connectedSeg),
                    });
                  } catch (updateError) {
                    log(`[${scriptName}] updateSegment error in fallback (will retry with individual properties): ` + updateError);
                    // Fallback: try updating properties individually
                    const propsToTry = [
                      { name: 'fwdSpeedLimit', value: connectedSeg.fwdSpeedLimit },
                      { name: 'revSpeedLimit', value: connectedSeg.revSpeedLimit },
                      { name: 'roadType', value: connectedSeg.roadType },
                      { name: 'lockRank', value: connectedSeg.lockRank },
                      { name: 'elevationLevel', value: connectedSeg.elevationLevel },
                      { name: 'direction', value: getDirectionFromSegment(connectedSeg) },
                    ];
                    for (let prop of propsToTry) {
                      try {
                        if (prop.value !== undefined && prop.value !== null) {
                          const updateObj = { segmentId: id };
                          updateObj[prop.name] = prop.value;
                          wmeSDK.DataModel.Segments.updateSegment(updateObj);
                        }
                      } catch (e) {
                        log(`[${scriptName}] Failed to update ${prop.name}: ` + e);
                      }
                    }
                  }
                  try {
                    wmeSDK.DataModel.Segments.updateAddress({
                      segmentId: id,
                      addressData: {
                        primaryStreetId: connectedSeg.primaryStreetId,
                        alternateStreetIds: connectedSeg.alternateStreetIds || [],
                      },
                    });
                  } catch (addrError) {
                    log(`[${scriptName}] updateAddress error in fallback: ` + addrError);
                  }
                  // Copy all flag attributes
                  copyFlagAttributes(connectedSeg.id, id);
                  alertMessageParts.push(`[${scriptName}] Copied all attributes from connected segment.`);
                  log(`[${scriptName}] Copied all attributes from connected segment (fallback, no valid street name).`);
                } else {
                  alertMessageParts.push(`[${scriptName}] No connected segment found to copy attributes.`);
                }
              }
            } catch (error) {
              console.error(`[${scriptName}] Error copying all attributes:`, error);
            }
          }, 100)
        );
      });
      Promise.all(updatePromises).then(() => {
        if (alertMessageParts.length) {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.info(`${scriptName}`, alertMessageParts.join('<br>'), false, false, 5000);
          } else {
            alert(`${scriptName} ` + alertMessageParts.join('\n'));
          }
        }
        // --- AUTOSAVE LOGIC HERE ---
        if (options.autosave) {
          setTimeout(() => {
            log(`[${scriptName}] Delayed Autosave starting...`);
            wmeSDK.Editing.save().then(() => {
              log(`[${scriptName}] Delayed Autosave completed.`);
            });
          }, 600);
        }
      });
      return;
    }

    // Apply motorbike restriction ONCE for all selected segments (before individual updates)
    let motorcycleRestrictionApplied = false;
    if (options.restrictExceptMotorbike) {
      log(`[${scriptName}] Applying motorbike restriction to all selected segments via UI automation...`);
      applyMotorbikeOnlyRestriction(selection.ids[0]).then((result) => {
        if (result === true) {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(
              `${scriptName}`,
              `Motorbike-only restriction applied to ${selection.ids.length} segment(s) ✓`,
              false,
              false,
              3000
            );
          }
        } else if (result === 'not_supported') {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.warning(
              `${scriptName} Motorbike Restriction - Automation Failed`,
              `The UI automation could not complete. Please add manually:<br><br>` +
              `<b>Steps:</b><br>` +
              `1. Keep segment(s) selected<br>` +
              `2. Click "Restrictions" in left panel<br>` +
              `3. Click "Add new" under "2 way"<br>` +
              `4. Select "Entire Segment"<br>` +
              `5. Add "Vehicle type" → "Motorcycle"<br>` +
              `6. Click "Add" then "Apply"`,
              false,
              false,
              10000
            );
          }
        }
      }).catch((error) => {
        console.error(`[${scriptName}] Error applying motorbike restriction:`, error);
      });
      motorcycleRestrictionApplied = true;
    }

    // Flag to track if we need to wait for async confirmation dialog
    let waitingForConfirmation = false;
    
    selection.ids.forEach((origId, idx) => {
      let id = origId;
      let copyConnectedNameData = null;
      // --- Pedestrian type switching logic ---
      if (options.roadType) {
        // If copySegmentName is enabled and switching Street → Pedestrian, prefetch connected segment name
        const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
        const currentIsPed = isNonDrivableType(seg.roadType);
        const targetIsPed = isNonDrivableType(options.roadType);
        if (!currentIsPed && targetIsPed && options.copySegmentName) {
          // Find connected segment and store its name info
          const fromNode = seg.fromNodeId;
          const toNode = seg.toNodeId;
          let connectedSegId = null;
          const allSegs = wmeSDK.DataModel.Segments.getAll();
          for (let s of allSegs) {
            if (s.id !== id && (s.fromNodeId === fromNode || s.toNodeId === fromNode || s.fromNodeId === toNode || s.toNodeId === toNode)) {
              connectedSegId = s.id;
              break;
            }
          }
          if (connectedSegId) {
            const connectedSeg = wmeSDK.DataModel.Segments.getById({ segmentId: connectedSegId });
            copyConnectedNameData = {
              primaryStreetId: connectedSeg.primaryStreetId,
              alternateStreetIds: connectedSeg.alternateStreetIds || [],
            };
          }
        }
        const newId = recreateSegmentIfNeeded(id, options.roadType, copyConnectedNameData);
        if (newId === undefined) {
          // Async confirmation dialog is pending - set flag and exit forEach
          waitingForConfirmation = true;
          return;
        }
        if (!newId) return; // If failed or cancelled, skip further updates for this segment
        if (newId !== id) {
          id = newId; // Use the new segment ID for further updates
        }
      }

      // Road Type
      updatePromises.push(
        delayedUpdate(() => {
          if (options.roadType) {
            const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
            const selectedRoad = roadTypes.find((rt) => rt.value === options.roadType);
            //alertMessageParts.push(`Road Type: <b>${selectedRoad.name}</b>`);
            //updatedRoadType = true;
            log(`[${scriptName}] Segment ID: ${id}, Current Road Type: ${seg.roadType}, Target Road Type: ${options.roadType}, Target Road Name : ${selectedRoad.name}`); // Log current and target road type
            if (seg.roadType === options.roadType) {
              log(`[${scriptName}] Segment ID: ${id} already has the target road type: ${options.roadType}. Skipping update.`);
              alertMessageParts.push(`Road Type: <b>${roadTypeName(selectedRoad)} exists. Skipping update.</b>`);
              updatedRoadType = true;
            } else {
              try {
                wmeSDK.DataModel.Segments.updateSegment({
                  segmentId: id,
                  roadType: options.roadType,
                });
                log(`[${scriptName}] Road type updated successfully.`);
                alertMessageParts.push(`Road Type: <b>${roadTypeName(selectedRoad)}</b>`);
                updatedRoadType = true;
              } catch (error) {
                console.error(`[${scriptName}] Error updating road type:`, error);
              }
            }
          }
        }, 200)
      ); // 200ms delay before road type update

      // Set lock if enabled
      updatePromises.push(
        delayedUpdate(() => {
          if (options.setLock) {
            const rank = wmeSDK.State.getUserInfo().rank;
            const selectedRoad = roadTypes.find((rt) => rt.value === options.roadType);
            if (selectedRoad) {
              let lockSetting = options.locks.find((l) => l.id === selectedRoad.id);
              if (lockSetting) {
                let toLock = lockSetting.lock;
                if (toLock === 'HRCS') {
                  toLock = getHighestSegLock(id);
                } else {
                  toLock = parseInt(toLock, 10);
                  toLock = Math.max(toLock - 1, 0); // Adjust to 0-based rank, ensuring it does not go below 0
                }

                if (rank < toLock) toLock = rank;

                log(`[${scriptName}] Lock level to set: ${toLock}`);

                try {
                  const seg = wmeSDK.DataModel.Segments.getById({
                    segmentId: id,
                  });
                  let displayLockLevel = toLock === 'HRCS' || isNaN(toLock) ? 'HRCS' : `L${toLock + 1}`;
                  let currentDisplayLockLevel;
                  if (seg.lockRank === 'HRCS') {
                    // Should not happen, but for safety
                    currentDisplayLockLevel = 'HRCS';
                  } else {
                    currentDisplayLockLevel = `L${seg.lockRank + 1}`;
                  }
                  if (seg.lockRank === toLock || (lockSetting.lock === 'HRCS' && currentDisplayLockLevel === displayLockLevel)) {
                    // Compare lock levels
                    log(`[${scriptName}] Segment ID: ${id} already has the target lock level: ${displayLockLevel}. Skipping update.`);
                    alertMessageParts.push(`Lock Level: <b>${displayLockLevel} exists. Skipping update.</b>`);
                    updatedLockLevel = true;
                  } else {
                    wmeSDK.DataModel.Segments.updateSegment({
                      segmentId: id,
                      lockRank: toLock,
                    });
                    alertMessageParts.push(`Lock Level: <b>${displayLockLevel}</b>`);
                    updatedLockLevel = true;
                  }
                } catch (error) {
                  console.error(`[${scriptName}] Error updating segment lock rank:`, error);
                }
              }
            }
          }
        }, 300)
      ); // 250ms delay before lock rank update

      // Speed Limit - use road-specific speed if updateSpeed is enabled
      updatePromises.push(
        delayedUpdate(() => {
          if (options.updateSpeed) {
            // Skip speed limit updates for pedestrian type segments (they don't support it)
            const seg = wmeSDK.DataModel.Segments.getById({
              segmentId: id,
            });
            if (seg && isNonDrivableType(seg.roadType)) {
              log(`Skipping speed limit update for Non-Drivable type segment (roadType: ${seg.roadType})`);
              alertMessageParts.push(`Speed Limit: <b>Skipped (Non-Drivable type)</b>`);
              updatedSpeedLimit = true;
              return;
            }
            const selectedRoad = roadTypes.find((rt) => rt.value === options.roadType);
            if (selectedRoad) {
              const speedSetting = options.speeds.find((s) => s.id === selectedRoad.id);
              log('Selected road for speed: ' + selectedRoad.name);
              log('Speed setting found: ' + (speedSetting ? 'yes' : 'no'));

              if (speedSetting) {
                const speedValue = parseInt(speedSetting.speed, 10);
                log('Speed value to set: ' + speedValue);

                // If speedValue is 0 or less, treat as unset (null for removal)
                // Use null instead of undefined to properly remove speed limits
                const speedToSet = !isNaN(speedValue) && speedValue > 0 ? speedValue : null;
                // Compare using loose equality (==) to treat null and undefined as equivalent
                // This ensures we don't try to update when segment already has no speed limit
                const needsUpdate = seg.fwdSpeedLimit != speedToSet || seg.revSpeedLimit != speedToSet;
                log(`Current fwd speed: ${seg.fwdSpeedLimit}, rev speed: ${seg.revSpeedLimit}, target speed: ${speedToSet}, needs update: ${needsUpdate}`);

                if (needsUpdate) {
                  wmeSDK.DataModel.Segments.updateSegment({
                    segmentId: id,
                    fwdSpeedLimit: speedToSet,
                    revSpeedLimit: speedToSet,
                  });
                  alertMessageParts.push(`Speed Limit: <b>${speedToSet !== null ? speedToSet : 'unset'}</b>`);
                  updatedSpeedLimit = true;
                } else {
                  log(`Segment ID: ${id} already has the target speed limit: ${speedToSet}. Skipping update.`);
                  alertMessageParts.push(`Speed Limit: <b>${speedToSet !== null ? speedToSet : 'unset'} exists. Skipping update.</b>`);
                  updatedSpeedLimit = true;
                }
              }
            }
          } else {
            log('Speed updates disabled');
          }
        }, 400)
      ); // 300ms delay before lock rank update

      // Handling the street
      if (options.setStreet || options.setStreetCity || (!options.setStreet && !options.setStreetCity)) {
        let city = null;
        let street = null;
        const segment = wmeSDK.DataModel.Segments.getById({ segmentId: id });
        // --- City assignment logic ---
        if (options.setStreetCity) {
          // Checked: set city as none (empty city)
          city = wmeSDK.DataModel.Cities.getAll().find((city) => city.isEmpty) || wmeSDK.DataModel.Cities.addCity({ cityName: '' });
        } else {
          // Unchecked: try top city, then connected segment's city, then fallback to none
          city = null;
          // 1. Try top city
          try {
            city = getTopCity();
            // Validate city is fully loaded
            if (city && city.name === undefined) {
              log('Top city not fully loaded, will check connected segments');
              city = null;
            }
          } catch (e) {
            log(`Error getting top city: ${e}`);
            city = null;
          }
          log(`Top city: ${city ? `name="${city.name}", isEmpty=${city.isEmpty}, id=${city.id}` : 'null'}`);

          // 2. If not found or empty, try connected segment's city
          if (!city || city.isEmpty) {
            log('Top city not found or empty, checking connected segments...');
            try {
              const connectedAddress = getFirstConnectedSegmentAddress(id);
              if (connectedAddress && connectedAddress.city && connectedAddress.city.id) {
                const connectedCity = wmeSDK.DataModel.Cities.getById({ cityId: connectedAddress.city.id });
                log(`Connected segment city: ${connectedCity ? `name="${connectedCity.name}", isEmpty=${connectedCity.isEmpty}, id=${connectedCity.id}` : 'null'}`);
                // Only use connected city if it's not empty and fully loaded
                if (connectedCity && !connectedCity.isEmpty && connectedCity.name !== undefined) {
                  city = connectedCity;
                }
              } else {
                log('No connected address found');
              }
            } catch (e) {
              log(`Error getting connected segment city: ${e}`);
            }
          }

          // 3. If still not found or empty, fallback to none
          if (!city || city.isEmpty) {
            log('No valid city found, using empty city');
            city = wmeSDK.DataModel.Cities.getAll().find((city) => city.isEmpty) || wmeSDK.DataModel.Cities.addCity({ cityName: '' });
          }
        }
        // --- Street assignment logic ---
        if (options.setStreet) {
          // Set street name to none and remove all alt street names
          street = wmeSDK.DataModel.Streets.getStreet({
            cityId: city.id,
            streetName: '',
          });
          if (!street) {
            street = wmeSDK.DataModel.Streets.addStreet({
              streetName: '',
              cityId: city.id,
            });
          }
          // Remove all alternate street names
          wmeSDK.DataModel.Segments.updateAddress({
            segmentId: id,
            addressData: {
              primaryStreetId: street.id,
              alternateStreetIds: [],
            },
          });
        } else if (options.setStreetCity) {
          // Use the same street name as current, but in the empty city for both primary and all alts
          const currentStreet =
            segment && segment.primaryStreetId
              ? wmeSDK.DataModel.Streets.getById({
                  streetId: segment.primaryStreetId,
                })
              : null;
          const streetName = currentStreet ? currentStreet.name || '' : '';
          street = wmeSDK.DataModel.Streets.getStreet({
            cityId: city.id,
            streetName: streetName,
          });
          if (!street) {
            street = wmeSDK.DataModel.Streets.addStreet({
              streetName: streetName,
              cityId: city.id,
            });
          }
          // For all alternate street names, set them to the empty city as well
          let newAltStreetIds = [];
          if (segment && segment.alternateStreetIds) {
            segment.alternateStreetIds.forEach((altStreetId) => {
              const altStreet = wmeSDK.DataModel.Streets.getById({ streetId: altStreetId });
              if (altStreet && altStreet.name !== undefined) {
                let altInCity = wmeSDK.DataModel.Streets.getStreet({
                  cityId: city.id,
                  streetName: altStreet.name || '',
                });
                if (!altInCity) {
                  altInCity = wmeSDK.DataModel.Streets.addStreet({
                    streetName: altStreet.name || '',
                    cityId: city.id,
                  });
                }
                newAltStreetIds.push(altInCity.id);
              }
            });
          }
          wmeSDK.DataModel.Segments.updateAddress({
            segmentId: id,
            addressData: {
              primaryStreetId: street.id,
              alternateStreetIds: newAltStreetIds,
            },
          });
          pushCityNameAlert(city.id, alertMessageParts);
          updatedCityName = true;
        } else {
          // If both setStreet and setStreetCity are unchecked, always update city for primary and alt names
          if (segment && (segment.primaryStreetId || (segment.alternateStreetIds && segment.alternateStreetIds.length))) {
            // Update primary street to new city
            let currentStreet = segment.primaryStreetId ? wmeSDK.DataModel.Streets.getById({ streetId: segment.primaryStreetId }) : null;
            let streetName = currentStreet ? currentStreet.name || '' : '';
            log(`Before getStreet/addStreet: cityId=${city.id}, streetName="${streetName}"`);
            street = wmeSDK.DataModel.Streets.getStreet({ cityId: city.id, streetName });
            if (!street) {
              log(`Street not found, creating new street with cityId=${city.id}, streetName="${streetName}"`);
              street = wmeSDK.DataModel.Streets.addStreet({ streetName, cityId: city.id });
            }
            log(`After getStreet/addStreet: street.id=${street?.id}, street.cityId=${street?.cityId}`);
            // Update alt streets to new city
            let newAltStreetIds = [];
            if (segment && segment.alternateStreetIds && city) {
              segment.alternateStreetIds.forEach((altStreetId) => {
                const altStreet = wmeSDK.DataModel.Streets.getById({ streetId: altStreetId });
                if (altStreet && altStreet.name !== undefined) {
                  let altInCity = wmeSDK.DataModel.Streets.getStreet({
                    cityId: city.id,
                    streetName: altStreet.name || '',
                  });
                  if (!altInCity) {
                    altInCity = wmeSDK.DataModel.Streets.addStreet({
                      streetName: altStreet.name || '',
                      cityId: city.id,
                    });
                  }
                  newAltStreetIds.push(altInCity.id);
                }
              });
            }
            log(`About to updateAddress: cityId=${city.id}, street.id=${street.id}, altStreetIds=${newAltStreetIds.join(',')}`);
            wmeSDK.DataModel.Segments.updateAddress({
              segmentId: id,
              addressData: {
                primaryStreetId: street.id,
                alternateStreetIds: newAltStreetIds.length > 0 ? newAltStreetIds : undefined,
              },
            });
          } else {
            // New/empty street fallback - use the city we already determined above (from top city or connected segments)
            log(`Segment has no primary street, using determined city: ${city ? `id=${city.id}, name="${city.name}"` : 'null'}`);
            street = wmeSDK.DataModel.Streets.getStreet({ cityId: city.id, streetName: '' });
            if (!street) {
              street = wmeSDK.DataModel.Streets.addStreet({ streetName: '', cityId: city.id });
            }
            wmeSDK.DataModel.Segments.updateAddress({
              segmentId: id,
              addressData: {
                primaryStreetId: street.id,
                alternateStreetIds: undefined,
              },
            });
          }
        }
        log(`City Name: ${city?.name}, City ID: ${city?.id}, Street ID: ${street?.id}`);
      }

      // NEW: Updated unpaved handler using WME SDK updateSegment method
      updatePromises.push(
        delayedUpdate(() => {
          try {
            const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
            const isPedestrian = isNonDrivableType(seg.roadType);
            
            // Determine the unpaved value based on segment type and options
            let unpavedValue = false;
            let statusMessage = '';
            
            if (isPedestrian) {
              // Always set as paved for pedestrian types, regardless of checkbox
              unpavedValue = false;
              statusMessage = 'Paved (pedestrian type)';
            } else if (options.unpaved) {
              // Set as unpaved if option is enabled
              unpavedValue = true;
              statusMessage = 'Unpaved';
            } else {
              // Set as paved
              unpavedValue = false;
              statusMessage = 'Paved';
            }
            
            // Check current unpaved state to avoid unnecessary SDK calls
            const currentUnpaved = seg.flagAttributes?.unpaved === true;
            
            // Use WME SDK updateSegment with flagAttributes — only if value actually needs to change
            // Note: Pedestrian types don't support the unpaved flag, so skip the call
            if (!isPedestrian && currentUnpaved !== unpavedValue) {
              wmeSDK.DataModel.Segments.updateSegment({
                segmentId: id,
                flagAttributes: {
                  unpaved: unpavedValue
                }
              });
              log(`Updated unpaved status via SDK: ${statusMessage} (unpaved=${unpavedValue})`);
            } else if (!isPedestrian && currentUnpaved === unpavedValue) {
              log(`Unpaved status already matches: ${statusMessage} — skipping SDK call`);
            }
            
            alertMessageParts.push(`Paved Status: <b>${statusMessage}</b>`);
            updatedPaved = true;
          } catch (e) {
            log('Error updating unpaved status via SDK: ' + e);
            WazeToastr.Alerts.error(scriptName, `Error updating paved status: ${e.message}`, false, false, 5000);
          }
        }, 500)
      ); // 500ms delay for unpaved/paved toggle

      // 3a. Copy segment name from connected segment if enabled
      // =========================================================================
      // TIER LOGIC for intelligent name copying:
      //
      // TIER 1 - Primary names MATCH:
      //   - Preferred tier for merging alternate names
      //   - Keeps selected segment's primary name unchanged
      //   - Intelligently adds ONLY missing alternate names from connected segment
      //   - Avoids duplicating names that already exist
      //   - Prioritizes A-side segments first, then B-side if no A-side matches
      //
      // TIER 2 - Primary names DIFFER:
      //   - Used when no TIER 1 (matching) segment is found
      //   - Replaces primary name with connected segment's primary name
      //   - Copies all alternate names from connected segment
      //   - Prioritizes A-side segments first, then B-side if no A-side found
      //
      // TIER 3 - Selected segment has NO names:
      //   - Used when selected segment has neither primary nor alternate names
      //   - Copies everything (primary + all alternates) from connected segment
      //   - Prioritizes A-side segments first, then B-side if no A-side found
      //
      // FALLBACK - No valid connected segment:
      //   - If no connected segment has any names, skip copying
      //   - No changes made to selected segment
      // =========================================================================
      updatePromises.push(
        delayedUpdate(() => {
          if (options.copySegmentName) {
            try {
              const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
              // Per WME SDK docs: reverseDirection=false gets segments at fromNode (A side), reverseDirection=true gets segments at toNode (B side)
              // This correctly handles both physical nodes and virtual nodes used by pedestrian segments
              const aSideSegs = wmeSDK.DataModel.Segments.getConnectedSegments({ segmentId: id, reverseDirection: true });
              const bSideSegs = wmeSDK.DataModel.Segments.getConnectedSegments({ segmentId: id, reverseDirection: false });
              
              // Build segsToTry: A side first, then B side
              // Both sides are considered for TIER 1 matching, and the logic prioritizes by altCount
              // This allows B-side matches with more alt names to be selected over A-side matches with fewer alt names
              let segsToTry = [];
              if (aSideSegs.length > 0) {
                segsToTry = aSideSegs.map((s) => s.id);
              }
              if (bSideSegs.length > 0) {
                segsToTry = segsToTry.concat(bSideSegs.map((s) => s.id));
              }
              
              // Get selected segment's current names
              const selectedSegStreetId = seg.primaryStreetId;
              const selectedSegAltStreetIds = seg.alternateStreetIds || [];
              let selectedSegStreetName = '';
              let selectedSegAltNames = [];
              
              if (selectedSegStreetId) {
                try {
                  const selectedStreet = wmeSDK.DataModel.Streets.getById({ streetId: selectedSegStreetId });
                  if (selectedStreet && selectedStreet.name) {
                    selectedSegStreetName = selectedStreet.name;
                  }
                } catch (e) {
                  log(`Error getting selected segment's primary street: ${e}`);
                }
              }
              
              selectedSegAltStreetIds.forEach((altId) => {
                try {
                  const altStreet = wmeSDK.DataModel.Streets.getById({ streetId: altId });
                  if (altStreet && altStreet.name) {
                    selectedSegAltNames.push(altStreet.name);
                  }
                } catch (e) {
                  log(`Error getting selected segment's alternate street: ${e}`);
                }
              });
              
              let found = false;
              log(`[copySegmentName] Starting with ${segsToTry.length} connected segments. Selected primary="${selectedSegStreetName}"`);
              
              // First pass: Look for TIER 1 matches (primary names match)
              // Collect all TIER 1 matches, then prioritize those with alt names
              let tier1Matches = [];
              for (let connectedSegId of segsToTry) {
                const connectedSeg = wmeSDK.DataModel.Segments.getById({ segmentId: connectedSegId });
                if (!connectedSeg) continue;
                
                const connectedStreetId = connectedSeg.primaryStreetId;
                let connectedStreetName = '';
                
                try {
                  const connectedStreet = wmeSDK.DataModel.Streets.getById({ streetId: connectedStreetId });
                  if (connectedStreet && connectedStreet.name === undefined && connectedStreet.cityId === undefined) {
                    log(`[copySegmentName] Segment ${connectedSegId}: Street not fully loaded, skipping`);
                    continue;
                  }
                  if (connectedStreet && connectedStreet.name) {
                    connectedStreetName = connectedStreet.name;
                  }
                } catch (e) {
                  log(`[copySegmentName] Segment ${connectedSegId}: Error getting street: ${e}`);
                  continue;
                }
                
                // Check for TIER 1: Primary names match
                if (selectedSegStreetName !== '' && selectedSegStreetName === connectedStreetName) {
                  const altCount = (connectedSeg.alternateStreetIds || []).length;
                  log(`[copySegmentName] Found TIER 1 match at segment ${connectedSegId}: "${connectedStreetName}" (with ${altCount} alt IDs)`);
                  tier1Matches.push({ segId: connectedSegId, seg: connectedSeg, altCount });
                }
              }
              
              // Prioritize TIER 1 match with alt names, fall back to any TIER 1 match
              let tier1Match = null;
              if (tier1Matches.length > 0) {
                // Sort by altCount descending, pick first (highest alt count)
                tier1Matches.sort((a, b) => b.altCount - a.altCount);
                tier1Match = tier1Matches[0];
                log(`[copySegmentName] Selected TIER 1 match: segment ${tier1Match.segId} with ${tier1Match.altCount} alts`);
              }
              
              // If TIER 1 match found, use it
              if (tier1Match) {
                const connectedSeg = tier1Match.seg;
                const connectedStreetId = connectedSeg.primaryStreetId;
                const connectedAltStreetIds = connectedSeg.alternateStreetIds || [];
                let connectedStreetName = '';
                let connectedAltNames = [];
                
                try {
                  const connectedStreet = wmeSDK.DataModel.Streets.getById({ streetId: connectedStreetId });
                  if (connectedStreet && connectedStreet.name) {
                    connectedStreetName = connectedStreet.name;
                  }
                } catch (e) {
                  log(`[copySegmentName] Error getting tier1 street: ${e}`);
                }
                
                // Get all alternate names
                log(`[copySegmentName] Connected segment has ${connectedAltStreetIds.length} alt IDs: ${connectedAltStreetIds.join(', ')}`);
                connectedAltStreetIds.forEach((altId) => {
                  try {
                    const altStreet = wmeSDK.DataModel.Streets.getById({ streetId: altId });
                    if (altStreet && altStreet.name) {
                      connectedAltNames.push({ name: altStreet.name, id: altId });
                      log(`[copySegmentName] Alt ID ${altId}: "${altStreet.name}"`);
                    } else {
                      log(`[copySegmentName] Alt ID ${altId}: Street not found or has no name`);
                    }
                  } catch (e) {
                    log(`[copySegmentName] Error loading alt ID ${altId}: ${e}`);
                  }
                });
                log(`[copySegmentName] Total alt names found: ${connectedAltNames.length}`);
                log(`[copySegmentName] Selected segment currently has ${selectedSegAltStreetIds.length} alt IDs: ${selectedSegAltStreetIds.join(', ')}`);
                log(`[copySegmentName] Selected segment alt names: ${selectedSegAltNames.join(', ')}`);
                
                // TIER 1: Primary names match - intelligently merge alt names
                log(`TIER 1: Primary names match ("${selectedSegStreetName}"). Merging alts.`);
                const newAltIds = [];
                const addedAltNames = [];
                
                // Keep existing alt street IDs
                newAltIds.push(...selectedSegAltStreetIds);
                
                // Add missing alt IDs from connected
                connectedAltStreetIds.forEach((connAltId) => {
                  const isAlreadyPresent = selectedSegAltStreetIds.includes(connAltId) || 
                                         selectedSegAltNames.some(altName => {
                                           const found = connectedAltNames.find(ca => ca.id === connAltId);
                                           return found && found.name === altName;
                                         });
                  
                  if (!isAlreadyPresent) {
                    newAltIds.push(connAltId);
                    const altName = connectedAltNames.find(ca => ca.id === connAltId);
                    if (altName) addedAltNames.push(altName.name);
                    log(`[copySegmentName] Adding missing alt: ID ${connAltId} = "${altName ? altName.name : 'NOT FOUND'}"`);
                  } else {
                    log(`[copySegmentName] Alt ID ${connAltId} already present, skipping`);
                  }
                });
                log(`[copySegmentName] Final newAltIds: ${newAltIds.join(', ')}, addedAltNames: ${addedAltNames.join(', ')}`);
                
                let newPrimaryStreetId = selectedSegStreetId;
                let newAltStreetIds = newAltIds;
                const updateMessage = addedAltNames.length > 0 
                  ? `Merged: <b>${selectedSegStreetName}</b> (Added alts: ${addedAltNames.join(', ')})`
                  : `Already has: <b>${selectedSegStreetName}</b> (No new alts to add)`;
                
                // Apply the update
                if (options.setStreetCity) {
                  const emptyCity = wmeSDK.DataModel.Cities.getAll().find((city) => city.isEmpty) || wmeSDK.DataModel.Cities.addCity({ cityName: '' });
                  let primaryStreetInEmptyCity = wmeSDK.DataModel.Streets.getStreet({
                    cityId: emptyCity.id,
                    streetName: selectedSegStreetName || '',
                  });
                  if (!primaryStreetInEmptyCity) {
                    primaryStreetInEmptyCity = wmeSDK.DataModel.Streets.addStreet({
                      streetName: selectedSegStreetName || '',
                      cityId: emptyCity.id,
                    });
                  }
                  newPrimaryStreetId = primaryStreetInEmptyCity.id;
                  
                  let newAltStreetIdsInEmptyCity = [];
                  newAltStreetIds.forEach((altId) => {
                    const altStreet = wmeSDK.DataModel.Streets.getById({ streetId: altId });
                    if (altStreet && altStreet.name) {
                      let altInEmptyCity = wmeSDK.DataModel.Streets.getStreet({
                        cityId: emptyCity.id,
                        streetName: altStreet.name,
                      });
                      if (!altInEmptyCity) {
                        altInEmptyCity = wmeSDK.DataModel.Streets.addStreet({
                          streetName: altStreet.name,
                          cityId: emptyCity.id,
                        });
                      }
                      newAltStreetIdsInEmptyCity.push(altInEmptyCity.id);
                    }
                  });
                  
                  log(`[copySegmentName] Calling updateAddress (setStreetCity=true) with primaryStreetId=${newPrimaryStreetId}, alternateStreetIds=[${newAltStreetIdsInEmptyCity.join(', ')}]`);
                  wmeSDK.DataModel.Segments.updateAddress({
                    segmentId: id,
                    addressData: {
                      primaryStreetId: newPrimaryStreetId,
                      alternateStreetIds: newAltStreetIdsInEmptyCity,
                    },
                  });
                  pushCityNameAlert(emptyCity.id, alertMessageParts);
                  updatedCityName = true;
                } else {
                  log(`[copySegmentName] Calling updateAddress with primaryStreetId=${newPrimaryStreetId}, alternateStreetIds=[${newAltStreetIds.join(', ')}]`);
                  wmeSDK.DataModel.Segments.updateAddress({
                    segmentId: id,
                    addressData: {
                      primaryStreetId: newPrimaryStreetId,
                      alternateStreetIds: newAltStreetIds,
                    },
                  });
                  if (connectedSeg.primaryStreetId) {
                    const connectedPrimaryStreet = wmeSDK.DataModel.Streets.getById({ streetId: connectedSeg.primaryStreetId });
                    if (connectedPrimaryStreet) {
                      pushCityNameAlert(connectedPrimaryStreet.cityId, alertMessageParts);
                      updatedCityName = true;
                    }
                  }
                }
                
                alertMessageParts.push(`Copied Name: ${updateMessage}`);
                updatedSegmentName = true;
                found = true;
              } else {
                // Second pass: Collect candidates for TIER 3 (selected has no names) or TIER 2 (names differ)
                // Prioritize by alt count (similar to TIER 1), so segments with more alt names are preferred
                let tier3Candidates = [];
                let tier2Candidates = [];
                
                for (let connectedSegId of segsToTry) {
                  const connectedSeg = wmeSDK.DataModel.Segments.getById({ segmentId: connectedSegId });
                  if (!connectedSeg) continue;
                  
                  const connectedStreetId = connectedSeg.primaryStreetId;
                  const connectedAltStreetIds = connectedSeg.alternateStreetIds || [];
                  let connectedStreetName = '';
                  
                  // Get connected segment's primary street name
                  let connectedStreet = null;
                  try {
                    connectedStreet = wmeSDK.DataModel.Streets.getById({ streetId: connectedStreetId });
                    if (connectedStreet && connectedStreet.name === undefined && connectedStreet.cityId === undefined) {
                      log(`[copySegmentName] Segment ${connectedSegId}: Street not fully loaded, skipping`);
                      continue;
                    }
                    if (connectedStreet && connectedStreet.name) {
                      connectedStreetName = connectedStreet.name;
                    }
                  } catch (e) {
                    log(`[copySegmentName] Segment ${connectedSegId}: Error getting street: ${e}`);
                    continue;
                  }
                  
                  // Skip if connected segment has no names AND no alt street IDs
                  if (!connectedStreetName && connectedAltStreetIds.length === 0) {
                    log(`[copySegmentName] Segment ${connectedSegId}: No primary name and no alt IDs, skipping`);
                    continue;
                  }
                  
                  const altCount = connectedAltStreetIds.length;
                  
                  // Classify as TIER 3 or TIER 2 candidate
                  if (selectedSegStreetName === '' && selectedSegAltNames.length === 0) {
                    // TIER 3: Selected has no names
                    tier3Candidates.push({ segId: connectedSegId, seg: connectedSeg, altCount, streetName: connectedStreetName });
                    log(`[copySegmentName] TIER 3 candidate: segment ${connectedSegId} with ${altCount} alts`);
                  } else {
                    // TIER 2: Names differ
                    tier2Candidates.push({ segId: connectedSegId, seg: connectedSeg, altCount, streetName: connectedStreetName });
                    log(`[copySegmentName] TIER 2 candidate: segment ${connectedSegId} with ${altCount} alts`);
                  }
                }
                
                // Prioritize by alt count
                let selectedCandidate = null;
                if (tier3Candidates.length > 0) {
                  // TIER 3: Sort by alt count descending, pick the one with most alts
                  tier3Candidates.sort((a, b) => b.altCount - a.altCount);
                  selectedCandidate = tier3Candidates[0];
                  log(`[copySegmentName] Selected TIER 3 candidate: segment ${selectedCandidate.segId} with ${selectedCandidate.altCount} alts`);
                } else if (tier2Candidates.length > 0) {
                  // TIER 2: Sort by alt count descending, pick the one with most alts
                  tier2Candidates.sort((a, b) => b.altCount - a.altCount);
                  selectedCandidate = tier2Candidates[0];
                  log(`[copySegmentName] Selected TIER 2 candidate: segment ${selectedCandidate.segId} with ${selectedCandidate.altCount} alts`);
                }
                
                // Process the selected candidate
                if (selectedCandidate) {
                  const connectedSeg = selectedCandidate.seg;
                  const connectedSegId = selectedCandidate.segId;
                  const connectedStreetId = connectedSeg.primaryStreetId;
                  const connectedAltStreetIds = connectedSeg.alternateStreetIds || [];
                  let connectedAltNames = [];
                  
                  // Get connected segment's alternate street names
                  log(`[copySegmentName] Connected segment ${connectedSegId} has ${connectedAltStreetIds.length} alt street IDs: ${connectedAltStreetIds.join(', ')}`);
                  connectedAltStreetIds.forEach((altId) => {
                    try {
                      const altStreet = wmeSDK.DataModel.Streets.getById({ streetId: altId });
                      if (altStreet && altStreet.name) {
                        connectedAltNames.push({ name: altStreet.name, id: altId });
                        log(`[copySegmentName] Alt ID ${altId}: "${altStreet.name}"`);
                      } else {
                        log(`[copySegmentName] Alt ID ${altId}: Street not found or has no name yet`);
                      }
                    } catch (e) {
                      log(`[copySegmentName] Alt ID ${altId}: Error loading - ${e}`);
                    }
                  });
                  log(`[copySegmentName] Successfully loaded names for ${connectedAltNames.length}/${connectedAltStreetIds.length} alt IDs`);
                  
                  let newPrimaryStreetId = selectedSegStreetId;
                  let newAltStreetIds = [...selectedSegAltStreetIds];
                  let updateMessage = '';
                  
                  if (selectedSegStreetName === '' && selectedSegAltNames.length === 0) {
                    // TIER 3: Selected segment has NO names - copy everything from connected
                    log(`TIER 3: Selected has no names. Copying from segment ${connectedSegId}: "${selectedCandidate.streetName}" with ${connectedAltStreetIds.length} alt IDs`);
                    newPrimaryStreetId = connectedStreetId;
                    newAltStreetIds = connectedAltStreetIds;
                    const altSummary = connectedAltNames.length > 0 
                      ? `(Alts: ${connectedAltNames.map(a => a.name).join(', ')})`
                      : connectedAltStreetIds.length > 0 
                      ? `(${connectedAltStreetIds.length} alt IDs: ${connectedAltStreetIds.join(', ')})`
                      : '';
                    updateMessage = `Copied: <b>${selectedCandidate.streetName}</b> ${altSummary}`;
                  } else {
                    // TIER 2: Primary names differ - replace and copy all alts
                    log(`TIER 2: Primary names differ. Selected="${selectedSegStreetName}", Connected="${selectedCandidate.streetName}". Using connected with ${connectedAltStreetIds.length} alt IDs`);
                    newPrimaryStreetId = connectedStreetId;
                    newAltStreetIds = connectedAltStreetIds;
                    const altSummary = connectedAltNames.length > 0 
                      ? `(Alts: ${connectedAltNames.map(a => a.name).join(', ')})`
                      : connectedAltStreetIds.length > 0 
                      ? `(${connectedAltStreetIds.length} alt IDs: ${connectedAltStreetIds.join(', ')})`
                      : '';
                    updateMessage = `Replaced: <b>${selectedCandidate.streetName}</b> ${altSummary}`;
                  }
                  
                  // Apply the address update
                  if (options.setStreetCity) {
                    const emptyCity = wmeSDK.DataModel.Cities.getAll().find((city) => city.isEmpty) || wmeSDK.DataModel.Cities.addCity({ cityName: '' });
                    
                    // Create/find street for primary in empty city
                    let primaryStreetInEmptyCity = wmeSDK.DataModel.Streets.getStreet({
                      cityId: emptyCity.id,
                      streetName: selectedCandidate.streetName || '',
                    });
                    if (!primaryStreetInEmptyCity) {
                      primaryStreetInEmptyCity = wmeSDK.DataModel.Streets.addStreet({
                        streetName: selectedCandidate.streetName || '',
                        cityId: emptyCity.id,
                      });
                    }
                    newPrimaryStreetId = primaryStreetInEmptyCity.id;
                    
                    // Create/find streets for alts in empty city
                    let newAltStreetIdsInEmptyCity = [];
                    newAltStreetIds.forEach((altId) => {
                      const altStreet = wmeSDK.DataModel.Streets.getById({ streetId: altId });
                      if (altStreet && altStreet.name) {
                        let altInEmptyCity = wmeSDK.DataModel.Streets.getStreet({
                          cityId: emptyCity.id,
                          streetName: altStreet.name,
                        });
                        if (!altInEmptyCity) {
                          altInEmptyCity = wmeSDK.DataModel.Streets.addStreet({
                            streetName: altStreet.name,
                            cityId: emptyCity.id,
                          });
                        }
                        newAltStreetIdsInEmptyCity.push(altInEmptyCity.id);
                      }
                    });
                    
                    wmeSDK.DataModel.Segments.updateAddress({
                      segmentId: id,
                      addressData: {
                        primaryStreetId: newPrimaryStreetId,
                        alternateStreetIds: newAltStreetIdsInEmptyCity,
                      },
                    });
                    pushCityNameAlert(emptyCity.id, alertMessageParts);
                    updatedCityName = true;
                  } else {
                    wmeSDK.DataModel.Segments.updateAddress({
                      segmentId: id,
                      addressData: {
                        primaryStreetId: newPrimaryStreetId,
                        alternateStreetIds: newAltStreetIds,
                      },
                    });
                    if (connectedSeg.primaryStreetId) {
                      const connectedPrimaryStreet = wmeSDK.DataModel.Streets.getById({ streetId: connectedSeg.primaryStreetId });
                      if (connectedPrimaryStreet) {
                        pushCityNameAlert(connectedPrimaryStreet.cityId, alertMessageParts);
                        updatedCityName = true;
                      }
                    }
                  }
                  
                  alertMessageParts.push(`Copied Name: ${updateMessage}`);
                  updatedSegmentName = true;
                  found = true;
                }
              }
              
              if (!found) {
                alertMessageParts.push(`Copied Name: <b>None (no connected segment with valid name)</b>`);
                updatedSegmentName = true;
              }
            } catch (error) {
              console.error('Error copying segment name:', error);
            }
          }
        }, 100)
      ); // Run early in the update chain
   // Enable U-Turn logic: Only allow if not already allowed
   // Enable U-Turn if option is checked
    updatePromises.push(
      delayedUpdate(() => {
        // Skip U-turn updates for pedestrian type segments (non-routable)
        const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
        if (seg && isNonDrivableType(seg.roadType)) {
          log(`[EZRoad] Skipping U-turn update for Non-Drivable segment (roadType: ${seg.roadType})`);
          return;
        }
        
        if (options.enableUTurn) {
          let sideAResult = null;
          let sideBResult = null;

          function switchSegmentUturnHybrid(direction = 'A') {
            // Use W Model with SDK-obtained Node ID (bypasses broken segment.getFromNode/getToNode)
            // W model is the reliable method for turn updates.
            //
            // NOTE: Uses deprecated WazeActionSetTurn instead of SDK.DataModel.Turns.updateTurn
            // because the SDK method rejects the encoded turnId format (SDK limitation/bug).
            // Will switch to SDK once that issue is resolved.
            
            if (typeof W === 'undefined' || !W.model || !W.model.getTurnGraph || !W.model.actionManager) {
              return 'failed';
            }

            try {
              // Ensure WazeActionSetTurn is loaded using shared helper
              if (!ensureWazeActionSetTurnLoaded()) {
                return 'failed';
              }

              const seg = W.model.segments.getObjectById(id);
              if (!seg || seg.isOneWay()) {
                return 'skipped';
              }
              
              // Get node ID from SDK (this works reliably)
              const sdkSeg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
              if (!sdkSeg) {
                return 'failed';
              }
              
              const nodeId = direction === 'A' ? sdkSeg.fromNodeId : sdkSeg.toNodeId;
              
              // Retrieve W model node using SDK node ID (avoids segment.getFromNode/getToNode failures)
              const wNode = W.model.nodes.getObjectById(nodeId);
              if (!wNode) {
                return 'failed';
              }
              
              // Check current state
              if (seg.isTurnAllowed(seg, wNode)) {
                return 'already';
              }

              const turn = W.model.getTurnGraph().getTurnThroughNode(wNode, seg, seg);
              if (!turn) {
                return 'failed';
              }

              // Enable the turn
              W.model.actionManager.add(
                new WazeActionSetTurn(
                  W.model.getTurnGraph(),
                  turn.withTurnData(turn.getTurnData().withState(1)) // 1 = ALLOW
                )
              );
              return 'enabled';
            } catch (e) {
              console.error('WME_EZRoads_Mod: U-turn error:', e);
              return 'failed';
            }
          }

          try {
            sideAResult = switchSegmentUturnHybrid('A');
            sideBResult = switchSegmentUturnHybrid('B');

            // Handle alert messaging based on results
            if (sideAResult === 'enabled' || sideBResult === 'enabled') {
              // At least one side was newly enabled
              alertMessageParts.push(`U-Turn: <b>Allowed</b>`);
              updatedUTurn = true;
            } else if (sideAResult === 'already' && sideBResult === 'already') {
              // Both sides were already enabled
              alertMessageParts.push(`U-Turn: <b>Already Enabled</b>`);
              updatedUTurn = true; // Mark as updated so it shows in the combined alert
            } else if (sideAResult === 'already' || sideBResult === 'already') {
              // One side already enabled, the other failed/skipped
              alertMessageParts.push(`U-Turn: <b>Already Enabled</b>`);
              updatedUTurn = true;
            }
          } catch (error) {
            console.error('Error switching U-turn:', error);
          }
        }
      }, 450)
    );
    });

    // If waiting for async confirmation, exit early - don't process any updates
    if (waitingForConfirmation) {
      log('[EZRoad] Waiting for user confirmation, exiting handleUpdate');
      return;
    }

    Promise.all(updatePromises).then(() => {
      // Update U-turn panel if a node is currently selected
      try {
        updateUTurnPanel();
      } catch (e) {
        log(`[EZRoad] Error updating U-turn panel: ${e.message}`);
      }
      
      // Always push city name alert if not already set by other actions
      selection.ids.forEach((id) => {
        if (!alertMessageParts.some((part) => part.startsWith('City Name'))) {
          const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
          if (seg && seg.primaryStreetId) {
            const street = wmeSDK.DataModel.Streets.getById({
              streetId: seg.primaryStreetId,
            });
            if (street) {
              pushCityNameAlert(street.cityId, alertMessageParts);
              updatedCityName = true;
            }
          }
        }
      });

      const showAlert = () => {
        const updatedFeatures = [];
        if (updatedCityName) updatedFeatures.push(alertMessageParts.find((part) => part.startsWith('City')));
        if (updatedSegmentName) updatedFeatures.push(alertMessageParts.find((part) => part.startsWith('Copied Name')));
        if (updatedRoadType) updatedFeatures.push(alertMessageParts.find((part) => part.startsWith('Road Type')));
        if (updatedLockLevel) updatedFeatures.push(alertMessageParts.find((part) => part.startsWith('Lock Level')));
        if (updatedSpeedLimit) updatedFeatures.push(alertMessageParts.find((part) => part.startsWith('Speed Limit')));
        if (updatedPaved) updatedFeatures.push(alertMessageParts.find((part) => part.startsWith('Paved')));
        if (updatedUTurn) updatedFeatures.push(alertMessageParts.find((part) => part.startsWith('U-Turn')));
        const message = updatedFeatures.filter(Boolean).join(', ');
        if (message) {
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.info(`${scriptName}`, `Segment updated with: ${message}`, false, false, 3000);
          } else {
            alert(`${scriptName} Segment updated (WazeToastr Alerts not available)`);
          }
        }
      };

      // Autosave - DELAYED AUTOSAVE
      if (options.autosave) {
        setTimeout(() => {
          log(`[${scriptName}] Delayed Autosave starting...`);
          wmeSDK.Editing.save().then(() => {
            log(`[${scriptName}] Delayed Autosave completed.`);
            showAlert();
          });
        }, 600); // 1000ms (1 second) delay before autosave
      } else {
        showAlert();
      }

      // Refresh UI with updated status by reselecting the segments
      if (selection && selection.ids && selection.ids.length > 0) {
        wmeSDK.Editing.setSelection({ selection: { ids: selection.ids, objectType: 'segment' } });
      }
    });
  };

  const constructSettings = () => {
    const localOptions = getOptions();
    let currentRoadType = localOptions.roadType;
    const update = (key, value) => {
      const options = getOptions();
      options[key] = value;
      localOptions[key] = value;
      saveOptions(options);
    };

    // Update lock level for a specific road type
    const updateLockLevel = (roadTypeId, lockLevel) => {
      const options = getOptions();
      const lockIndex = options.locks.findIndex((l) => l.id === roadTypeId);
      if (lockIndex !== -1) {
        options.locks[lockIndex].lock = lockLevel; // Keep as string to handle 'HRCS'
        localOptions.locks = options.locks;
        saveOptions(options);
        // Trigger preset list refresh if settings panel is open
        if ($('#ezroadsmod-presets-list').length) {
          $('#ezroadsmod-presets-list').trigger('refresh-presets');
        }
        if (WazeToastr?.Alerts) {
          WazeToastr.Alerts.success(`${scriptName}`, 'Lock Levels saved!', false, false, 1500);
        } else {
          alert(`${scriptName} Lock Levels saved!`);
        }
      }
    };

    // Update speed for a specific road type
    const updateSpeed = (roadTypeId, speed) => {
      const options = getOptions();
      const speedIndex = options.speeds.findIndex((s) => s.id === roadTypeId);
      let speedValue = parseInt(speed, 10);
      if (isNaN(speedValue)) {
        speedValue = -1;
      }
      log(`Updating speed for road type ${roadTypeId} to ${speedValue}`);
      if (speedIndex !== -1) {
        options.speeds[speedIndex].speed = speedValue;
        localOptions.speeds = options.speeds;
        saveOptions(options);
        // Trigger preset list refresh if settings panel is open
        if ($('#ezroadsmod-presets-list').length) {
          $('#ezroadsmod-presets-list').trigger('refresh-presets');
        }
        if (WazeToastr?.Alerts) {
          WazeToastr.Alerts.success(`${scriptName}`, 'Speed Values saved!', false, false, 1500);
        } else {
          alert(`${scriptName} Speed Values saved!`);
        }
      }
    };

    // Reset all options to defaults
    const resetOptions = () => {
      saveOptions(defaultOptions);
      // Refresh the page to reload settings
      window.location.reload();
    };

    // Checkbox option definitions
    const checkboxOptions = [
      {
        id: 'setStreet',
        text: 'Set Street Name to None',
        key: 'setStreet',
        tooltip: 'Sets the street name to None for selected segments. If unchecked, leaves the street name unchanged.',
      },
      {
        id: 'setStreetCity',
        text: 'Set city as none (uncheck to add auto)',
        key: 'setStreetCity',
        tooltip: 'If checked, sets the city to None for selected segments for both primary and alternate streets.. If unchecked, adds the available city name automatically to both primary and alt streets.',
      },
      {
        id: 'autosave',
        text: 'Autosave on Action',
        key: 'autosave',
        tooltip: 'Automatically saves after updating segments.',
      },
      {
        id: 'unpaved',
        text: 'Set as Unpaved (Uncheck for Paved)',
        key: 'unpaved',
        tooltip: 'Sets the segment as unpaved. Uncheck to set as paved.',
      },
      {
        id: 'setLock',
        text: 'Set the lock level',
        key: 'setLock',
        tooltip: 'Sets the lock level for the selected road type. It also enables the lock level dropdown.',
      },
      {
        id: 'updateSpeed',
        text: 'Update speed limits',
        key: 'updateSpeed',
        tooltip: 'Updates the speed limit for the selected road type. it also enables the speed input field.',
      },
      {
        id: 'enableUTurn',
        text: 'Enable U-Turn',
        key: 'enableUTurn',
        tooltip: 'Enables U-turn for the selected segment when Quick Update is triggered. Works for both one-way and two-way segments and add U-turns at both ends.',
      },
      {
        id: 'copySegmentName',
        text: 'Copy connected Segment Name',
        key: 'copySegmentName',
        tooltip: "Copies the name and city from a connected segment to the selected segment. If 'Set city as none' is enabled, the city will be set to none regardless of the copied value.",
      },
      {
        id: 'copySegmentAttributes',
        text: 'Copy Connected Segment Attribute',
        key: 'copySegmentAttributes',
        tooltip:
          'Copies all major attributes (road type, lock level, speed limits, paved/unpaved status, primary and alternate street names, and city) from a connected segment. When enabled, it overrides all other options except Autosave. Use shortcut key or (Quick Update Segment) to apply.',
      },
      {
        id: 'showSegmentLength',
        text: 'Show Segment Length <=20m',
        key: 'showSegmentLength',
        tooltip: 'Displays segment length in an orange circle with white font for segments 20 meters or shorter in the visible map area.',
      },
      {
        id: 'checkGeometryIssues',
        text: 'Check Geometry issues near node',
        key: 'checkGeometryIssues',
        tooltip: 'Checks if any intermediate geometry nodes are too close to the start or end nodes. Configure threshold distance below. Displays a pin icon if an issue is found.',
      },
      {
        id: 'restrictExceptMotorbike',
        text: 'Restrict except Motorbike (Auto)',
        key: 'restrictExceptMotorbike',
        tooltip: 'Automatically adds motorbike-only vehicle restrictions via UI automation. Applies to entire segment in both directions, all day. Blocks all vehicles except motorcycles. May use shortcut key or (Quick Update Segment) to apply.',
      },
      {
        id: 'updateLanes',
        text: 'Enable Road Width (No of Lanes) buttons',
        key: 'updateLanes',
        tooltip: 'Shows lane count buttons (0-8) in the edit panel. Click a number to set the number of lanes for both directions on selected segments.',
      },
      {
        id: 'validateNodeConnection',
        text: 'Validate Node Connection',
        key: 'validateNodeConnection',
        tooltip: 'Checks if a segment\'s A or B node is disconnected (no other segments attached) but is within the threshold distance of another segment\'s geometry. Displays a warning icon at flagged nodes.',
      },
    ];

    // Helper function to create radio buttons
    const createRadioButton = (roadType) => {
      const id = `road-${roadType.id}`;
      const isChecked = localOptions.roadType === roadType.value;
      const lockSetting = localOptions.locks.find((l) => l.id === roadType.id) || { id: roadType.id, lock: 1 };
      const speedSetting = localOptions.speeds.find((s) => s.id === roadType.id) || { id: roadType.id, speed: 40 };

      const div = $(`<div class="ezroadsmod-option">
            <div class="ezroadsmod-radio-container">
                <input type="radio" id="${id}" name="defaultRoad" data-road-value="${roadType.value}" ${isChecked ? 'checked' : ''}>
                <label for="${id}">${roadTypeName(roadType)}</label>
                <select id="lock-level-${roadType.id}" class="road-lock-level" data-road-id="${roadType.id}" ${!localOptions.setLock ? 'disabled' : ''}>
                    ${locks.map((lock) => `<option value="${lock.value}" ${lockSetting.lock === lock.value ? 'selected' : ''}>${lock.value === 'HRCS' ? 'HRCS' : 'L' + lock.value}</option>`).join('')}
                </select>
                <input type="number" id="speed-${roadType.id}" class="road-speed" data-road-id="${roadType.id}"
                       value="${speedSetting.speed}" min="-1" ${!localOptions.updateSpeed ? 'disabled' : ''}>
            </div>
        </div>`);

      div.find('input[type="radio"]').on('click', () => {
        update('roadType', roadType.value);
        currentRoadType = roadType.value;
      });

      div.find('select').on('change', function () {
        updateLockLevel(roadType.id, $(this).val());
      });

      div.find('input.road-speed').on('change', function () {
        // Get the value as a number
        const speedValue = parseInt($(this).val(), 10);
        // If it's not a number, reset to 0
        if (isNaN(speedValue)) {
          $(this).val(0);
          updateSpeed(roadType.id, 0);
        } else {
          updateSpeed(roadType.id, speedValue);
        }
      });

      return div;
    };

    // Helper function to create checkboxes
    const createCheckbox = (option) => {
      const isChecked = localOptions[option.key];
      const otherClass = option.key !== 'autosave' && option.key !== 'copySegmentAttributes' && option.key !== 'showSegmentLength' && option.key !== 'checkGeometryIssues' && option.key !== 'validateNodeConnection' && option.key !== 'restrictExceptMotorbike' && option.key !== 'updateLanes' ? 'ezroadsmod-other-checkbox' : '';
      const attrClass = option.key === 'copySegmentAttributes' ? 'ezroadsmod-attr-checkbox' : '';

      const div = $(`<div class="ezroadsmod-option">
    <input type="checkbox" id="${option.id}" name="${option.id}" class="${otherClass} ${attrClass}" ${isChecked ? 'checked' : ''} title="${option.tooltip || ''}">
    <label for="${option.id}" title="${option.tooltip || ''}">${option.text}</label>
  </div>`);
      div.on('click', () => {
        // Mutually exclusive logic for setStreet and copySegmentName
        if (option.key === 'setStreet' && $(`#${option.id}`).prop('checked')) {
          $('#copySegmentName').prop('checked', false);
          update('copySegmentName', false);
        }
        if (option.key === 'copySegmentName' && $(`#${option.id}`).prop('checked')) {
          $('#setStreet').prop('checked', false);
          update('setStreet', false);
        }

        // Mutual exclusion logic for copySegmentAttributes and other checkboxes
        if (option.key === 'copySegmentAttributes') {
          if ($(`#${option.id}`).prop('checked')) {
            // Uncheck all other checkboxes except autosave
            $('.ezroadsmod-other-checkbox').each(function () {
              $(this).prop('checked', false);
              const key = $(this).attr('id');
              update(key, false);
            });
            update('copySegmentAttributes', true);
          } else {
            update('copySegmentAttributes', false);
          }
        } else if (option.key !== 'autosave' && option.key !== 'showSegmentLength' && option.key !== 'checkGeometryIssues' && option.key !== 'validateNodeConnection' && option.key !== 'restrictExceptMotorbike' && option.key !== 'updateLanes') {
          // If any other checkbox (except autosave, showSegmentLength, checkGeometryIssues, validateNodeConnection, restrictExceptMotorbike, updateLanes) is checked, uncheck copySegmentAttributes
          if ($(`#${option.id}`).prop('checked')) {
            $('#copySegmentAttributes').prop('checked', false);
            update('copySegmentAttributes', false);
          }
          update(option.key, $(`#${option.id}`).prop('checked'));
        } else {
          // Autosave, showSegmentLength, checkGeometryIssues, validateNodeConnection, restrictExceptMotorbike, or updateLanes
          update(option.key, $(`#${option.id}`).prop('checked'));
        }

        // Handle Segment Length / Geometry Check / Segment Connection toggle
        if (option.key === 'showSegmentLength' || option.key === 'checkGeometryIssues' || option.key === 'validateNodeConnection' || option.key === 'copySegmentAttributes') {
          handleSegmentLengthToggle();
        }
      });
      return div;
    };

    // -- Set up the tab for the script
    wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
      tabLabel.innerText = 'EZRoads Mod🅱️';
      tabLabel.title = 'Easily Update Roads';

      // Setup base styles
      const styles = $(`<style>
            #ezroadsmod-settings {
                padding-right: 10px;
                box-sizing: border-box;
            }
            #ezroadsmod-settings * {
                box-sizing: border-box;
            }
            #ezroadsmod-settings h2, #ezroadsmod-settings h5 {
                margin-top: 0;
                margin-bottom: 10px;
            }
            .ezroadsmod-section {
                margin-bottom: 15px;
            }
            .ezroadsmod-option {
                margin-bottom: 8px;
            }
            .ezroadsmod-radio-container {
                display: flex;
                align-items: center;
            }
            .ezroadsmod-radio-container input[type="radio"] {
                margin-right: 5px;
            }
            .ezroadsmod-radio-container label {
                flex: 1;
                margin-right: 10px;
                text-align: left;
            }
            .ezroadsmod-radio-container select {
                width: 80px;
                margin-left: auto;
                margin-right: 5px;
            }
            .ezroadsmod-radio-container input.road-speed {
                width: 50px;
                margin-right: 5px;
            }
            .ezroadsmod-reset-button {
                margin-top: 20px;
                padding: 8px 12px;
                background-color: #f44336;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }
            .ezroadsmod-reset-button:hover {
                background-color: #d32f2f;
            }
            .ezroad-lane-buttons-container {
                display: flex;
                align-items: center;
                gap: 2px;
                padding: 4px 5px;
                margin: 2px 0;
                flex-wrap: wrap;
                border: 1px solid #ccc;
                border-radius: 6px;
                background: rgba(128, 128, 128, 0.05);
            }
            .ezroad-lane-buttons-container .ezroad-lane-label {
                font-size: 12px;
                font-weight: 600;
                margin-right: 6px;
                white-space: nowrap;
                min-width: 40px;
            }
            .ezroad-lane-buttons-container wz-checkable-chip.ezroad-lane-chip {
                margin: 0;
            }
        </style>`);

      tabPane.innerHTML = '<div id="ezroadsmod-settings"></div>';
      const scriptContentPane = $('#ezroadsmod-settings');
      scriptContentPane.append(styles);

      // Header section
      const header = $(`<div class="ezroadsmod-section">
		<h2>EZRoads Mod🅱️</h2>
		<div>Current Version: <b>${scriptVersion}</b></div>
		<div>Update Keybind: <kbd>G</kbd></div>
		<div style="font-size: 0.8em;">You can change it in WME keyboard setting!</div>
		</div>`);
      scriptContentPane.append(header);

      // Road type and options header
      const roadTypeHeader = $(`<div class="ezroads-section">
        <div style="display: flex; align-items: center;">
        <div style="flex-grow: 1; text-align: center;">Road Type</div>
        <div style="width: 80px; text-align: center;">Lock</div>
        <div style="width: 60px; text-align: center;">Speed</div>
        </div>
        </div>`);
      scriptContentPane.append(roadTypeHeader);

      // Road type section with header
      const roadTypeSection = $(`<div class="ezroads-section">
        <div id="road-type-options"></div>
        </div>`);
      scriptContentPane.append(roadTypeSection);

      const roadTypeOptions = roadTypeSection.find('#road-type-options');
      roadTypes.forEach((roadType) => {
        roadTypeOptions.append(createRadioButton(roadType));
      });
      // Additional options section
      const additionalSection = $(`<div class="ezroadsmod-section">
            <h5>Additional Options</h5>
            <div id="additional-options"></div>
        </div>`);
      scriptContentPane.append(additionalSection);

      const additionalOptions = additionalSection.find('#additional-options');
      checkboxOptions.forEach((option) => {
        additionalOptions.append(createCheckbox(option));
        
        // Add threshold input right after the checkGeometryIssues checkbox
        if (option.key === 'checkGeometryIssues') {
          const geometryThresholdDiv = $(`<div class="ezroadsmod-option" style="margin-left: 20px; margin-top: -5px;">
            <label for="geometryIssueThreshold" style="font-size: 0.9em;">Threshold distance (meters):</label>
            <input type="number" id="geometryIssueThreshold" min="0.1" max="10" step="0.1" value="${
              localOptions.geometryIssueThreshold || 2
            }" style="width: 60px; margin-left: 5px;" title="Distance in meters to check for geometry nodes near segment endpoints">
          </div>`);
          additionalOptions.append(geometryThresholdDiv);
        }
        
        // Add connection radius input right after the validateNodeConnection checkbox
        if (option.key === 'validateNodeConnection') {
          const connectionRadiusDiv = $(`<div class="ezroadsmod-option" style="margin-left: 20px; margin-top: -5px;">
            <label for="connectionCheckRadius" style="font-size: 0.9em;">Connection check radius (meters):</label>
            <input type="number" id="connectionCheckRadius" min="1" max="20" step="0.5" value="${
              localOptions.connectionCheckRadius || 5
            }" style="width: 60px; margin-left: 5px;" title="Radius in meters to check if a disconnected node is near another segment">
          </div>`);
          additionalOptions.append(connectionRadiusDiv);
        }
      });

      // Handle geometry threshold input change
      $(document).on('change', '#geometryIssueThreshold', function () {
        let thresholdValue = parseFloat($(this).val());
        if (isNaN(thresholdValue) || thresholdValue < 0.1) {
          thresholdValue = 2;
          $(this).val(2);
        } else if (thresholdValue > 10) {
          thresholdValue = 10;
          $(this).val(10);
        }
        update('geometryIssueThreshold', thresholdValue);
        // Refresh display if geometry check is enabled
        if (localOptions.checkGeometryIssues) {
          rebuildSegmentLengthDisplay();
        }
      });

      // Handle connection check radius input change
      $(document).on('change', '#connectionCheckRadius', function () {
        let radiusValue = parseFloat($(this).val());
        if (isNaN(radiusValue) || radiusValue < 1) {
          radiusValue = 5;
          $(this).val(5);
        } else if (radiusValue > 20) {
          radiusValue = 20;
          $(this).val(20);
        }
        update('connectionCheckRadius', radiusValue);
        // Refresh display if segment connection validation is enabled
        if (localOptions.validateNodeConnection) {
          rebuildSegmentLengthDisplay();
        }
      });

      // Update all lock dropdowns when setLock checkbox changes
      $(document).on('click', '#setLock', function () {
        const isChecked = $(this).prop('checked');
        $('.road-lock-level').prop('disabled', !isChecked);
      });

      // Update all speed inputs when updateSpeed checkbox changes
      $(document).on('click', '#updateSpeed', function () {
        const isChecked = $(this).prop('checked');
        $('.road-speed').prop('disabled', !isChecked);
        log('Speed update option changed to: ' + isChecked);
      });

      // Reset button section
      const resetButton = $(`<button class="ezroadsmod-reset-button">Reset All Options</button>`);
      resetButton.on('click', function () {
        if (confirm('Are you sure you want to reset all options to default values? It will reload the webpage!')) {
          resetOptions();
        }
      });
      scriptContentPane.append(resetButton);

      // --- Export/Import Config UI ---
      const exportImportSection = $(
        `<div class="ezroadsmod-section" style="margin-top:10px;">
          <div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
            <button id="ezroadsmod-export-btn" style="font-size:0.9em;padding:4px 8px;white-space:nowrap;">Export Lock/Speed Config</button>
            <button id="ezroadsmod-import-btn" style="font-size:0.9em;padding:4px 8px;white-space:nowrap;">Import Lock/Speed Config</button>
          </div>
          <input id="ezroadsmod-import-input" type="text" placeholder="Paste config here" style="width:95%;font-size:0.9em;padding:3px;">
        </div>`
      );
      scriptContentPane.append(exportImportSection);

      // Export logic
      $(document).on('click', '#ezroadsmod-export-btn', function () {
        const options = getOptions();
        const presets = getCustomPresets();
        const exportData = {
          locks: options.locks,
          speeds: options.speeds,
          customPresets: presets,
        };
        const exportStr = JSON.stringify(exportData, null, 2);
        // Copy to clipboard
        navigator.clipboard.writeText(exportStr).then(
          () => {
            if (WazeToastr?.Alerts) {
              WazeToastr.Alerts.success(`${scriptName}`, 'Lock/Speed config with all presets copied to clipboard!', false, false, 2000);
            } else {
              alert(`${scriptName} Lock/Speed config with all presets copied to clipboard!`);
            }
          },
          () => {
            alert(`${scriptName} Failed to copy config to clipboard.`);
          }
        );
      });

      // Import logic
      $(document).on('click', '#ezroadsmod-import-btn', function () {
        const importStr = $('#ezroadsmod-import-input').val();
        if (!importStr) {
          alert(`[${scriptName}] Please paste a config string to import.`);
          return;
        }
        let importData;
        try {
          importData = JSON.parse(importStr);
        } catch (e) {
          alert(`[${scriptName}] Invalid config string!`);
          return;
        }
        if (importData.locks && importData.speeds) {
          const options = getOptions();
          options.locks = importData.locks;
          options.speeds = importData.speeds;
          saveOptions(options);
          // Update in-memory localOptions and UI
          localOptions.locks = importData.locks;
          localOptions.speeds = importData.speeds;

          // Import custom presets if they exist
          if (importData.customPresets) {
            window.localStorage.setItem('WME_EZRoads_Mod_CustomPresets', JSON.stringify(importData.customPresets));
            refreshPresetsList();
          }

          // Update lock dropdowns
          $('.road-lock-level').each(function () {
            const roadId = $(this).data('road-id');
            const lockSetting = localOptions.locks.find((l) => l.id == roadId);
            if (lockSetting) $(this).val(lockSetting.lock);
          });
          // Update speed inputs
          $('.road-speed').each(function () {
            const roadId = $(this).data('road-id');
            const speedSetting = localOptions.speeds.find((s) => s.id == roadId);
            if (speedSetting) $(this).val(speedSetting.speed);
          });
          if (WazeToastr?.Alerts) {
            const presetsCount = importData.customPresets ? Object.keys(importData.customPresets).length : 0;
            const message = presetsCount > 0 ? `Config imported with ${presetsCount} preset(s)!` : 'Config imported and applied!';
            WazeToastr.Alerts.success(`${scriptName}`, message, false, false, 2000);
          } else {
            alert(`${scriptName} ${message}`);
          }
        } else {
          alert(`${scriptName} Config missing lock/speed data!`);
        }
      });

      // --- Custom Presets UI ---
      const customPresetsSection = $(
        `<div class="ezroadsmod-section" style="margin-top:15px; padding-top:12px; border-top: 1px solid #ccc;">
          <div style="font-weight:bold; margin-bottom:6px; font-size:0.95em;">Custom Lock/Speed Presets</div>
          <div style="margin-bottom:6px;">
            <input id="ezroadsmod-preset-name" type="text" placeholder="Preset name" style="width:45%;margin-right:5px;font-size:0.9em;padding:3px;">
            <button id="ezroadsmod-save-preset-btn" style="font-size:0.9em;padding:3px 8px;">Save</button>
          </div>
          <div id="ezroadsmod-presets-list" style="margin-top:6px;"></div>
        </div>`
      );
      scriptContentPane.append(customPresetsSection);

      // Function to refresh the presets list UI
      const refreshPresetsList = () => {
        const presets = getCustomPresets();
        const presetsListDiv = $('#ezroadsmod-presets-list');
        presetsListDiv.empty();

        const presetNames = Object.keys(presets);
        const currentPresetName = getCurrentPresetName();
        const isModified = isCurrentPresetModified();

        if (presetNames.length === 0) {
          presetsListDiv.append('<div style="color:#888;font-style:italic;font-size:0.85em;">No presets saved.</div>');
          return;
        }

        presetNames.forEach((presetName) => {
          const presetData = presets[presetName];
          const savedDate = presetData.savedAt ? new Date(presetData.savedAt).toLocaleDateString() : 'Unknown';
          const isCurrent = currentPresetName === presetName && !isModified;
          const currentIndicator = isCurrent ? '<span style="color:#4CAF50; font-weight:bold; margin-right:5px;">Current</span>' : '';

          const presetDiv = $(
            `<div class="ezroadsmod-preset-item" style="margin-bottom:5px; padding:5px 5px 5px 5px; background-color:rgba(128, 128, 128, 0.12); border-radius:3px;">
              <div style="display:flex; align-items:center; justify-content:space-between; padding-right:10px;">
                <div style="font-size:1.0em;">
                  <strong>${presetName}</strong>
                  <span style="font-size:0.85em; color: #949494ff; margin-left:5px;">(${savedDate})</span>
                </div>
                <div style="white-space:nowrap;">
                  ${currentIndicator}
                  <button class="ezroadsmod-load-preset-btn" data-preset-name="${presetName}" style="margin-right:2px;font-size:0.9em;padding:2px 5px;">Load</button>
                  <button class="ezroadsmod-delete-preset-btn" data-preset-name="${presetName}" style="background-color:#f44336; color:white;font-size:0.9em;padding:3px 8px;">Delete</button>
                </div>
              </div>
            </div>`
          );
          presetsListDiv.append(presetDiv);
        });
      };

      // Initial load of presets list
      refreshPresetsList();

      // Add event listener for refreshing presets list when settings change
      $('#ezroadsmod-presets-list').on('refresh-presets', refreshPresetsList);

      // Save preset
      $(document).on('click', '#ezroadsmod-save-preset-btn', function () {
        const presetName = $('#ezroadsmod-preset-name').val().trim();
        if (!presetName) {
          alert('Please enter a preset name.');
          return;
        }

        const presets = getCustomPresets();
        if (presets[presetName]) {
          if (!confirm(`Preset "${presetName}" already exists. Overwrite it?`)) {
            return;
          }
        }

        if (saveCustomPreset(presetName)) {
          $('#ezroadsmod-preset-name').val('');
          refreshPresetsList();
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(`${scriptName}`, `Preset "${presetName}" saved!`, false, false, 2000);
          } else {
            alert(`${scriptName} Preset "${presetName}" saved!`);
          }
        }
      });

      // Load preset
      $(document).on('click', '.ezroadsmod-load-preset-btn', function () {
        const presetName = $(this).data('preset-name');
        if (loadCustomPreset(presetName)) {
          // Update in-memory localOptions
          const options = getOptions();
          localOptions.locks = options.locks;
          localOptions.speeds = options.speeds;

          // Update lock dropdowns
          $('.road-lock-level').each(function () {
            const roadId = $(this).data('road-id');
            const lockSetting = localOptions.locks.find((l) => l.id == roadId);
            if (lockSetting) $(this).val(lockSetting.lock);
          });

          // Update speed inputs
          $('.road-speed').each(function () {
            const roadId = $(this).data('road-id');
            const speedSetting = localOptions.speeds.find((s) => s.id == roadId);
            if (speedSetting) $(this).val(speedSetting.speed);
          });

          // Refresh the presets list to show the current indicator
          refreshPresetsList();

          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(`${scriptName}`, `Preset "${presetName}" loaded!`, false, false, 2000);
          } else {
            alert(`${scriptName} Preset "${presetName}" loaded!`);
          }
        } else {
          alert(`${scriptName} Failed to load preset "${presetName}".`);
        }
      });

      // Delete preset
      $(document).on('click', '.ezroadsmod-delete-preset-btn', function () {
        const presetName = $(this).data('preset-name');
        if (!confirm(`Are you sure you want to delete preset "${presetName}"?`)) {
          return;
        }

        if (deleteCustomPreset(presetName)) {
          refreshPresetsList();
          if (WazeToastr?.Alerts) {
            WazeToastr.Alerts.success(`${scriptName}`, `Preset "${presetName}" deleted!`, false, false, 2000);
          } else {
            alert(`${scriptName} Preset "${presetName}" deleted!`);
          }
        } else {
          alert(`${scriptName} Failed to delete preset "${presetName}".`);
        }
      });
    });
  };
  function scriptupdatemonitor() {
    if (WazeToastr?.Ready) {
      // Create and start the ScriptUpdateMonitor
      // For GitHub raw URLs, we need to specify metaUrl explicitly (same as downloadUrl for GitHub)
      const updateMonitor = new WazeToastr.Alerts.ScriptUpdateMonitor(
        scriptName,
        scriptVersion,
        downloadUrl,
        GM_xmlhttpRequest,
        downloadUrl, // metaUrl - for GitHub, use the same URL as it contains the @version tag
        /@version\s+(.+)/i, // metaRegExp - extracts version from @version tag
      );
      updateMonitor.start(2, true); // Check every 2 hours, check immediately

      // Show the update dialog for the current version
      WazeToastr.Interface.ShowScriptUpdate(scriptName, scriptVersion, updateMessage, downloadUrl, forumURL);
    } else {
      setTimeout(scriptupdatemonitor, 250);
    }
  }
  scriptupdatemonitor();
  console.log(`${scriptName} initialized.`);

  // CSS styling for U-turn counters and UI (imported from WME Switch Uturns)
  const ezroadUturnCss = `
    .ezroad-uturns-info .button-toolbar {
      padding: 8px;
    }
    p.ezroad-uturns-counter {
      margin-top: 15px;
      padding-left: 15px;
    }
    p.ezroad-uturns-info {
      border-top: 1px solid #ccc;
      color: #777;
      font-size: x-small;
      margin-top: 15px;
      padding-top: 10px;
      text-align: center;
    }
    #ezroad-uturns {
      padding: 16px;
    }
    [wz-theme="dark"] #ezroad-uturns-disallow-btn {
      --wz-button-background-color: var(--always_dark_surface_default) !important;
    }
    [wz-theme="dark"] #ezroad-uturns-allow-btn {
      --wz-button-background-color: var(--always_dark_surface_default) !important;
    }
  `;
  
  // Inject CSS styling
  if (document.head) {
    const styleElement = document.createElement('style');
    styleElement.textContent = ezroadUturnCss;
    document.head.appendChild(styleElement);
  }

  // Custom code to run after WME bootstrap for legacy require calls for UTurn action. without it WazeActionSetTurn is undefined.
    let WazeActionSetTurn

$(document).on('bootstrap.wme', () => {
    // Require Waze components with a check for .default (ES6 modules)
    const SetTurnModule = require('Waze/Model/Graph/Actions/SetTurn');
    WazeActionSetTurn = SetTurnModule.default || SetTurnModule;
});

// Fallback: If bootstrap already happened, try to require it now
if (typeof require !== 'undefined') {
    try {
        const SetTurnModule = require('Waze/Model/Graph/Actions/SetTurn');
        WazeActionSetTurn = SetTurnModule.default || SetTurnModule;
    } catch (e) {
        console.warn('EZRoads Mod: Could not load WazeActionSetTurn immediately.');
    }
}

  /*
Changelog
<strong>Version 2.7.1.1 - 2026-07-23:</strong><br>
    - Migrated legacy keyboard shortcuts to sdk<br>`;
<strong>Version 2.7.0.7 - 2026-07-23:</strong><br>
    - Segment & Node Connection: Added validation for segment node connections and introduced a highlight layer for segments with connection issues.<br>
    - Lane Management: Added road width (0–8 lanes) buttons in the edit panel with a "Multiple" chip, hover tooltips, and a settings toggle. Fixed preview display before saving and resolved undo/redo support.<br>
    - SDK & Address Architecture: Reorganized address properties under a unified addressData object following WMESDK patterns, and migrated the Paved/Unpaved feature to full SDK support.<br>
    -Localization & Maintenance: Added support for localized road names, alongside general bug fixes and stability improvements.<br>`;
<strong>Version 2.7.0.6 - 2026-07-19:</strong><br>
    - Added: Validation of segment node connection<br>
    - Added: Highlight layer for segments with node connection issues<br>
    - Fixed: Other minor bug fixes and improvements<br>`
<strong>Version 2.7.0.4 - 2026-07-16:</strong><br>
    - Added: Validation of segment node connection<br>
    - Added: Highlight layer for segments with node connection issues<br>
    - Fixed: Paved/Unpaved feature is now using fully SDK<br>
    - Fixed: Other minor bug fixes and improvements<br>
<strong>Version 2.7.0.3 - 2026-07-16:</strong><br>
    - Added: Validation of segment node connection<br>
    - Fixed: Paved/Unpaved feature is now using fully SDK<br>
    - Fixed: Other minor bug fixes and improvements<br>
<strong>Version 2.6.9.8 - 2026-07-15:</strong><br>
    - Fixed: Lane update feature now displays added lanes properly before saving<br>
    - Fixed: Lane update feature now works properly with undo/redo<br>
    - Fixed: Other minor bug fixes and improvements<br>
<strong>Version 2.6.9.8 - 2026-07-13:</strong><br>
    - Added: Road Width (No of Lanes) buttons (0-8) in the edit panel with Multiple chip for mixed selection<br>
    - Settings checkbox to enable/disable lane count buttons<br>
    - Tooltip on hover for lane chips<br>
<strong>Version 2.6.9.7 - 2026-07-11:</strong><br>
    - Fix: All address properties (streetId, houseNumber, alternateStreetIds, and raw components) are now organized under a single addressData object, keeping the method signatures clean following wmesdk pattern<br>
    - Road names will now follow localized names if available<br>
<strong>Version 2.6.9.6 - 2026-07-11:</strong><br>
    - Fix: All address properties (streetId, houseNumber, alternateStreetIds, and raw components) are now organized under a single addressData object, keeping the method signatures clean following wmesdk pattern<br>
<strong>Version 2.6.9.5 - 2026-06-11:</strong><br>
    - Fix: Issue with the uturn failed to update when selected.<br>
    - Added: shortcut key option to enable U-turns for segment direction A or B and node.<br>
    - Added: counter and button UI to allow all U-turns at once for a node when selected.<br>
<strong>Version 2.6.9.4 - 2026-06-11:</strong><br>
    - Fix: Issue with the uturn failed to update when selected.<br>
    - Added: shortcut key option to enable U-turns for segment direction A or B and node.<br>
<strong>Version 2.6.9.3 - 2026-06-10:</strong><br>
    - Fix: Issue with the uturn failed to update when selected.<br>
<strong>Version 2.6.9.2 - 2026-06-01:</strong><br>
    - Fix: second split attempt without saving no longer throws "node null does not exist".<br>
    - Segments with null fromNodeId/toNodeId (newly split, unsaved) are now excluded from<br>
      the interactive split cache and the auto-split selection path.<br>
<strong>Version 2.6.9.0 - 2026-05-30:</strong><br>
    - Added Segment Split mode (Alt+7 shortcut).<br>
    - With segment(s) selected: auto-splits each at midpoint / geometry node.<br>
    - With nothing selected: activates interactive split mode — hover to preview, click to split, Esc to cancel.<br>
Version 2.6.8.6 - 2026-02-20:</strong><br>
    - Restored paved or unpaved function to DOM since SDK methods do not provide immediate feedback.<br>
Version 2.6.8.3 - 2026-02-20:</strong><br>
    - Added shortcuts support for toggling additional options.\n This is temporary fix using legacy method for saving keys between sessions.<br>
    - Migrated unpaved status handling to new SDK methods.<br>
    - Migrated copying of flag attributes to new SDK methods.<br>
    - Updated logic for copying connected segment name and city to use new SDK methods and added more robust handling for finding connected segments with valid city.<br>
    - Fixed found bug fixes.<br>
Version 2.6.8.1 - 2026-02-18
 - Fixed an issue with copying segment name from connected segment. It will prioritize copying from the connected segment Side A that has a valid city name when "Set city as none" is unchecked.
Version 2.6.7.9 - 2024-06-09
    - Fixed issue with converting the segment to pedestrian type and vice versa<br>
    - Added direct shortcut key to update motorcycle restriction (Alt+R) <br>
    - Improved alert message when motorbike restriction cannot be applied due to segment type
Version 2.6.7.8 - 2026-02-09
    - Added direct shortcut key to update motorcycle restriction (Alt+R)
    - Improved alert message when motorbike restriction cannot be applied due to segment type
Version 2.6.7.7 - 2026-02-09
- Added direct shortcut key to update motorcycle restriction (Alt+R) 
Version 2.6.7.6 - 2026-02-08
- Improved non-routable segment detection: now properly skips "enable uturn" for all non-routable segments (Ferry, Railway, Runway, Footpath, Pedestrianised Area, Stairway) by checking routingRoadType from WME SDK
- Added restriction to allow only Motorbikes via UI automation for both one way and two way segments. SDK does not support vehicle restrictions yet.
Version 2.6.7.3 - 2026-01-28
    - Fixed an issue with copying city names or segment names
2.6.7.2 - 2026-01-23
    - Fixed an issue where "Enable Uturn" was disabling existing U-turns.
2.6.7.1 - 2026-01-23:
    - Added checkbox for enabling U-turns.<br>
When checked, it will add U-turns to the selected road segments' both sides<br> and when pressed again, it will remove U-turns from both sides.
    (thanks to Tahshee for the suggestion).
2.6.6 - 2026-01-09
- Roundabouts (segments with junctionId) are now excluded from geometry issue detection and fixing.
- Added user-configurable threshold distance input field for geometry checks:
  - Range: 0.1 to 10 meters
  - Step: 0.1 meter increments
  - Default: 2 meters
- Users can now customize the distance threshold for detecting geometry nodes too close to segment endpoints.
- Fixed geometry issue marker (pin icon) positioning to prevent cropping when using higher threshold values.
- Consolidated duplicate geometry threshold constants into single configurable option.
- Improved settings UI with threshold input field directly below the "Check Geometry issues" checkbox.
- Threshold changes immediately refresh the map display when geometry checking is enabled.
- Fixed issue where auto setting up segment city from connected segments could fail in some cases.
2.6.5 - 2026-01-07
- Enhanced geometry fix icon: Bug icon changes color to red when geometry issues are detected, blue when no issues found.
- Improved geometry fix confirmation messages to show total count of geometry node issues.
- Fixed geometry fix success message to accurately report both segment count and geometry node count.
- Better visual feedback for geometry quality checking status.
2.6.4 - 2026-01-07
- Fixed checkbox mutual exclusion logic for display features.
- "Show Segment Length ≤20m" and "Check Geometry issues near node" checkboxes now work independently from the "Copy Connected Segment Attribute" option.
- These display options can now be enabled/disabled without affecting or being affected by the Copy Connected Segment Attribute feature.
- Improved user interface behavior and option interactions.
2.6.3 - 2026-01-07
- Added "Show Segment Length ≤20m" feature: Displays segment length in an orange circle overlay for segments 20 meters or shorter.
- Added "Check Geometry issues near node" feature: Detects intermediate geometry nodes that are too close (within 2m) to segment start/end nodes.
- Geometry issues are marked with pin (📍) icons on the map.
- Added one-click geometry fix button (bug icon) in the navigation bar to automatically fix all visible geometry issues (requires L3+ rank).
- Added notification badge showing count of geometry issues in the current view.
- Integrated Turf.js library for accurate geometry calculations and distance measurements.
- New settings toggles for both segment length display and geometry quality checking.
- Optimized performance with efficient map viewport tracking and label caching.
- Fixed various minor bugs and improved code stability.
2.6.2 - 2026-01-05
- Fixed auto city detection when "Set city as none" is unchecked. The script now properly checks connected segments for valid cities instead of defaulting to "None" when the displayed city is empty or unavailable.
2.6.1 - 2025-12-29
- Enhanced "Copy Connected Segment Attribute" feature:
  - Now copies all segment attributes including:
    - Direction (one-way A→B, B→A, or two-way)
    - Forward and reverse speed limits
    - Road type
    - Lock rank
    - Elevation level
    - Primary and alternate street names
    - Unpaved status
2.6.0.0 - 2025-12-28
- Added "Current" preset indicator: Shows which preset is currently loaded with a green badge.
- Current indicator disappears when settings are modified, reappears when saved back to the same preset.
- Fixed speed limit removal: Setting speed to 0 or -1 now properly removes speed limits (uses null instead of undefined).
- Improved speed limit update logic with better comparison handling.
- Preset list automatically refreshes when lock levels or speed values are modified.
2.5.9.8 - 2025-12-27
- Temporarily fix for alerts infos not showing issue.
2.5.9.7 - 2025-12-24
- Added custom preset system for saving and loading lock/speed configurations with custom names.
- Users can now save unlimited presets (e.g., "Custom 1", "Highway Settings", "City Streets").
- Load any saved preset with one click to quickly apply lock/speed settings.
- Delete unwanted presets with confirmation.
- Improved UI: Compact design with better spacing and dark mode support.
- Export/Import buttons reorganized into a cleaner layout.
- Preset items use semi-transparent backgrounds for better theme compatibility.
2.5.9.6 - 2025-08-05
- Bug fix: Enhanced "Copy Connected Segment Attribute" logic.
2.5.9.5 - 2025-07-31
- Minor bug fixes.
2.5.9.3 - 2025-07-04
- Updated logic for speed limit. Now it will not update speed limit set to 0 or -1.
2.5.9.2 - 2025-07-03-01
- improved logic for copy first connected segment name and/or city.
- Able to work with road type button in compact mode.
<b>2.5.9 - 2025-06-23</b><br>
- Added a confirmation popup before changing between Street and Footpath/Pedestrianised Area/Stairway types.<br>
- If you cancel, the segment will not be changed.<br>
- Prevents accidental deletion and recreation of special segment types.<br>
- Segment name copying now works for both one-way and two-way segments when converting to pedestrian types.<br>
- When "Copy connected Segment Name" is on, the script copies the name from the connected segment before conversion and applies it after.<br>
- Improved reliability for segment recreation and name copying.<br>
- Includes all previous improvements and bug fixes.<br>
2.5.8 - 2025-06-21</b><br>
- When "Set Street Name to None" is checked, the primary street is set to none and all alternate street names are removed.<br>
- When "Set city as none" is checked, all primary and alternate city names are set to none (empty city).<br>
- "Set street to none" now only handles the street name.<br>
- Added option for setting city to none.<br>
- Lock and speed settings can be exported or imported.<br>
- In case of shortcut key conflict, the shortcut key becomes null.<br>
- Default shortcut key is now "G".<br>
- Minor code cleanup.<br>
- Other behaviors remain unchanged.<br>
2.5.7.4 - 2025-06-15
        - Set street to none only handles street name now.
	   
        - Added option for setting up city to none.
        - The lock and speed setting can be exported or imported.
        - Incase of the shortcutkey conflict, the shortcut key becomes null.
        - Default shortcut key is now "G".
        - Minor code cleanup.
2.5.7 - 2025-06-13
        - Fixed: Autosave now works when "Copy Connected Segment Attribute" is enabled.
        - When both "Autosave on Action" and "Copy Connected Segment Attribute" are checked, pressing the quick update button or shortcut will copy attributes and then autosave.
        - All other options continue to function as before.
2.5.6 - 2025-06-08.02
        - minor bugfixes and UI improvements.
2.5.5 - 2025-06-08.01
        - Improved mutual exclusion logic for "Copy Connected Segment Attribute" and other checkboxes (except Autosave):
            - Checking "Copy Connected Segment Attribute" now unchecks all other options (except Autosave), but does not disable them.
            - Checking any other option (except Autosave) will uncheck "Copy Connected Segment Attribute".
        - Added tooltips for all checkbox options.
        - Fixed radio button selection logic for road types when using keyboard shortcuts.
        - Minor bugfixes and UI improvements.
2.5.5 - 2025-06-08.01
        - Minor bugfixes
2.5.4 - 2025-06-07.01
		    - Road Types can be selected using keyboard shortcuts.
        - Fully migrated to WME SDK.

2.5.3 - 2025-05-31
        - Improved shortcut keybind logic and UI.
        - The unpaved attribute is now copied in Non-compact mode.
        - Minor bug fixes.
2.5.2 - 2025-05-31
        - Improved shortcut keybind logic and UI.
        - Prevented double alerts and unnecessary alerts when keybind is empty.
        - Minor bug fixes.
2.5.1 - 2025-05-30
        - Added "Copy Connected Segment Attribute" option.
        - When enabled, all other options (except Autosave) are automatically unchecked.
        - Copies all major attributes from a connected segment: speed limit, primary name, alias name, city, paved/unpaved status, and lock level.
        - Ensures mutually exclusive logic for this option in the UI.

2.5.0 - 2025-05-29
        - Improved reliability of the unpaved toggle by adding a 500ms delay and fallback logic for both compact and non-compact UI modes.
        - Now ensures paved/unpaved status is always set correctly, regardless of UI mode.
        - Enhanced update logic: skips redundant updates for road type, lock, and speed if already set.
        - Improved city name and segment name copying logic, with more robust alerts and feedback.
        - UI improvements: disables lock/speed controls when their options are off; mutually exclusive logic for "Set Street To None" and "Copy connected Segment Name".
        - Improved logging for easier debugging and tracking.
        - Bug fixes and code cleanup for better reliability and maintainability.
2.4.9 - 2025-05-22
        - Improved reliability of unpaved toggle (500ms delay).
        - Minor bug fixes and code cleanup 
2.4.8 - 2025-05-21
        - Now pave/unpave works better. When unchecked, the segment will be paved!
2.4.7 - 2025-05-21
       Added support for copying alternative segment name from connected segment
       Thanks to -
        - MapOmatic, without him this would not be possible.
2.4.6 - 2025-05-20
       Added support for copying segment name from connected segment
       Limitation -
        - Currently Alt names wont be copied.
2.4.5 - 2025-05-11
       Added Support for HRCS
       Fixed -
        - Various other bugs        
		
*/
})();
