// ==UserScript==
// @name         WME EZRoad Mod
// @namespace    https://greasyfork.org/users/1087400
// @version      2.5.5
// @description  Easily update roads
// @author       https://github.com/michaelrosstarr, https://greasyfork.org/en/users/1087400-kid4rm90s
// @include 	   /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @exclude      https://www.waze.com/user/*editor/*
// @exclude      https://www.waze.com/*/user/*editor/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant 		   unsafeWindow
// @icon         https://www.google.com/s2/favicons?sz=64&domain=waze.com
// @license      GNU GPL(v3)
// @connect      greasyfork.org
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require      https://update.greasyfork.org/scripts/509664/WME%20Utils%20-%20Bootstrap.js
// @downloadURL https://update.greasyfork.org/scripts/528552/WME%20EZRoad%20Mod.user.js
// @updateURL https://update.greasyfork.org/scripts/528552/WME%20EZRoad%20Mod.meta.js
// ==/UserScript==

/*Script modified from WME EZRoad (https://greasyfork.org/en/scripts/518381-wme-ezsegments) original author: Michaelrosstarr and thanks to him*/

(function main() {
  'use strict';
  const updateMessage = `
<b>2.5.5 - 2025-06-08</b><br>
- Improved mutual exclusion logic for "Copy Connected Segment Attribute" and other checkboxes (except Autosave):<br>
&nbsp;&nbsp;- Checking "Copy Connected Segment Attribute" now unchecks all other options (except Autosave), but does not disable them.<br>
&nbsp;&nbsp;- Checking any other option (except Autosave) will uncheck "Copy Connected Segment Attribute".<br>
- Added tooltips for all checkbox options.<br>
- Fixed radio button selection logic for road types when using keyboard shortcuts.<br>
- Minor bugfixes and UI improvements.<br>`;
  const scriptName = GM_info.script.name;
  const scriptVersion = GM_info.script.version;
  const downloadUrl =
    'https://greasyfork.org/scripts/528552-wme-ezroad-mod/code/wme-ezroad-mod.user.js';
  let wmeSDK;

  const roadTypes = [
    { id: 1, name: 'Motorway', value: 3, shortcutKey: 'S+1' },
    { id: 2, name: 'Ramp', value: 4, shortcutKey: 'S+2' },
    { id: 3, name: 'Major Highway', value: 6, shortcutKey: 'S+3' },
    { id: 4, name: 'Minor Highway', value: 7, shortcutKey: 'S+4' },
    { id: 5, name: 'Primary Street', value: 2, shortcutKey: 'S+5' },
    { id: 6, name: 'Street', value: 1, shortcutKey: 'S+6' },
    { id: 7, name: 'Narrow Street', value: 22, shortcutKey: 'S+7' },
    { id: 8, name: 'Offroad', value: 8, shortcutKey: 'S+8' },
    { id: 9, name: 'Parking Road', value: 20, shortcutKey: 'S+9' },
    { id: 10, name: 'Private Road', value: 17, shortcutKey: 'S+0' },
    { id: 11, name: 'Ferry', value: 15, shortcutKey: 'A+1' },
    { id: 12, name: 'Railroad', value: 18, shortcutKey: 'A+2' },
    { id: 13, name: 'Runway/Taxiway', value: 19, shortcutKey: 'A+3' },
    { id: 14, name: 'Foothpath', value: 5, shortcutKey: 'A+4' },
    { id: 15, name: 'Pedestrianised Area', value: 10, shortcutKey: 'A+5' },
    { id: 16, name: 'Stairway', value: 16, shortcutKey: 'A+6' },
  ];
  const defaultOptions = {
    roadType: 1,
    unpaved: false,
    setStreet: false,
    autosave: false,
    setSpeed: 40,
    setLock: false,
    updateSpeed: false,
    copySegmentName: false,
    locks: roadTypes.map((roadType) => ({ id: roadType.id, lock: 1 })),
    speeds: roadTypes.map((roadType) => ({ id: roadType.id, speed: 40 })),
    copySegmentAttributes: false,
    shortcutKey: 'A+g',
  };

  const locks = [
    { id: 1, value: 1 },
    { id: 2, value: 2 },
    { id: 3, value: 3 },
    { id: 4, value: 4 },
    { id: 5, value: 5 },
    { id: 6, value: 6 },
    { id: 'HRCS', value: 'HRCS' },
  ];

  const log = (message) => {
    if (typeof message === 'string') {
      console.log('WME_EZRoads_Mod: ' + message);
    } else {
      console.log('WME_EZRoads_Mod: ', message);
    }
  };

  unsafeWindow.SDK_INITIALIZED.then(initScript);

  function initScript() {
    wmeSDK = getWmeSdk({
      scriptId: 'wme-ez-roads-mod',
      scriptName: 'EZ Roads Mod',
    });
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

  const saveOptions = (options) => {
    window.localStorage.setItem(
      'WME_EZRoads_Mod_Options',
      JSON.stringify(options)
    );
  };

  const getOptions = () => {
    const savedOptions =
      JSON.parse(window.localStorage.getItem('WME_EZRoads_Mod_Options')) || {};
    // Merge saved options with defaults to ensure all expected options exist
    return { ...defaultOptions, ...savedOptions };
  };

  const WME_EZRoads_Mod_bootstrap = () => {
    if (
      !document.getElementById('edit-panel') ||
      !wmeSDK.DataModel.Countries.getTopCountry()
    ) {
      setTimeout(WME_EZRoads_Mod_bootstrap, 250);
      return;
    }

    if (wmeSDK.State.isReady) {
      WME_EZRoads_Mod_init();
    } else {
      wmeSDK.Events.once({ eventName: 'wme-ready' }).then(
        WME_EZRoads_Mod_init()
      );
    }
  };

  let openPanel;

  const WME_EZRoads_Mod_init = () => {
    log('Initing');

    const options = getOptions();
    const shortcutId = 'EZRoad_Mod_QuickUpdate';
    // Only register if not already present
    if (!wmeSDK.Shortcuts.isShortcutRegistered({ shortcutId })) {
      registerShortcut(options.shortcutKey || 'A+g');
    }

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
              if (
                !parentElement.querySelector('[data-ez-roadmod-button="true"]')
              ) {
                log('Creating Quick Set Road button for this panel');
                const quickButton = document.createElement('wz-button');
                quickButton.setAttribute('type', 'button');
                quickButton.setAttribute(
                  'style',
                  'margin-bottom: 5px; width: 100%'
                );
                quickButton.setAttribute('disabled', 'false');
                quickButton.setAttribute('data-ez-roadmod-button', 'true');
                quickButton.setAttribute(
                  'id',
                  'ez-roadmod-quick-button-' + Date.now()
                ); // Unique ID using timestamp
                quickButton.classList.add('send-button', 'ez-comment-button');
                quickButton.textContent = 'Quick Update Segment';
                parentElement.insertBefore(quickButton, editSegment);
                quickButton.addEventListener('mousedown', () => handleUpdate());
                log('Button created for current panel');
              } else {
                log('This panel already has the button, skipping creation');
              }
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

    // Register shortcut for each road type (move here, after handleUpdate is defined)
    roadTypes.forEach((rt) => {
      const shortcutId = `EZRoad_Mod_SelectRoadType_${rt.id}`;
      // Prevent duplicate shortcut registration
      if (!wmeSDK.Shortcuts.isShortcutRegistered({ shortcutId })) {
        try {
          wmeSDK.Shortcuts.createShortcut({
            callback: () => {
              const options = getOptions();
              options.roadType = rt.value;
              saveOptions(options);
              updateRoadTypeRadios(rt.value);
              if (WazeWrap?.Alerts) {
                WazeWrap.Alerts.success(
                  'EZRoads Mod',
                  `Selected road type: <b>${rt.name}</b>`,
                  false,
                  false,
                  1500
                );
              }
            },
            description: `Select road type: ${rt.name}`,
            shortcutId,
            shortcutKeys: rt.shortcutKey,
          });
        } catch (e) {
          log(`Shortcut registration failed for ${rt.name}: ${e}`);
        }
      }
    });

    log('Completed Init');
  };

  // Helper to register the shortcut, avoids duplicate code
  function registerShortcut(shortcutKey) {
    if (!wmeSDK?.Shortcuts) return;
    const shortcutId = 'EZRoad_Mod_QuickUpdate';
    // Always delete before creating to avoid duplicates
    if (wmeSDK.Shortcuts.isShortcutRegistered({ shortcutId })) {
      wmeSDK.Shortcuts.deleteShortcut({ shortcutId });
    }
    wmeSDK.Shortcuts.createShortcut({
      callback: handleUpdate,
      description: 'Quick Update Segments.',
      shortcutId,
      shortcutKeys: shortcutKey,
    });
    console.log(
      `[EZRoads Mod] Shortcut '${shortcutKey}' for Quick Update Segments enabled.`
    );
  }

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
      console.warn(
        `Segment object with ID ${segID} not found in DataModel.Segments.`
      );
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
      const forNodeSegs = allSegs
        .filter((s) => s.fromNodeId === forNodeId || s.toNodeId === forNodeId)
        .map((s) => s.id);

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
      const revNodeSegs = allSegs
        .filter((s) => s.fromNodeId === revNodeId || s.toNodeId === revNodeId)
        .map((s) => s.id);

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
      const city = wmeSDK.DataModel.Cities.getById({ cityId });
      cityName = city && city.name ? city.name : '';
    }
    alertMessageParts.push(`City Name: <b>${cityName || 'None'}</b>`);
  }

  const handleUpdate = () => {
    const selection = wmeSDK.Editing.getSelection();

    if (!selection || selection.objectType !== 'segment') return;

    log('Updating RoadType');
    const options = getOptions();
    let alertMessageParts = [];
    let updatedRoadType = false;
    let updatedLockLevel = false;
    let updatedSpeedLimit = false;
    let updatedPaved = false;
    let updatedCityName = false;
    let updatedSegmentName = false;
    const updatePromises = [];

    // If copySegmentAttributes is checked, copy all attributes from a connected segment
    if (options.copySegmentAttributes) {
      selection.ids.forEach((id) => {
        updatePromises.push(
          delayedUpdate(() => {
            try {
              const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
              const fromNode = seg.fromNodeId;
              const toNode = seg.toNodeId;
              let connectedSegId = null;
              const allSegs = wmeSDK.DataModel.Segments.getAll();
              for (let s of allSegs) {
                if (
                  s.id !== id &&
                  (s.fromNodeId === fromNode ||
                    s.toNodeId === fromNode ||
                    s.fromNodeId === toNode ||
                    s.toNodeId === toNode)
                ) {
                  connectedSegId = s.id;
                  break;
                }
              }
              if (connectedSegId) {
                const connectedSeg = wmeSDK.DataModel.Segments.getById({
                  segmentId: connectedSegId,
                });
                // Copy speed limits
                wmeSDK.DataModel.Segments.updateSegment({
                  segmentId: id,
                  fwdSpeedLimit: connectedSeg.fwdSpeedLimit,
                  revSpeedLimit: connectedSeg.revSpeedLimit,
                  roadType: connectedSeg.roadType,
                  lockRank: connectedSeg.lockRank,
                });
                // Copy address (primary, alt, city)
                wmeSDK.DataModel.Segments.updateAddress({
                  segmentId: id,
                  primaryStreetId: connectedSeg.primaryStreetId,
                  alternateStreetIds: connectedSeg.alternateStreetIds || [],
                });
                // Copy paved/unpaved
                const isUnpaved =
                  connectedSeg.flagAttributes &&
                  connectedSeg.flagAttributes.unpaved === true;
                let toggled = false;
                const segPanel = openPanel;
                if (segPanel) {
                  const unpavedIcon = segPanel.querySelector(
                    '.w-icon-unpaved-fill'
                  );
                  if (unpavedIcon) {
                    const unpavedChip =
                      unpavedIcon.closest('wz-checkable-chip');
                    if (unpavedChip) {
                      if (
                        isUnpaved !==
                        (seg.flagAttributes &&
                          seg.flagAttributes.unpaved === true)
                      ) {
                        unpavedChip.click();
                        toggled = true;
                      }
                    }
                  }
                  // Fallback for non-compact mode if compact mode failed
                  if (!toggled) {
                    try {
                      const wzCheckbox = segPanel.querySelector(
                        'wz-checkbox[name="unpaved"]'
                      );
                      if (wzCheckbox) {
                        const hiddenInput = wzCheckbox.querySelector(
                          'input[type="checkbox"][name="unpaved"]'
                        );
                        if (hiddenInput && hiddenInput.checked !== isUnpaved) {
                          hiddenInput.click();
                          toggled = true;
                        }
                      }
                    } catch (e) {
                      log(
                        'Fallback to non-compact mode unpaved toggle method failed: ' +
                          e
                      );
                    }
                  }
                }
                alertMessageParts.push(
                  `Copied all attributes from connected segment.`
                );
              } else {
                alertMessageParts.push(
                  `No connected segment found to copy attributes.`
                );
              }
            } catch (error) {
              console.error('Error copying all attributes:', error);
            }
          }, 100)
        );
      });
      Promise.all(updatePromises).then(() => {
        if (alertMessageParts.length) {
          if (WazeWrap?.Alerts) {
            WazeWrap.Alerts.info(
              'EZRoads Mod',
              alertMessageParts.join('<br>'),
              false,
              false,
              7000
            );
          } else {
            alert('EZRoads Mod: ' + alertMessageParts.join('\n'));
          }
        }
      });
      return; // Skip normal update logic if copying all attributes
    }

    selection.ids.forEach((id) => {
      // Road Type
      updatePromises.push(
        delayedUpdate(() => {
          if (options.roadType) {
            const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
            const selectedRoad = roadTypes.find(
              (rt) => rt.value === options.roadType
            );
            //alertMessageParts.push(`Road Type: <b>${selectedRoad.name}</b>`);
            //updatedRoadType = true;
            log(
              `Segment ID: ${id}, Current Road Type: ${seg.roadType}, Target Road Type: ${options.roadType}, Target Road Name : ${selectedRoad.name}`
            ); // Log current and target road type
            if (seg.roadType === options.roadType) {
              log(
                `Segment ID: ${id} already has the target road type: ${options.roadType}. Skipping update.`
              );
              alertMessageParts.push(
                `Road Type: <b>${selectedRoad.name} exists. Skipping update.</b>`
              );
              updatedRoadType = true;
            } else {
              try {
                wmeSDK.DataModel.Segments.updateSegment({
                  segmentId: id,
                  roadType: options.roadType,
                });
                log('Road type updated successfully.');
                alertMessageParts.push(
                  `Road Type: <b>${selectedRoad.name}</b>`
                );
                updatedRoadType = true;
              } catch (error) {
                console.error('Error updating road type:', error);
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
            const selectedRoad = roadTypes.find(
              (rt) => rt.value === options.roadType
            );
            if (selectedRoad) {
              let lockSetting = options.locks.find(
                (l) => l.id === selectedRoad.id
              );
              if (lockSetting) {
                let toLock = lockSetting.lock;
                if (toLock === 'HRCS') {
                  toLock = getHighestSegLock(id);
                } else {
                  toLock = parseInt(toLock, 10);
                  toLock = Math.max(toLock - 1, 0); // Adjust to 0-based rank, ensuring it does not go below 0
                }

                if (rank < toLock) toLock = rank;

                log(toLock);

                try {
                  const seg = wmeSDK.DataModel.Segments.getById({
                    segmentId: id,
                  });
                  let displayLockLevel =
                    toLock === 'HRCS' || isNaN(toLock)
                      ? 'HRCS'
                      : `L${toLock + 1}`;
                  let currentDisplayLockLevel;
                  if (seg.lockRank === 'HRCS') {
                    // Should not happen, but for safety
                    currentDisplayLockLevel = 'HRCS';
                  } else {
                    currentDisplayLockLevel = `L${seg.lockRank + 1}`;
                  }
                  if (
                    seg.lockRank === toLock ||
                    (lockSetting.lock === 'HRCS' &&
                      currentDisplayLockLevel === displayLockLevel)
                  ) {
                    // Compare lock levels
                    log(
                      `Segment ID: ${id} already has the target lock level: ${displayLockLevel}. Skipping update.`
                    );
                    alertMessageParts.push(
                      `Lock Level: <b>${displayLockLevel} exists. Skipping update.</b>`
                    );
                    updatedLockLevel = true;
                  } else {
                    wmeSDK.DataModel.Segments.updateSegment({
                      segmentId: id,
                      lockRank: toLock,
                    });
                    alertMessageParts.push(
                      `Lock Level: <b>${displayLockLevel}</b>`
                    );
                    updatedLockLevel = true;
                  }
                } catch (error) {
                  console.error('Error updating segment lock rank:', error);
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
            const selectedRoad = roadTypes.find(
              (rt) => rt.value === options.roadType
            );
            if (selectedRoad) {
              const speedSetting = options.speeds.find(
                (s) => s.id === selectedRoad.id
              );
              log('Selected road for speed: ' + selectedRoad.name);
              log('Speed setting found: ' + (speedSetting ? 'yes' : 'no'));

              if (speedSetting) {
                const speedValue = parseInt(speedSetting.speed, 10);
                log('Speed value to set: ' + speedValue);

                // Apply speed if it's a valid number (including 0)
                if (!isNaN(speedValue) && speedValue >= 0) {
                  log('Applying speed: ' + speedValue);
                  const seg = wmeSDK.DataModel.Segments.getById({
                    segmentId: id,
                  });
                  if (
                    seg.fwdSpeedLimit !== speedValue ||
                    seg.revSpeedLimit !== speedValue
                  ) {
                    wmeSDK.DataModel.Segments.updateSegment({
                      segmentId: id,
                      fwdSpeedLimit: speedValue,
                      revSpeedLimit: speedValue,
                    });
                    alertMessageParts.push(`Speed Limit: <b>${speedValue}</b>`);
                    updatedSpeedLimit = true;
                  } else {
                    log(
                      `Segment ID: ${id} already has the target speed limit: ${speedValue}. Skipping update.`
                    );
                    alertMessageParts.push(
                      `Speed Limit: <b>${speedValue} exists. Skipping update.</b>`
                    );
                    updatedSpeedLimit = true;
                  }
                  //alertMessageParts.push(`Speed Limit: <b>${speedValue}</b>`);
                  //updatedSpeedLimit = true;
                } else {
                  log(
                    'Not applying speed - invalid value: ' + speedSetting.speed
                  );
                  alertMessageParts.push(
                    `Speed Limit: <b>Invalid value ${speedValue}</b>`
                  );
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
      if (options.setStreet) {
        let city;
        let street;
        city = getTopCity() || getEmptyCity();
        street = wmeSDK.DataModel.Streets.getStreet({
          cityId: city.id,
          streetName: '',
        });
        log(
          `City Name: ${city?.name}, City ID: ${city?.id}, Street ID: ${street?.id}`
        );
        if (!street) {
          street = wmeSDK.DataModel.Streets.addStreet({
            streetName: '',
            cityId: city.id,
          });
          log(`Created new empty street. Street ID: ${street?.id}`);
        }
        try {
          wmeSDK.DataModel.Segments.updateAddress({
            segmentId: id,
            primaryStreetId: street.id,
          });
          pushCityNameAlert(city.id, alertMessageParts);
          updatedCityName = true;
        } catch (error) {
          console.error('Error updating segment address:', error);
        }
      }

      log(options);

      // Updated unpaved handler with SegmentFlagAttributes and fallback
      updatePromises.push(
        delayedUpdate(() => {
          if (options.unpaved) {
            const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
            const isUnpaved =
              seg.flagAttributes && seg.flagAttributes.unpaved === true;
            let unpavedToggled = false;

            if (!isUnpaved) {
              // Only click if segment is not already unpaved
              const unpavedIcon = openPanel.querySelector(
                '.w-icon-unpaved-fill'
              );
              if (unpavedIcon) {
                const unpavedChip = unpavedIcon.closest('wz-checkable-chip');
                if (unpavedChip) {
                  unpavedChip.click();
                  log('Clicked unpaved chip (set to unpaved)');
                  unpavedToggled = true;
                }
              }
              // If new method failed, try the old method as fallback for non-compact mode
              if (!unpavedToggled) {
                try {
                  const wzCheckbox = openPanel.querySelector(
                    'wz-checkbox[name="unpaved"]'
                  );
                  if (wzCheckbox) {
                    const hiddenInput = wzCheckbox.querySelector(
                      'input[type="checkbox"][name="unpaved"]'
                    );
                    if (hiddenInput && !hiddenInput.checked) {
                      hiddenInput.click();
                      log(
                        'Clicked unpaved checkbox (set to unpaved, non-compact mode)'
                      );
                      unpavedToggled = true;
                    }
                  }
                } catch (e) {
                  log(
                    'Fallback to non-compact mode unpaved toggle method failed: ' +
                      e
                  );
                }
              }
              if (unpavedToggled) {
                alertMessageParts.push(`Paved Status: <b>Unpaved</b>`);
                updatedPaved = true;
              }
            } else {
              // Already unpaved, no action needed
              alertMessageParts.push(
                `Paved Status: <b>Unpaved (already set)</b>`
              );
              updatedPaved = true;
            }
          } else {
            // If option is not checked and segment is unpaved, set it as paved
            const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
            const isUnpaved =
              seg.flagAttributes && seg.flagAttributes.unpaved === true;
            let pavedToggled = false;

            if (isUnpaved) {
              // Click to set as paved
              const unpavedIcon = openPanel.querySelector(
                '.w-icon-unpaved-fill'
              );
              if (unpavedIcon) {
                const unpavedChip = unpavedIcon.closest('wz-checkable-chip');
                if (unpavedChip) {
                  unpavedChip.click();
                  log('Clicked unpaved chip (set to paved)');
                  pavedToggled = true;
                }
              }
              // If new method failed, try the old method as fallback for non-compact mode
              if (!pavedToggled) {
                try {
                  const wzCheckbox = openPanel.querySelector(
                    'wz-checkbox[name="unpaved"]'
                  );
                  if (wzCheckbox) {
                    const hiddenInput = wzCheckbox.querySelector(
                      'input[type="checkbox"][name="unpaved"]'
                    );
                    if (hiddenInput && hiddenInput.checked) {
                      hiddenInput.click();
                      log(
                        'Clicked unpaved checkbox (set to paved, non-compact mode)'
                      );
                      pavedToggled = true;
                    }
                  }
                } catch (e) {
                  log(
                    'Fallback to non-compact mode paved toggle method failed: ' +
                      e
                  );
                }
              }
              if (pavedToggled) {
                alertMessageParts.push(`Paved Status: <b>Paved</b>`);
                updatedPaved = true;
              }
            } else {
              // Already paved, no action needed
              alertMessageParts.push(
                `Paved Status: <b>Paved (already set)</b>`
              );
              updatedPaved = true;
            }
          }
        }, 500)
      ); // 500ms delay for unpaved/paved toggle

      // 3a. Copy segment name from connected segment if enabled
      updatePromises.push(
        delayedUpdate(() => {
          if (options.copySegmentName) {
            try {
              const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
              const fromNode = seg.fromNodeId;
              const toNode = seg.toNodeId;
              let connectedSegId = null;
              const allSegs = wmeSDK.DataModel.Segments.getAll();
              for (let s of allSegs) {
                if (
                  s.id !== id &&
                  (s.fromNodeId === fromNode ||
                    s.toNodeId === fromNode ||
                    s.fromNodeId === toNode ||
                    s.toNodeId === toNode)
                ) {
                  connectedSegId = s.id;
                  break;
                }
              }
              if (connectedSegId) {
                const connectedSeg = wmeSDK.DataModel.Segments.getById({
                  segmentId: connectedSegId,
                });
                const streetId = connectedSeg.primaryStreetId;
                const altStreetIds = connectedSeg.alternateStreetIds || [];
                const street = wmeSDK.DataModel.Streets.getById({ streetId });
                // Get alternate street names
                let altNames = [];
                altStreetIds.forEach((streetId) => {
                  const altStreet = wmeSDK.DataModel.Streets.getById({
                    streetId,
                  });
                  if (altStreet && altStreet.name)
                    altNames.push(altStreet.name);
                });
                if (
                  street &&
                  (street.name || street.englishName || street.signText)
                ) {
                  wmeSDK.DataModel.Segments.updateAddress({
                    segmentId: id,
                    primaryStreetId: streetId,
                    alternateStreetIds: altStreetIds,
                  });
                  let aliasMsg = altNames.length
                    ? ` (Alternatives: ${altNames.join(', ')})`
                    : '';
                  alertMessageParts.push(
                    `Copied Name: <b>${street.name || ''}</b>${aliasMsg}`
                  );
                  updatedSegmentName = true;
                } else {
                  alertMessageParts.push(
                    `Copied Name: <b>None (connected segment has no name)</b>`
                  );
                  updatedSegmentName = true;
                }
                // Always push city name as a separate alert
                pushCityNameAlert(street.cityId, alertMessageParts);
                updatedCityName = true;
              } else {
                alertMessageParts.push(
                  `Copied Name: <b>None (no connected segment found)</b>`
                );
                updatedSegmentName = true;
              }
            } catch (error) {
              console.error('Error copying segment name:', error);
            }
          }
        }, 100)
      ); // Run early in the update chain
    });

    Promise.all(updatePromises).then(() => {
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
        if (updatedCityName)
          updatedFeatures.push(
            alertMessageParts.find((part) => part.startsWith('City'))
          );
        if (updatedSegmentName)
          updatedFeatures.push(
            alertMessageParts.find((part) => part.startsWith('Copied Name'))
          );
        if (updatedRoadType)
          updatedFeatures.push(
            alertMessageParts.find((part) => part.startsWith('Road Type'))
          );
        if (updatedLockLevel)
          updatedFeatures.push(
            alertMessageParts.find((part) => part.startsWith('Lock Level'))
          );
        if (updatedSpeedLimit)
          updatedFeatures.push(
            alertMessageParts.find((part) => part.startsWith('Speed Limit'))
          );
        if (updatedPaved)
          updatedFeatures.push(
            alertMessageParts.find((part) => part.startsWith('Paved'))
          );
        const message = updatedFeatures.filter(Boolean).join(', ');
        if (message) {
          if (WazeWrap?.Alerts) {
            WazeWrap.Alerts.info(
              'EZRoads Mod',
              `Segment updated with: ${message}`,
              false,
              false,
              7000
            );
          } else {
            alert(
              'EZRoads Mod: Segment updated (WazeWrap Alerts not available)'
            );
          }
        }
      };

      // Autosave - DELAYED AUTOSAVE
      if (options.autosave) {
        setTimeout(() => {
          log('Delayed Autosave starting...');
          wmeSDK.Editing.save().then(() => {
            log('Delayed Autosave completed.');
            showAlert();
          });
        }, 600); // 1000ms (1 second) delay before autosave
      } else {
        showAlert();
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
        if (WazeWrap?.Alerts) {
          WazeWrap.Alerts.success(
            'EZRoads Mod',
            'Lock Levels saved!',
            false,
            false,
            1500
          );
        } else {
          alert('EZRoads Mod: Lock Levels saved!');
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
        if (WazeWrap?.Alerts) {
          WazeWrap.Alerts.success(
            'EZRoads Mod',
            'Speed Values saved!',
            false,
            false,
            1500
          );
        } else {
          alert('EZRoads Mod: Speed Values saved!');
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
        text: 'Set Street To None',
        key: 'setStreet',
        tooltip:
          'Removes the street name (sets to None) for selected segments.',
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
        tooltip:
          'Sets the lock level for the selected road type. It also enables the lock level dropdown.',
      },
      {
        id: 'updateSpeed',
        text: 'Update speed limits',
        key: 'updateSpeed',
        tooltip:
          'Updates the speed limit for the selected road type. it also enables the speed input field.',
      },
      {
        id: 'copySegmentName',
        text: 'Copy connected Segment Name',
        key: 'copySegmentName',
        tooltip:
          'Copies the name from a connected segment to the selected segment.',
      },
      {
        id: 'copySegmentAttributes',
        text: 'Copy Connected Segment Attribute',
        key: 'copySegmentAttributes',
        tooltip:
          'Copies all major attributes from a connected segment. When enabled, it will override the other options.',
      },
    ];

    // Helper function to create radio buttons
    const createRadioButton = (roadType) => {
      const id = `road-${roadType.id}`;
      const isChecked = localOptions.roadType === roadType.value;
      const lockSetting = localOptions.locks.find(
        (l) => l.id === roadType.id
      ) || { id: roadType.id, lock: 1 };
      const speedSetting = localOptions.speeds.find(
        (s) => s.id === roadType.id
      ) || { id: roadType.id, speed: 40 };

      const div = $(`<div class="ezroadsmod-option">
            <div class="ezroadsmod-radio-container">
                <input type="radio" id="${id}" name="defaultRoad" data-road-value="${
        roadType.value
      }" ${isChecked ? 'checked' : ''}>
                <label for="${id}">${roadType.name}</label>
                <select id="lock-level-${
                  roadType.id
                }" class="road-lock-level" data-road-id="${roadType.id}" ${
        !localOptions.setLock ? 'disabled' : ''
      }>
                    ${locks
                      .map(
                        (lock) =>
                          `<option value="${lock.value}" ${
                            lockSetting.lock === lock.value ? 'selected' : ''
                          }>${
                            lock.value === 'HRCS' ? 'HRCS' : 'L' + lock.value
                          }</option>`
                      )
                      .join('')}
                </select>
                <input type="number" id="speed-${
                  roadType.id
                }" class="road-speed" data-road-id="${roadType.id}"
                       value="${speedSetting.speed}" min="-1" ${
        !localOptions.updateSpeed ? 'disabled' : ''
      }>
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
      const otherClass =
        option.key !== 'autosave' && option.key !== 'copySegmentAttributes'
          ? 'ezroadsmod-other-checkbox'
          : '';
      const attrClass =
        option.key === 'copySegmentAttributes'
          ? 'ezroadsmod-attr-checkbox'
          : '';
      const div = $(`<div class="ezroadsmod-option">
    <input type="checkbox" id="${option.id}" name="${
        option.id
      }" class="${otherClass} ${attrClass}" ${
        isChecked ? 'checked' : ''
      } title="${option.tooltip || ''}">
    <label for="${option.id}" title="${option.tooltip || ''}">${
        option.text
      }</label>
  </div>`);
      div.on('click', () => {
        // Mutually exclusive logic for setStreet and copySegmentName
        if (option.key === 'setStreet' && $(`#${option.id}`).prop('checked')) {
          $('#copySegmentName').prop('checked', false);
          update('copySegmentName', false);
        }
        if (
          option.key === 'copySegmentName' &&
          $(`#${option.id}`).prop('checked')
        ) {
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
        } else if (option.key !== 'autosave') {
          // If any other checkbox (except autosave) is checked, uncheck copySegmentAttributes
          if ($(`#${option.id}`).prop('checked')) {
            $('#copySegmentAttributes').prop('checked', false);
            update('copySegmentAttributes', false);
          }
          update(option.key, $(`#${option.id}`).prop('checked'));
        } else {
          // Autosave
          update(option.key, $(`#${option.id}`).prop('checked'));
        }
      });
      return div;
    };

    // -- Set up the tab for the script
    wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
      tabLabel.innerText = 'EZRoads Mod';
      tabLabel.title = 'Easily Update Roads';

      // Setup base styles
      const styles = $(`<style>
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
                width: 60px;
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
        </style>`);

      tabPane.innerHTML = '<div id="ezroadsmod-settings"></div>';
      const scriptContentPane = $('#ezroadsmod-settings');
      scriptContentPane.append(styles);

      // Header section
      const header = $(`<div class="ezroadsmod-section">

		<h2>EZRoads Mod</h2>
		<div>Current Version: <b>${scriptVersion}</b></div>
		<div>Update Keybind: <kbd>Alt+G</kbd></div>
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
      const resetButton = $(
        `<button class="ezroadsmod-reset-button">Reset All Options</button>`
      );
      resetButton.on('click', function () {
        if (
          confirm(
            'Are you sure you want to reset all options to default values? It will reload the webpage!'
          )
        ) {
          resetOptions();
        }
      });
      scriptContentPane.append(resetButton);
    });
  };
  function scriptupdatemonitor() {
    if (WazeWrap?.Ready) {
      bootstrap({ scriptUpdateMonitor: { downloadUrl } });
      WazeWrap.Interface.ShowScriptUpdate(
        scriptName,
        scriptVersion,
        updateMessage
      );
    } else {
      setTimeout(scriptupdatemonitor, 250);
    }
  }
  // Start the "scriptupdatemonitor"
  scriptupdatemonitor();
  console.log(`${scriptName} initialized.`);

  /*
Change Log

Version
2.5.5 - 2025-06-08
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
