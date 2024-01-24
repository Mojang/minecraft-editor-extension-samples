// Copyright (c) Mojang AB.  All rights reserved.

import {
    ActionTypes,
    IDropdownItem,
    IDropdownPropertyItem,
    IModalTool,
    IPlayerUISession,
    IPropertyPane,
    ModalToolLifecycleEventPayload,
    UserDefinedTransactionHandle,
    bindDataSource,
    registerEditorExtension,
    registerUserDefinedTransactionHandler,
    stringFromException,
} from '@minecraft/server-editor';
import { Vector3, system } from '@minecraft/server';

const storedLocationDynamicPropertyName = 'goto-mark:storedLocations'; // The key of the stored location dynamic property
const storedLocationNameMaxLength = 16; // This is the maximum length of the name of a stored location
const storedLocationsMax = 9; // The maximum number of stored locations

type GotoTeleportTransactionPayload = {
    current: Vector3;
    destination: Vector3;
};

// The stored location data structure that represents each of the stored locations
// this is also the JSON format that is stored in the dynamic property
type LocationData = {
    location: Vector3;
    name: string;
};

// UI Pane data for the whole extension pane
type ParentPaneDataSourceType = {
    playerLocation: Vector3;
};

// UI Pane data for the sub pane with the stored locations
type LocationPaneDataSourceType = {
    currentSelection: number;
    newName: string;
};

// Extension storage data which is pertinent to the the player's context of this extension
type ExtensionStorage = {
    tool?: IModalTool; // The tool handle for the extension
    previousLocation: Vector3; // The players last recorded position

    updateHandle?: number; // The handle for the repeating interval that updates the player position

    parentPaneDataSource?: ParentPaneDataSourceType; // The data source for the parent pane
    parentPane?: IPropertyPane; // The parent pane
    dropdownMenu?: IDropdownPropertyItem<LocationPaneDataSourceType, 'currentSelection'>; // The dropdown

    locationPaneDataSource?: LocationPaneDataSourceType; // The data source for the location pane

    storedLocations: LocationData[]; // The list of stored locations

    transactionHandler: UserDefinedTransactionHandle<GotoTeleportTransactionPayload>; // The transaction handler for the extension
};

// Handy helper to turn a Vector3 into a pretty string
function vector3ToString(vec: Vector3): string {
    return `(${vec.x}, ${vec.y}, ${vec.z})`;
}

// Equality check for a Vector3
function vector3Equals(vec1: Vector3, vec2: Vector3): boolean {
    return vec1.x === vec2.x && vec1.y === vec2.y && vec1.z === vec2.z;
}

// Truncate a Vector3 to the nearest block
function vector3Truncate(vec: Vector3): Vector3 {
    const blockLocation: Vector3 = { x: Math.floor(vec.x), y: Math.floor(vec.y), z: Math.floor(vec.z) };
    return blockLocation;
}

function mapDropdownItems(storage: ExtensionStorage): IDropdownItem[] {
    return storage.storedLocations.map((v, index): IDropdownItem => {
        const item: IDropdownItem = {
            displayAltText: `${index + 1}: ${v.name} (${vector3ToString(v.location)})`,
            displayStringId: 'NO_ID',
            value: index,
        };
        return item;
    });
}

function createTransaction(uiSession: IPlayerUISession<ExtensionStorage>, current: Vector3, destination: Vector3) {
    const transactionPayload: GotoTeleportTransactionPayload = {
        current,
        destination,
    };
    if (!uiSession.scratchStorage) {
        return;
    }

    uiSession.extensionContext.transactionManager.openTransaction('goto position');
    uiSession.scratchStorage.transactionHandler.addUserDefinedOperation(transactionPayload, 'Goto(Teleport)');
    uiSession.extensionContext.transactionManager.commitOpenTransaction();
}

function teleportTo(uiSession: IPlayerUISession<ExtensionStorage>, destination: Vector3) {
    createTransaction(uiSession, uiSession.extensionContext.player.location, destination);
    uiSession.log.info(`Teleporting to location ${vector3ToString(destination)}`);
    try {
        uiSession.extensionContext.player.teleport(destination);
    } catch (e) {
        uiSession.log.error(`Teleport failed: ${stringFromException(e)}`);
    }
}

// Add the extension to the tool rail and give it an icon
// Also, set up an activation handler to show/hide the pane when the tool is activated/deactivated
function addExtensionTool(uiSession: IPlayerUISession<ExtensionStorage>, storage: ExtensionStorage): IModalTool {
    const tool = uiSession.toolRail.addTool({
        displayAltText: 'Goto Mark',
        displayStringId: 'sample.gotomark.tool.title',
        icon: 'pack://textures/goto-mark.png',
        tooltipAltText: 'Set or Jump to a stored location',
        tooltipStringId: 'sample.gotomark.tool.tooltip',
    });

    tool.onModalToolActivation.subscribe((eventData: ModalToolLifecycleEventPayload) => {
        if (eventData.isActiveTool) {
            storage.parentPane?.show();
        } else {
            storage.parentPane?.hide();
        }
    });

    return tool;
}

function buildParentPane(uiSession: IPlayerUISession<ExtensionStorage>, storage: ExtensionStorage): IPropertyPane {
    const parentPane = uiSession.createPropertyPane({
        titleAltText: 'Goto Mark',
        titleStringId: 'sample.gotomark.pane.title',
        width: 50,
    });

    const currentLocation = vector3Truncate(uiSession.extensionContext.player.location);
    const initialPaneData: ParentPaneDataSourceType = {
        playerLocation: currentLocation,
    };
    storage.parentPaneDataSource = bindDataSource(parentPane, initialPaneData);
    storage.previousLocation = currentLocation;

    parentPane.addVector3(storage.parentPaneDataSource, 'playerLocation', {
        //enable: true,
        titleAltText: 'Player Location',
        titleStringId: 'sample.gotomark.pane.location',
    });

    // Run interval to refresh coordinate population
    // Issue with refresh on tick rate with show/hide
    storage.updateHandle = system.runInterval(() => {
        if (!storage.parentPaneDataSource) {
            return;
        }

        const currentLocation = vector3Truncate(uiSession.extensionContext.player.location);
        const previousLocation = vector3Truncate(storage.previousLocation);

        // Player hasn't moved - don't refresh
        if (vector3Equals(currentLocation, previousLocation)) {
            return;
        }

        storage.previousLocation = currentLocation;
        storage.parentPaneDataSource.playerLocation = { ...currentLocation };
    }, 10);

    // Jump directly to the location specified in the Vector3 UI control
    parentPane.addButton(
        uiSession.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                if (!storage.parentPaneDataSource) {
                    uiSession.log.error('An error occurred: No UI pane datasource could be found');
                    return;
                }

                const panelLocation = storage.parentPaneDataSource.playerLocation;
                teleportTo(uiSession, panelLocation);
            },
        }),
        {
            titleStringId: 'sample.gotomark.pane.button.teleport',
            titleAltText: 'Teleport to Location',
            visible: true,
        }
    );

    parentPane.addDivider();

    // Set the players spawn location based on the current location (or the location typed into the
    // Vector3 UI control)
    parentPane.addButton(
        uiSession.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                if (!storage.parentPaneDataSource) {
                    uiSession.log.error('An error occurred: No UI pane datasource could be found');
                    return;
                }
                const currentLocation = storage.parentPaneDataSource.playerLocation;
                uiSession.log.info(`Setting Spawn Location to ${vector3ToString(currentLocation)}`);
                uiSession.extensionContext.player.setSpawnPoint({
                    ...currentLocation,
                    dimension: uiSession.extensionContext.player.dimension,
                });
            },
        }),
        {
            titleStringId: 'sample.gotomark.pane.button.setspawn',
            titleAltText: 'Set Spawn Point to current',
            visible: true,
        }
    );

    // Jump to the player's spawn location (stored in the entity)
    parentPane.addButton(
        uiSession.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                const spawnLocation = uiSession.extensionContext.player.getSpawnPoint();
                if (!spawnLocation) {
                    uiSession.log.error('Player Spawn Location is not yet set');
                } else {
                    teleportTo(uiSession, spawnLocation);
                }
            },
        }),
        {
            titleStringId: 'sample.gotomark.pane.button.gotospawn',
            titleAltText: 'Go to Spawn Point',
            visible: true,
        }
    );

    storage.parentPane = parentPane;

    // Build/Rebuild a sub-pane with the more dynamic UI controls
    buildLocationPane(uiSession, storage, 0);

    return parentPane;
}

function buildLocationPane(
    uiSession: IPlayerUISession<ExtensionStorage>,
    storage: ExtensionStorage,
    initialSelection: number
) {
    if (!storage.parentPane) {
        uiSession.log.error('An error occurred: No UI pane could be found');
        return;
    }

    const locationPane = storage.parentPane.createPropertyPane({
        titleAltText: 'Stored Locations',
        titleStringId: 'sample.gotomark.pane.locationpane.title',
    });

    const initialPaneData: LocationPaneDataSourceType = {
        currentSelection: initialSelection,
        newName: '',
    };
    storage.locationPaneDataSource = bindDataSource(locationPane, initialPaneData);

    const dropdownItems = mapDropdownItems(storage);

    storage.dropdownMenu = locationPane.addDropdown(storage.locationPaneDataSource, 'currentSelection', {
        titleStringId: 'sample.gotomark.pane.locationpane.dropdownLabel',
        titleAltText: 'Stored Location',
        dropdownItems: dropdownItems,
        onChange: (_obj: object, _property: string, _oldValue: object, _newValue: object) => {},
    });

    locationPane.addDivider();

    // Jump to the stored location selected in the dropdown
    locationPane.addButton(
        uiSession.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                if (!storage.locationPaneDataSource) {
                    uiSession.log.error('An error occurred: No UI pane datasource could be found');
                    return;
                }

                const currentSelection = storage.locationPaneDataSource.currentSelection;
                if (currentSelection < 0 || currentSelection >= storage.storedLocations.length) {
                    uiSession.log.error('No stored locations to delete');
                    return;
                }

                const destination = storage.storedLocations[currentSelection].location;
                teleportTo(uiSession, destination);
            },
        }),
        {
            titleStringId: 'sample.gotomark.pane.locationpane.button.teleport',
            titleAltText: 'Jump to Stored Location',
            visible: true,
        }
    );
    // Delete the stored location selected in the dropdown
    locationPane.addButton(
        uiSession.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                if (!storage.locationPaneDataSource) {
                    uiSession.log.error('An error occurred: No UI pane datasource could be found');
                    return;
                }

                const currentSelection = storage.locationPaneDataSource.currentSelection;
                if (currentSelection < 0 || currentSelection >= storage.storedLocations.length) {
                    uiSession.log.error('No stored locations to delete');
                    return;
                }
                const locationName = storage.storedLocations[currentSelection].name;
                uiSession.log.info(`Deleting stored location name "${locationName}"`);
                storage.storedLocations.splice(currentSelection, 1);

                storeLocationsToPlayer(uiSession, storage);

                const dropdownItems = mapDropdownItems(storage);
                storage.dropdownMenu?.updateDropdownItems(
                    dropdownItems,
                    storage.locationPaneDataSource.currentSelection
                );
            },
        }),
        {
            titleStringId: 'sample.gotomark.pane.locationpane.button.delete',
            titleAltText: 'Delete Stored Location',
            visible: true,
        }
    );

    locationPane.addString(storage.locationPaneDataSource, 'newName', {
        titleAltText: 'New Name',
        titleStringId: 'sample.gotomark.pane.locationpane.input.name',
    });

    locationPane.addButton(
        uiSession.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                if (!storage.parentPaneDataSource || !storage.locationPaneDataSource) {
                    uiSession.log.error('An error occurred: No UI pane datasource could be found');
                    return;
                }
                if (storage.storedLocations.length >= storedLocationsMax) {
                    uiSession.log.error(`Cannot store more than ${storedLocationsMax} locations`);
                    return;
                }
                const currentLocation = vector3Truncate(storage.parentPaneDataSource.playerLocation);
                let newName = storage.locationPaneDataSource?.newName;
                if (!newName) {
                    newName = `Location ${storage.storedLocations.length + 1}`;
                } else {
                    newName = newName.trim();
                    if (newName.length > storedLocationNameMaxLength) {
                        newName = newName.substring(0, storedLocationNameMaxLength);
                    }
                }

                uiSession.log.info(`Adding Location ${vector3ToString(currentLocation)} as "${newName}"`);
                storage.storedLocations.push({ name: newName, location: currentLocation });

                storeLocationsToPlayer(uiSession, storage);

                const newSelectionIndex = storage.storedLocations.length - 1;

                const dropdownItems = mapDropdownItems(storage);
                storage.dropdownMenu?.updateDropdownItems(dropdownItems, newSelectionIndex);
            },
        }),
        {
            titleStringId: 'sample.gotomark.pane.locationpane.button.store',
            titleAltText: 'Store Current Location as...',
        }
    );
}

function storeLocationsToPlayer(uiSession: IPlayerUISession<ExtensionStorage>, storage: ExtensionStorage) {
    const me = uiSession.extensionContext.player;
    me.setDynamicProperty(storedLocationDynamicPropertyName, JSON.stringify(storage.storedLocations));
}

export function registerGotoMarkExtension() {
    registerEditorExtension<ExtensionStorage>(
        'goto-mark-sample',
        uiSession => {
            uiSession.log.debug(
                `Initializing extension [${uiSession.extensionContext.extensionInfo.name}] for player [${uiSession.extensionContext.player.name}]`
            );

            const storage: ExtensionStorage = {
                previousLocation: uiSession.extensionContext.player.location,
                storedLocations: [],
                transactionHandler: registerUserDefinedTransactionHandler<GotoTeleportTransactionPayload>(
                    uiSession.extensionContext.transactionManager,
                    (payload: GotoTeleportTransactionPayload) => {
                        // undo handler
                        uiSession.log.info(`Teleporting to location ${vector3ToString(payload.current)}`);
                        try {
                            uiSession.extensionContext.player.teleport(payload.current);
                        } catch (e) {
                            uiSession.log.error(`Teleport failed: ${stringFromException(e)}`);
                        }
                    },
                    (payload: GotoTeleportTransactionPayload) => {
                        // redo handler
                        uiSession.log.info(`Teleporting to location ${vector3ToString(payload.destination)}`);
                        try {
                            uiSession.extensionContext.player.teleport(payload.destination);
                        } catch (e) {
                            uiSession.log.error(`Teleport failed: ${stringFromException(e)}`);
                        }
                    }
                ),
            };

            const me = uiSession.extensionContext.player;
            try {
                const fetchedLocationsString = me.getDynamicProperty(storedLocationDynamicPropertyName) as string;
                if (!fetchedLocationsString) {
                    uiSession.log.info('No stored locations found during initialization');
                } else {
                    const fetchedLocationsArray = JSON.parse(fetchedLocationsString) as LocationData[];
                    if (fetchedLocationsArray) {
                        storage.storedLocations = fetchedLocationsArray;
                    }
                    uiSession.log.info(
                        `Found ${storage.storedLocations.length} stored locations during initialization`
                    );
                }
            } catch (e) {
                uiSession.log.info('No stored locations found during initialization');
            }

            storage.tool = addExtensionTool(uiSession, storage);
            buildParentPane(uiSession, storage);

            uiSession.scratchStorage = storage;

            return [];
        },

        (uiSession: IPlayerUISession<ExtensionStorage>) => {
            uiSession.log.debug(
                `Shutting down extension [${uiSession.extensionContext.extensionInfo.name}] for player [${uiSession.extensionContext.player.name}]`
            );

            if (uiSession.scratchStorage) {
                // If we still have a system interval runner, then shut it down
                if (uiSession.scratchStorage.updateHandle) {
                    system.clearRun(uiSession.scratchStorage.updateHandle);
                }
            }
        },
        {
            description: '"Go to Bookmark" Sample Extension',
            notes: 'by Chloe, Eser & Dave - https://tinyurl.com/3h7f46d8',
        }
    );
}
