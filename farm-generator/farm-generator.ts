import {
    ActionTypes,
    EditorInputContext,
    EditorStatusBarAlignment,
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
import { Player, Vector3 } from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftEntityTypes } from '@minecraft/vanilla-data';

type SettingsType = {
    farmWidth: number;
    farmLength: number;
    fenceType: number;
    irrigation: boolean;
};

type CropSettingsType = {
    wheat: boolean;
    pumpkin: boolean;
    potato: boolean;
    carrot: boolean;
    beetroot: boolean;
};

type AnimalSettingsType = {
    pig: boolean;
    sheep: boolean;
    cow: boolean;
};

function getRandomInt(upper: number) {
    return Math.ceil(Math.random() * (upper + 1));
}

function fenceTypeToBlockType(fenceType: number): string {
    switch (fenceType) {
        case 0:
            return MinecraftBlockTypes.OakFence;
        case 1:
            return MinecraftBlockTypes.BirchFence;
        case 2:
            return MinecraftBlockTypes.AcaciaFence;
        case 3:
            return MinecraftBlockTypes.BambooFence;
        case 4:
            return MinecraftBlockTypes.CherryFence;
        case 5:
            return MinecraftBlockTypes.JungleFence;
        case 6:
            return MinecraftBlockTypes.SpruceFence;
        case 7:
            return MinecraftBlockTypes.WarpedFence;
        case 8:
            return MinecraftBlockTypes.CrimsonFence;
        default:
            return MinecraftBlockTypes.OakFence;
    }
}

const buildFarm = (
    targetCorner: Vector3,
    x: number,
    z: number,
    length: number,
    width: number,
    possibleAnimals: MinecraftEntityTypes[],
    possibleCrops: string[],
    player: Player,
    settings: SettingsType
) => {
    for (let i = 0; i < width; i++) {
        for (let j = length - 1; j > -1; j--) {
            const xOffset = i * x;
            const zOffset = z * j;
            const location: Vector3 = { x: targetCorner.x + xOffset, y: targetCorner.y, z: targetCorner.z + zOffset };
            const locationAbove: Vector3 = {
                x: targetCorner.x + xOffset,
                y: targetCorner.y + 1,
                z: targetCorner.z + zOffset,
            };
            const block = player.dimension.getBlock(location);
            const blockAbove = player.dimension.getBlock(locationAbove);
            const isBorder = i === 0 || i === width - 1 || j === 0 || j === length - 1;
            if (xOffset % 3 === 0 && !isBorder && settings.irrigation) {
                block?.setType(MinecraftBlockTypes.Water);
            } else {
                block?.setType(MinecraftBlockTypes.Farmland);
            }
            if (isBorder) {
                blockAbove?.setType(fenceTypeToBlockType(settings.fenceType));
            } else if (possibleAnimals.length > 0 && getRandomInt(5) === 5) {
                const animal = getRandomInt(possibleAnimals.length - 1);
                const entityType = possibleAnimals[animal - 1];
                player.dimension.spawnEntity(entityType, blockAbove?.location ?? { x: 0, y: 0, z: 0 });
            } else if (!block?.isLiquid && possibleCrops.length > 0) {
                const crop = getRandomInt(possibleCrops.length - 1);
                const blockType = possibleCrops[crop - 1];
                blockAbove?.setType(blockType);
            }
        }
    }
};

function addFarmGeneratorSettingsPane(uiSession: IPlayerUISession, tool: IModalTool) {
    const windowPane = uiSession.createPropertyPane({
        titleStringId: 'sample.farmgenerator.pane.title',
        titleAltText: 'Farm Generator',
    });
    const cropPane = windowPane.createPropertyPane({
        titleStringId: 'sample.farmgenerator.pane.crops.title',
        titleAltText: 'Crops',
    });
    const animalPane = windowPane.createPropertyPane({
        titleStringId: 'sample.farmgenerator.pane.animals.title',
        titleAltText: 'Animals',
    });

    const settings: SettingsType = bindDataSource(windowPane, {
        farmWidth: 10,
        farmLength: 10,
        fenceType: 0, // oak fence
        irrigation: false,
    });

    const cropSettings: CropSettingsType = bindDataSource(cropPane, {
        wheat: false,
        pumpkin: false,
        potato: false,
        carrot: false,
        beetroot: false,
    });

    const animalSettings: AnimalSettingsType = bindDataSource(animalPane, {
        pig: false,
        sheep: false,
        cow: false,
    });

    const statusItem = uiSession.createStatusBarItem(EditorStatusBarAlignment.Right, 30);

    const onExecuteGenerator = (ray?: Ray) => {
        const player: Player = uiSession.extensionContext.player;

        // Use the mouse ray if it is available
        const raycastResult =
            ray !== undefined
                ? player.dimension.getBlockFromRay(ray.location, ray.direction)
                : player.getBlockFromViewDirection();

        if (!raycastResult) {
            uiSession.log.error('No block from view vector');
            return;
        }
        const targetBlock = raycastResult.block;

        let targetCorner: Vector3 = { x: targetBlock.location.x, y: targetBlock.location.y, z: targetBlock.location.z };
        const possibleCrops: string[] = [];
        if (cropSettings.beetroot) {
            possibleCrops.push(MinecraftBlockTypes.Beetroot);
        }
        if (cropSettings.carrot) {
            possibleCrops.push(MinecraftBlockTypes.Carrots);
        }
        if (cropSettings.pumpkin) {
            possibleCrops.push(MinecraftBlockTypes.Pumpkin);
        }
        if (cropSettings.wheat) {
            possibleCrops.push(MinecraftBlockTypes.Wheat);
        }
        if (cropSettings.potato) {
            possibleCrops.push(MinecraftBlockTypes.Potatoes);
        }
        const possibleAnimals: MinecraftEntityTypes[] = [];
        if (animalSettings.sheep) {
            possibleAnimals.push(MinecraftEntityTypes.Sheep);
        }
        if (animalSettings.cow) {
            possibleAnimals.push(MinecraftEntityTypes.Cow);
        }
        if (animalSettings.pig) {
            possibleAnimals.push(MinecraftEntityTypes.Pig);
        }
        let x = 1;
        let z = 1;
        let length = settings.farmLength;
        let width = settings.farmWidth;
        if (Math.round(player.getViewDirection().z) === -1) {
            targetCorner = {
                x: targetCorner.x + (settings.farmWidth / 2 - 1),
                y: targetCorner.y,
                z: targetCorner.z - (settings.farmLength / 2 - 1),
            };
            statusItem.text = `Facing north`;
            x = -1;
        } else if (Math.round(player.getViewDirection().x) === 1) {
            targetCorner = {
                x: targetCorner.x + (settings.farmWidth / 2 - 1),
                y: targetCorner.y,
                z: targetCorner.z + (settings.farmLength / 2 - 1),
            };
            statusItem.text = `Facing east`;
            length = settings.farmWidth;
            width = settings.farmLength;
            x = -1;
            z = -1;
        }
        if (Math.round(player.getViewDirection().z) === 1) {
            targetCorner = {
                x: targetCorner.x - (settings.farmWidth / 2 - 1),
                y: targetCorner.y,
                z: targetCorner.z + (settings.farmLength / 2 - 1),
            };
            statusItem.text = `Facing south`;
            z = -1;
        } else if (Math.round(player.getViewDirection().x) === -1) {
            targetCorner = {
                x: targetCorner.x - (settings.farmWidth / 2 - 1),
                y: targetCorner.y,
                z: targetCorner.z - (settings.farmLength / 2 - 1),
            };
            statusItem.text = `Facing west`;
            length = settings.farmWidth;
            width = settings.farmLength;
        }
        buildFarm(targetCorner, x, z, length, width, possibleAnimals, possibleCrops, player, settings);
    };

    // Create an action that will be executed on left mouse click
    const executeMouseAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.MouseRayCastAction,
        onExecute: (mouseRay: Ray, mouseProps: MouseProps) => {
            if (
                mouseProps.mouseAction === MouseActionType.LeftButton &&
                mouseProps.inputType === MouseInputType.ButtonDown
            ) {
                onExecuteGenerator(mouseRay);
            }
        },
    });

    // Create and an action that will be executed on CTRL + P
    const executeKeyAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: () => {
            onExecuteGenerator();
        },
    });

    // Register actions as input bindings to tool context
    tool.registerKeyBinding(executeKeyAction, KeyboardKey.KEY_P, InputModifier.Control);
    tool.registerMouseButtonBinding(executeMouseAction);
    windowPane.addNumber(settings, 'farmLength', {
        titleStringId: 'sample.farmgenerator.pane.length',
        titleAltText: 'Length',
        min: 2,
        max: 20,
        showSlider: false,
    });
    windowPane.addNumber(settings, 'farmWidth', {
        titleStringId: 'sample.farmgenerator.pane.width',
        titleAltText: 'Width',
        min: 2,
        max: 20,
        showSlider: false,
    });
    windowPane.addDropdown(settings, 'fenceType', {
        titleStringId: 'sample.farmgenerator.pane.fence',
        titleAltText: 'Fence',
        enable: true,
        dropdownItems: [
            {
                displayAltText: 'Oak',
                displayStringId: 'Oak',
                value: 0,
            },
            {
                displayAltText: 'Birch',
                displayStringId: 'Birch',
                value: 1,
            },
            {
                displayAltText: 'Acacia',
                displayStringId: 'Acacia',
                value: 2,
            },
            {
                displayAltText: 'Bamboo',
                displayStringId: 'Bamboo',
                value: 3,
            },
            {
                displayAltText: 'Cherry',
                displayStringId: 'Cherry',
                value: 4,
            },
            {
                displayAltText: 'Jungle',
                displayStringId: 'Jungle',
                value: 5,
            },
            {
                displayAltText: 'Spruce',
                displayStringId: 'Spruce',
                value: 6,
            },
            {
                displayAltText: 'Warped',
                displayStringId: 'Warped',
                value: 7,
            },
            {
                displayAltText: 'Crimson',
                displayStringId: 'Crimson',
                value: 8,
            },
        ],
    });

    windowPane.addBool(settings, 'irrigation', {
        titleStringId: 'sample.farmgenerator.pane.irrigation',
        titleAltText: 'Add irrigation',
    });
    cropPane.addBool(cropSettings, 'wheat', {
        titleStringId: 'sample.farmgenerator.pane.crops.wheat',
        titleAltText: 'Wheat',
    });
    cropPane.addBool(cropSettings, 'potato', {
        titleStringId: 'sample.farmgenerator.pane.crops.potato',
        titleAltText: 'Potato',
    });
    cropPane.addBool(cropSettings, 'beetroot', {
        titleStringId: 'sample.farmgenerator.pane.crops.beets',
        titleAltText: 'Beetroot',
    });
    cropPane.addBool(cropSettings, 'pumpkin', {
        titleStringId: 'sample.farmgenerator.pane.crops.pumpkin',
        titleAltText: 'Pumpkin',
    });
    cropPane.addBool(cropSettings, 'carrot', {
        titleStringId: 'sample.farmgenerator.pane.crops.carrot',
        titleAltText: 'Carrot',
    });
    animalPane.addBool(animalSettings, 'cow', {
        titleStringId: 'sample.farmgenerator.pane.animals.cow',
        titleAltText: 'Cow',
    });
    animalPane.addBool(animalSettings, 'sheep', {
        titleStringId: 'sample.farmgenerator.pane.animals.sheep',
        titleAltText: 'Sheep',
    });
    animalPane.addBool(animalSettings, 'pig', {
        titleStringId: 'sample.farmgenerator.pane.animals.pig',
        titleAltText: 'Pig',
    });

    tool.bindPropertyPane(windowPane);
    tool.bindPropertyPane(cropPane);
    tool.bindPropertyPane(animalPane);

    tool.onModalToolActivation.subscribe((eventData: ModalToolLifecycleEventPayload) => {
        if (eventData.isActiveTool) {
            windowPane.show();
        } else {
            windowPane.hide();
        }
    });

    windowPane.hide();

    return settings;
}

/**
 * Create a new tool rail item for farm generator
 */
function addFarmGeneratorTool(uiSession: IPlayerUISession) {
    const tool = uiSession.toolRail.addTool({
        displayStringId: 'sample.farmgenerator.tool.title',
        displayAltText: 'Farm Generator (CTRL + SHIFT + F)',
        icon: 'pack://textures/farm-generator.png',
        tooltipStringId: 'sample.farmgenerator.tool.tooltip',
        tooltipAltText: 'Quickly create a custom farm',
    });

    // Register a global shortcut (CTRL + SHIFT + P) to select the tool
    const toolToggleAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: () => {
            uiSession.toolRail.setSelectedOptionId(tool.id, true);
        },
    });

    uiSession.inputManager.registerKeyBinding(
        EditorInputContext.GlobalToolMode,
        toolToggleAction,
        KeyboardKey.KEY_F,
        InputModifier.Control | InputModifier.Shift
    );

    return tool;
}

/**
 * Register Farm Generator extension
 */
export function registerFarmGeneratorExtension() {
    registerEditorExtension(
        'FarmGenerator-sample',
        (uiSession: IPlayerUISession) => {
            uiSession.log.debug(`Initializing [${uiSession.extensionContext.extensionName}] extension`);

            // Add tool to tool rail
            const farmGeneratorTool = addFarmGeneratorTool(uiSession);

            // Create settings pane/window
            addFarmGeneratorSettingsPane(uiSession, farmGeneratorTool);

            return [];
        },
        (uiSession: IPlayerUISession) => {
            uiSession.log.debug(`Initializing [${uiSession.extensionContext.extensionName}] extension`);
        },
        {
            description: '"Farm Generator" Sample Extension',
            notes: 'by Molly - https://tinyurl.com/3h7f46d8',
        }
    );
}
