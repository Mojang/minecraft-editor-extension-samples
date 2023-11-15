// Copyright (c) Mojang AB.  All rights reserved.

import {
    ActionTypes,
    EditorInputContext,
    IDropdownItem,
    IModalTool,
    IPlayerUISession,
    InputModifier,
    KeyboardKey,
    ModalToolLifecycleEventPayload,
    MouseActionType,
    MouseInputType,
    MouseProps,
    Ray,
    bindDataSource,
    registerEditorExtension,
} from '@minecraft/server-editor';
import { BlockPermutation, Vector3 } from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

interface TreeToolSettings {
    height: number;
    randomHeightVariance: number;
    treeType: number;
}

interface TreeBlockChangeData {
    location: Vector3;
    newBlock: BlockPermutation;
}

interface ITree {
    place(location: Vector3, settings: TreeToolSettings): TreeBlockChangeData[];
}

export class SimpleTree implements ITree {
    logType: BlockPermutation;
    leafType: BlockPermutation;

    constructor(logType: BlockPermutation, leafType: BlockPermutation) {
        this.logType = logType;
        this.leafType = leafType;
    }

    place(location: Vector3, settings: TreeToolSettings): TreeBlockChangeData[] {
        const result: TreeBlockChangeData[] = [];

        const heightOffset =
            Math.floor(Math.random() * settings.randomHeightVariance) - settings.randomHeightVariance / 2;
        const calculatedHeight = settings.height + heightOffset;

        ///
        // Trunk
        ///
        for (let y = 0; y <= calculatedHeight; ++y) {
            const offsetLocation: Vector3 = {
                x: location.x,
                y: location.y + y,
                z: location.z,
            };
            result.push({
                location: offsetLocation,
                newBlock: this.logType,
            });
        }

        ///
        // Leaves
        ///

        ///
        // Plus sign on top
        ///
        const leafBlocks = [
            { x: 0, y: 1, z: 0 },
            { x: 1, y: 1, z: 0 },
            { x: -1, y: 1, z: 0 },
            { x: 0, y: 1, z: 1 },
            { x: 0, y: 1, z: -1 },

            { x: 1, y: 0, z: 0 },
            { x: -1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
        ];

        const randomPlusBlocks = [
            { x: 1, y: 0, z: 1 },
            { x: -1, y: 0, z: 1 },
            { x: -1, y: 0, z: -1 },
            { x: 1, y: 0, z: -1 },
        ];
        randomPlusBlocks.forEach(randBlock => {
            if (Math.random() > 0.5) {
                leafBlocks.push(randBlock);
            }
        });

        ///
        // Fat bottom
        ///
        leafBlocks.push(
            ...[
                { x: 1, y: -1, z: -1 },
                { x: 1, y: -1, z: 0 },
                { x: 1, y: -1, z: 1 },

                { x: 0, y: -1, z: 1 },
                { x: 0, y: -1, z: -1 },

                { x: -1, y: -1, z: -1 },
                { x: -1, y: -1, z: 1 },
                { x: -1, y: -1, z: 0 },
            ]
        );

        if (calculatedHeight > 4) {
            leafBlocks.push(
                ...[
                    { x: 1, y: -2, z: -1 },
                    { x: 1, y: -2, z: 0 },
                    { x: 1, y: -2, z: 1 },

                    { x: 0, y: -2, z: 1 },
                    { x: 0, y: -2, z: -1 },

                    { x: -1, y: -2, z: -1 },
                    { x: -1, y: -2, z: 1 },
                    { x: -1, y: -2, z: 0 },

                    // Outer
                    { x: -2, y: -1, z: -1 },
                    { x: -2, y: -1, z: 0 },
                    { x: -2, y: -1, z: 1 },

                    { x: -1, y: -1, z: -2 },
                    { x: -1, y: -1, z: -1 },
                    { x: -1, y: -1, z: 0 },
                    { x: -1, y: -1, z: 1 },
                    { x: -1, y: -1, z: 2 },

                    { x: 0, y: -1, z: -2 },
                    { x: 0, y: -1, z: -1 },
                    { x: 0, y: -1, z: 1 },
                    { x: 0, y: -1, z: 2 },

                    { x: 1, y: -1, z: -2 },
                    { x: 1, y: -1, z: -1 },
                    { x: 1, y: -1, z: 0 },
                    { x: 1, y: -1, z: 1 },
                    { x: 1, y: -1, z: 2 },

                    { x: 2, y: -1, z: -1 },
                    { x: 2, y: -1, z: 0 },
                    { x: 2, y: -1, z: 1 },

                    { x: -2, y: -2, z: -1 },
                    { x: -2, y: -2, z: 0 },
                    { x: -2, y: -2, z: 1 },

                    { x: -1, y: -2, z: -2 },
                    { x: -1, y: -2, z: -1 },
                    { x: -1, y: -2, z: 0 },
                    { x: -1, y: -2, z: 1 },
                    { x: -1, y: -2, z: 2 },

                    { x: 0, y: -2, z: -2 },
                    { x: 0, y: -2, z: -1 },
                    { x: 0, y: -2, z: 1 },
                    { x: 0, y: -2, z: 2 },

                    { x: 1, y: -2, z: -2 },
                    { x: 1, y: -2, z: -1 },
                    { x: 1, y: -2, z: 0 },
                    { x: 1, y: -2, z: 1 },
                    { x: 1, y: -2, z: 2 },

                    { x: 2, y: -2, z: -1 },
                    { x: 2, y: -2, z: 0 },
                    { x: 2, y: -2, z: 1 },
                ]
            );
        }

        const randomFatBottomBlocks = [
            { x: -2, y: -1, z: -2 },
            { x: -2, y: -1, z: 2 },

            { x: 2, y: -1, z: -2 },
            { x: 2, y: -1, z: 2 },
        ];

        if (calculatedHeight > 4) {
            randomFatBottomBlocks.push(
                ...[
                    { x: -2, y: -2, z: -2 },
                    { x: -2, y: -2, z: 2 },

                    { x: 2, y: -2, z: -2 },
                    { x: 2, y: -2, z: 2 },
                ]
            );
        }

        leafBlocks.forEach(block => {
            const offsetLocation: Vector3 = {
                x: location.x + block.x,
                y: location.y + calculatedHeight + block.y,
                z: location.z + block.z,
            };
            result.push({
                location: offsetLocation,
                newBlock: this.leafType,
            });
        });

        return result;
    }
}

function createLeaf1Block(leafType: string): BlockPermutation {
    return BlockPermutation.resolve(MinecraftBlockTypes.Leaves, {
        old_leaf_type: leafType,
    });
}

function createLeaf2Block(leafType: string): BlockPermutation {
    return BlockPermutation.resolve(MinecraftBlockTypes.Leaves2, {
        new_leaf_type: leafType,
    });
}

const TreeTypes = [
    {
        name: 'Oak',
        type: new SimpleTree(BlockPermutation.resolve(MinecraftBlockTypes.OakLog), createLeaf1Block('oak')),
    },
    {
        name: 'Spruce',
        type: new SimpleTree(BlockPermutation.resolve(MinecraftBlockTypes.SpruceLog), createLeaf1Block('spruce')),
    },
    {
        name: 'Birch',
        type: new SimpleTree(BlockPermutation.resolve(MinecraftBlockTypes.BirchLog), createLeaf1Block('birch')),
    },
    {
        name: 'Jungle',
        type: new SimpleTree(BlockPermutation.resolve(MinecraftBlockTypes.JungleLog), createLeaf1Block('jungle')),
    },

    {
        name: 'Acacia',
        type: new SimpleTree(BlockPermutation.resolve(MinecraftBlockTypes.AcaciaLog), createLeaf2Block('acacia')),
    },
    {
        name: 'Dark Oak',
        type: new SimpleTree(BlockPermutation.resolve(MinecraftBlockTypes.DarkOakLog), createLeaf2Block('dark_oak')),
    },
];

function addToolSettingsPane(uiSession: IPlayerUISession, tool: IModalTool) {
    // Create a pane that will be shown when the tool is selected
    const pane = uiSession.createPropertyPane({
        titleStringId: 'sample.treegenerator.pane.title',
        titleAltText: 'Tree Tool',
    });

    // Set up an activation handler to show/hide the pane when the tool is activated/deactivated
    tool.onModalToolActivation.subscribe((eventData: ModalToolLifecycleEventPayload) => {
        if (eventData.isActiveTool) {
            pane.show();
        } else {
            pane.hide();
        }
    });

    // Create a data object for pane controls
    const settings = bindDataSource(pane, {
        height: 5,
        treeType: 0,
        randomHeightVariance: 0,
    });

    const onExecuteTool = (ray?: Ray) => {
        const player = uiSession.extensionContext.player;

        let location: Vector3;

        // Try finding a valid block to place a tree
        if (ray) {
            const raycastResult = player.dimension.getBlockFromRay(ray.location, ray.direction);
            if (!raycastResult) {
                uiSession.log.warning('Invalid target block!');
                return;
            }
            location = raycastResult.block.location;
        } else {
            const targetBlock = player.dimension.getBlock(uiSession.extensionContext.cursor.getPosition());
            if (!targetBlock) {
                uiSession.log.warning('Invalid target block!');
                return;
            }
            location = targetBlock.location;
        }

        // Begin transaction
        uiSession.extensionContext.transactionManager.openTransaction('Tree Tool');

        const selectedTreeType = TreeTypes[settings.treeType];
        const affectedBlocks = selectedTreeType.type.place(location, settings);

        // Track changes
        uiSession.extensionContext.transactionManager.trackBlockChangeList(affectedBlocks.map(x => x.location));

        // Apply changes
        let invalidBlockCount = 0;
        affectedBlocks.forEach(item => {
            const block = player.dimension.getBlock(item.location);
            if (block) {
                block.setPermutation(item.newBlock);
            } else {
                ++invalidBlockCount;
            }
        });

        if (invalidBlockCount > 0) {
            uiSession.log.warning(`There were ${invalidBlockCount} invalid blocks while placing a tree!`);
        }

        // End transaction
        uiSession.extensionContext.transactionManager.commitOpenTransaction();
    };

    // Add a dropdown for available tree types
    pane.addDropdown(settings, 'treeType', {
        titleStringId: 'sample.treegenerator.pane.type',
        titleAltText: 'Tree Type',
        enable: true,
        dropdownItems: TreeTypes.reduce<IDropdownItem[]>((list, tree, index) => {
            list.push({
                displayAltText: tree.name,
                displayStringId: 'NO_ID',
                value: index,
            });
            return list;
        }, []),
    });

    pane.addNumber(settings, 'height', {
        titleStringId: 'sample.treegenerator.pane.height',
        titleAltText: 'Tree Height',
        min: 1,
        max: 16,
        showSlider: true,
    });

    pane.addNumber(settings, 'randomHeightVariance', {
        titleStringId: 'sample.treegenerator.pane.variance',
        titleAltText: 'Tree Height Random Variance',
        min: 0,
        max: 5,
        showSlider: true,
    });

    // Create and an action that will be executed on key press
    const executeAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: onExecuteTool,
    });

    // Register the action as a keyboard shortcut
    tool.registerKeyBinding(executeAction, KeyboardKey.KEY_T, InputModifier.None);
    tool.bindPropertyPane(pane);

    pane.hide();
    // Create an action that will be executed on left mouse click
    const executeMouseAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.MouseRayCastAction,
        onExecute: (mouseRay: Ray, mouseProps: MouseProps) => {
            if (
                mouseProps.mouseAction === MouseActionType.LeftButton &&
                mouseProps.inputType === MouseInputType.ButtonDown
            ) {
                onExecuteTool(mouseRay);
            }
        },
    });
    // Register the action for mouse button
    tool.registerMouseButtonBinding(executeMouseAction);

    return settings;
}

/**
 * Create a new tool rail item for tree generator
 */
function addTool(uiSession: IPlayerUISession) {
    const tool = uiSession.toolRail.addTool({
        displayStringId: 'sample.treegenerator.tool.title',
        displayAltText: 'Tree Generator (CTRL + SHIFT + T)',
        icon: 'pack://textures/tree-generator.png',
        tooltipStringId: 'sample.treegenerator.tool.tooltip',
        tooltipAltText: 'Click to place trees!',
    });

    // Register a global shortcut to select the tool
    const toolToggleAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: () => {
            uiSession.toolRail.setSelectedOptionId(tool.id, true);
        },
    });
    uiSession.inputManager.registerKeyBinding(
        EditorInputContext.GlobalToolMode,
        toolToggleAction,
        KeyboardKey.KEY_T,
        InputModifier.Control | InputModifier.Shift
    );

    return tool;
}

/**
 * Register Tree Generator extension
 */
export function registerTreeGeneratorExtension() {
    registerEditorExtension(
        'TreeGenerator-sample',
        (uiSession: IPlayerUISession) => {
            uiSession.log.debug(`Initializing [${uiSession.extensionContext.extensionName}] extension`);

            // Add extension tool to tool rail
            const tool = addTool(uiSession);

            // Create settings pane/window for the extension
            addToolSettingsPane(uiSession, tool);

            return [];
        },
        (uiSession: IPlayerUISession) => {
            uiSession.log.debug(`Shutting down [${uiSession.extensionContext.extensionName}] extension`);
        },
        {
            description: '"Tree Generator" Sample Extension',
            notes: 'by Jake - https://tinyurl.com/2s3a3yey',
        }
    );
}
