## WME EZRoad Mod

Script modified from [WME EZRoad](https://greasyfork.org/scripts/518381-wme-ezsegments) (original author: Michaelrosstarr). Thanks to him!

WME EZRoad Mod is a powerful enhancement for the Waze Map Editor, designed to streamline and automate common road segment updates.

---

### Key Features

- **Quick Update Button**: Instantly apply your preferred settings to selected segments with a single click or by pressing your chosen shortcut key (default: <kbd>g</kbd>).
- **Road Type, Lock, and Speed**: Easily set road type, lock level (including HRCS), and speed limits for multiple segments at once.
- **Paved/Unpaved Toggle**: Automatically set segments as paved or unpaved based on your selection.
  - _If "Set as Unpaved" is unchecked, the script will set the segment as paved._
- **Street Name Tools**: Set the street to "None" or copy the name (including alternate names) from a connected segment.
- **Copy Connected Segment Attributes**: Optionally copy all major attributes (speed, name, city, paved/unpaved, lock) from a connected segment.
- **Autosave**: Optionally save changes automatically after updates.
- **Highly Customizable**: Configure default options for each road type, including lock level and speed. Export/import lock and speed settings.
- **User-Friendly Interface**: All options are accessible from a dedicated sidebar tab in WME, including shortcut key customization and tooltips for each option.
- **Smart Pedestrian Handling**: When switching between pedestrian and non-pedestrian road types, the script will prompt for confirmation and safely recreate the segment if needed, preserving names where possible.
- ***Use with native Roadtype button***: All the roadtypes' properties also can be easily updated directly based on checkboxes selected by clicking at roadtypes in 'Segment Edit Panel' in compact mode.

---

### How to Use

1. Open Waze Map Editor and select one or more segments.
2. Open the **EZRoads Mod** tab in the sidebar to configure your settings.
3. Click the **Quick Update Segment** button or press your shortcut key (default: <kbd>g</kbd>) to apply your changes.
4. For each Road type, the keyboard shortcuts are as below:  
   a. Motorway —------------shortcut key: <kbd>Shift+1</kbd>  
   b. Ramp —----------------shortcut key: <kbd>Shift+2</kbd>  
   c. Major Highway —-------shortcut key: <kbd>Shift+3</kbd>  
   d. Minor Highway —-------shortcut key: <kbd>Shift+4</kbd>  
   e. Primary Street —------shortcut key: <kbd>Shift+5</kbd>  
   f. Street —--------------shortcut key: <kbd>Shift+6</kbd>  
   g. Narrow Street —-------shortcut key: <kbd>Shift+7</kbd>  
   h. Offroad —-------------shortcut key: <kbd>Shift+8</kbd>  
   i. Parking Road —--------shortcut key: <kbd>Shift+9</kbd>  
   j. Private Road —--------shortcut key: <kbd>Shift+0</kbd>  
   k. Ferry —---------------shortcut key: <kbd>Alt+1</kbd>  
   l. Railroad —------------shortcut key: <kbd>Alt+2</kbd>  
   m. Runway ---------------shortcut key: <kbd>Alt+3</kbd>  
   n. Footpath —------------shortcut key: <kbd>Alt+4</kbd>  
   o. Pedestrianised Area —-shortcut key: <kbd>Alt+5</kbd>  
   p. Stairway —------------shortcut key: <kbd>Alt+6</kbd>

---

### Changelog

See the script comments for a full version history.

---

### Support

For questions, suggestions, or bug reports, please contact the authors via [Greasy Fork](https://greasyfork.org/scripts/528552-wme-ezroad-mod/feedback).

### Note:

- When "Copy Connected Segment Attribute" is enabled, all other options (except Autosave) are automatically unchecked for safety.
- When switching between pedestrian and non-pedestrian types, the script will prompt for confirmation and handle segment recreation as needed.
- Speed limits set to 0 or -1 will not be applied (treated as unset).
- Export/import your lock and speed settings for easy backup or sharing.
