// Copyright (c) Mojang AB.  All rights reserved.

import {
    ActionTypes,
    bindDataSource,
    CursorTargetMode,
    IDropdownItem,
    IModalTool,
    IPlayerUISession,
    ModalToolLifecycleEventPayload,
    MouseActionType,
    MouseInputType,
    MouseProps,
    Ray,
    registerEditorExtension,
    Selection,
} from '@minecraft/server-editor';
import {
    BlockVolume,
    BlockVolumeUtils,
    BoundingBox,
    BoundingBoxUtils,
    RGBA,
    CompoundBlockVolumeAction,
    Dimension,
    Direction,
    EntityColorComponent,
    Player,
    Vector,
    Vector3,
} from '@minecraft/server';

enum BrushColor {
    White = 0,
    Orange = 1,
    Magenta = 2,
    LightBlue = 3,
    Yellow = 4,
    LightGreen = 5,
    Pink = 6,
    Gray = 7,
    Silver = 8,
    Cyan = 9,
    Purple = 10,
    Blue = 11,
    Brown = 12,
    Green = 13,
    Red = 14,
    Black = 15,
}

const directionLookup: Record<Direction, Vector3> = {
    [Direction.North]: { x: 0, y: 0, z: 1 },
    [Direction.East]: { x: -1, y: 0, z: 0 },
    [Direction.South]: { x: 0, y: 0, z: -1 },
    [Direction.West]: { x: 1, y: 0, z: 0 },
    [Direction.Up]: { x: 0, y: 1, z: 0 },
    [Direction.Down]: { x: 0, y: -1, z: 0 },
};

const directionToQuadrant: Record<Direction, number> = {
    [Direction.North]: 0,
    [Direction.East]: 1,
    [Direction.South]: 2,
    [Direction.West]: 3,
    [Direction.Up]: 4,
    [Direction.Down]: 5,
};

const quadrantToDirection: Record<number, Direction> = {
    [0]: Direction.North,
    [1]: Direction.East,
    [2]: Direction.South,
    [3]: Direction.West,
    [4]: Direction.Up,
    [5]: Direction.Down,
};

export function getRotationCorrectedDirection(rotationY: number, realDirection: Direction): Direction {
    if (realDirection === Direction.Up || realDirection === Direction.Down) {
        return realDirection;
    }
    const quadrant = directionToQuadrant[realDirection];
    const rotatedQuadrant = Math.floor(((rotationY + 405 + quadrant * 90) % 360) / 90);
    const rotatedDirection = quadrantToDirection[rotatedQuadrant];
    return rotatedDirection;
}

export function getRotationCorrectedDirectionVector(rotationY: number, realDirection: Direction): Vector3 {
    const relativeDirection = getRotationCorrectedDirection(rotationY, realDirection);
    return directionLookup[relativeDirection];
}

//#endregion

const colorPalette = new Map<BrushColor, RGBA>([
    [BrushColor.White, { red: 1, green: 1, blue: 1, alpha: 1 }],
    [BrushColor.Orange, { red: 0.95, green: 0.459, blue: 0, alpha: 1 }],
    [BrushColor.Magenta, { red: 0.94, green: 0, blue: 0.9, alpha: 1 }],
    [BrushColor.LightBlue, { red: 0, green: 0.85, blue: 0.95, alpha: 1 }],
    [BrushColor.Yellow, { red: 0.85, green: 0.95, blue: 0, alpha: 1 }],
    [BrushColor.LightGreen, { red: 0, green: 0.95, blue: 0.6, alpha: 1 }],
    [BrushColor.Pink, { red: 0.9, green: 0.65, blue: 0.85, alpha: 1 }],
    [BrushColor.Gray, { red: 0.6, green: 0.6, blue: 0.6, alpha: 1 }],
    [BrushColor.Silver, { red: 0.75, green: 0.75, blue: 0.75, alpha: 1 }],
    [BrushColor.Cyan, { red: 0, green: 0.9, blue: 0.9, alpha: 1 }],
    [BrushColor.Purple, { red: 0.45, green: 0, blue: 0.9, alpha: 1 }],
    [BrushColor.Blue, { red: 0, green: 0, blue: 1, alpha: 1 }],
    [BrushColor.Brown, { red: 0.8, green: 0.5, blue: 0.1, alpha: 1 }],
    [BrushColor.Green, { red: 0, green: 1, blue: 0, alpha: 1 }],
    [BrushColor.Red, { red: 1, green: 0, blue: 0, alpha: 1 }],
    [BrushColor.Black, { red: 0, green: 0, blue: 0, alpha: 1 }],
]);

interface DyeBrushStorage {
    previewSelection: Selection;
    lastVolumePlaced?: BoundingBox;
    currentColor: BrushColor;
}

type DyeBrushSession = IPlayerUISession<DyeBrushStorage>;

function onColorUpdated(newColor: BrushColor, uiSession: DyeBrushSession) {
    const color = colorPalette.get(newColor);
    if (color && uiSession.scratchStorage) {
        uiSession.scratchStorage.currentColor = newColor;
        uiSession.scratchStorage.previewSelection.setFillColor({
            red: color.red,
            green: color.green,
            blue: color.blue,
            alpha: 0.01,
        });
        uiSession.scratchStorage.previewSelection.setOutlineColor({
            red: color.red,
            green: color.green,
            blue: color.blue,
            alpha: 1,
        });
        const cursorProps = uiSession.extensionContext.cursor.getProperties();
        cursorProps.outlineColor = color;
        cursorProps.targetMode = CursorTargetMode.Face;
        uiSession.extensionContext.cursor.setProperties(cursorProps);
    }
}

function addDyeBrushPane(uiSession: DyeBrushSession, tool: IModalTool) {
    const pane = uiSession.createPropertyPane({
        titleStringId: 'sample.dyeBrush.pane.title',
        titleAltText: 'Dye Brush',
    });

    // Here is the binding created.
    const props = bindDataSource(pane, {
        color: BrushColor.White,
        size: 4,
    });

    onColorUpdated(props.color, uiSession);

    pane.addDropdown(props, 'color', {
        titleStringId: 'sample.dyebrush.pane.colordropdown.title',
        titleAltText: 'Color',
        dropdownItems: Object.values(BrushColor).reduce<IDropdownItem[]>((list, dye, index) => {
            if (typeof dye === 'string') {
                list.push({
                    displayStringId: dye,
                    displayAltText: dye,
                    value: index,
                });
            }
            return list;
        }, []),
        onChange: (_obj: object, _property: string, _oldValue: object, _newValue: object) => {
            const newVal = _newValue as unknown as BrushColor;
            if (newVal) {
                props.color = newVal;
                onColorUpdated(props.color, uiSession);
            }
        },
    });

    tool.bindPropertyPane(pane);

    const onExecuteBrush = () => {
        if (uiSession.scratchStorage === undefined) {
            uiSession.log.error('Storage was not initialized.');
            return;
        }

        const previewSelection = uiSession.scratchStorage.previewSelection;

        const player = uiSession.extensionContext.player;
        const targetBlock = player.dimension.getBlock(uiSession.extensionContext.cursor.getPosition());
        if (targetBlock === undefined) {
            return;
        }

        const rotationY = uiSession.extensionContext.player.getRotation().y;
        const directionRight = getRotationCorrectedDirectionVector(rotationY, Direction.East);
        const directionForward = getRotationCorrectedDirectionVector(rotationY, Direction.South);
        const relativeDirection = Vector.add(Vector.add(directionRight, directionForward), Vector.up);

        const sizeHalf = Math.floor(props.size / 2);
        let fromOffset = Vector.multiply(relativeDirection, -sizeHalf);
        const toOffset = Vector.multiply(relativeDirection, props.size - 1);

        const isEven = props.size % 2 === 0;
        if (isEven) {
            fromOffset = Vector.add(fromOffset, Vector.up);
        }

        const location = targetBlock.location;
        const from: Vector3 = {
            x: location.x + fromOffset.x,
            y: location.y + fromOffset.y,
            z: location.z + fromOffset.z,
        };
        const to: Vector3 = { x: from.x + toOffset.x, y: from.y + toOffset.y, z: from.z + toOffset.z };

        const blockVolume: BlockVolume = { from: from, to: to };
        const bounds = BlockVolumeUtils.getBoundingBox(blockVolume);
        if (uiSession.scratchStorage.lastVolumePlaced) {
            if (BoundingBoxUtils.equals(uiSession.scratchStorage.lastVolumePlaced, bounds)) {
                return;
            }
        }

        previewSelection.pushVolume({ action: CompoundBlockVolumeAction.Add, volume: blockVolume });
        uiSession.scratchStorage.lastVolumePlaced = bounds;
    };

    const mouseButtonAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.MouseRayCastAction,
        onExecute: (mouseRay: Ray, mouseProps: MouseProps) => {
            if (uiSession.scratchStorage === undefined) {
                uiSession.log.error('Storage was not initialized.');
                return;
            }

            if (mouseProps.mouseAction === MouseActionType.LeftButton) {
                if (mouseProps.inputType === MouseInputType.ButtonDown) {
                    uiSession.scratchStorage.previewSelection.clear();
                    onExecuteBrush();
                } else if (mouseProps.inputType === MouseInputType.ButtonUp) {
                    const player: Player = uiSession.extensionContext.player;
                    const dimension: Dimension = player.dimension;
                    const iterator = uiSession.scratchStorage.previewSelection.getBlockLocationIterator();
                    for (const pos of iterator) {
                        const entities = dimension.getEntities({ location: pos, closest: 1 });
                        for (const entity of entities) {
                            const colorComp = entity.getComponent('minecraft:color') as EntityColorComponent;
                            if (colorComp) {
                                colorComp.value = props.color;
                            }
                        }
                    }
                    uiSession.scratchStorage.previewSelection.clear();
                }
            }
        },
    });
    tool.registerMouseButtonBinding(mouseButtonAction);

    const executeBrushRayAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.MouseRayCastAction,
        onExecute: (mouseRay: Ray, mouseProps: MouseProps) => {
            if (mouseProps.inputType === MouseInputType.Drag) {
                onExecuteBrush();
            }
        },
    });
    tool.registerMouseDragBinding(executeBrushRayAction);

    // Example for adding mouse wheel
    const executeBrushSizeAction = uiSession.actionManager.createAction({
        actionType: ActionTypes.MouseRayCastAction,
        onExecute: (mouseRay: Ray, mouseProps: MouseProps) => {
            if (mouseProps.mouseAction === MouseActionType.Wheel) {
                if (mouseProps.inputType === MouseInputType.WheelOut) {
                    if (props.color > 0) {
                        props.color--;
                    }
                } else if (mouseProps.inputType === MouseInputType.WheelIn) {
                    if (props.color < 15) {
                        props.color++;
                    }
                }
                onColorUpdated(props.color, uiSession);
            }
        },
    });
    tool.registerMouseWheelBinding(executeBrushSizeAction);

    tool.onModalToolActivation.subscribe((eventData: ModalToolLifecycleEventPayload) => {
        if (eventData.isActiveTool) {
            pane.show();
            onColorUpdated(props.color, uiSession);
        } else {
            pane.hide();
        }

        uiSession.scratchStorage?.previewSelection?.clear();
    });

    pane.hide();

    return props;
}

export function addDyeBrushTool(uiSession: DyeBrushSession) {
    const tool = uiSession.toolRail.addTool({
        displayAltText: 'Dye Brush',
        displayStringId: 'sample.dyebrush.tool.title',
        icon: 'pack://textures/dye-brush.png',
        tooltipAltText: 'Change the color of entity color components (this only works when actors are un-paused)',
        tooltipStringId: 'sample.dyebrush.tool.tooltip',
    });

    return tool;
}

export function registerDyeBrushExtension() {
    registerEditorExtension<DyeBrushStorage>(
        'dye-brush-sample',

        (uiSession: IPlayerUISession<DyeBrushStorage>) => {
            uiSession.log.debug(`Initializing extension [${uiSession.extensionContext.extensionName}]`);

            const previewSelection = uiSession.extensionContext.selectionManager.create();
            previewSelection.visible = true;

            const storage: DyeBrushStorage = {
                previewSelection: previewSelection,
                currentColor: BrushColor.White,
            };
            uiSession.scratchStorage = storage;

            const cubeBrushTool = addDyeBrushTool(uiSession);

            addDyeBrushPane(uiSession, cubeBrushTool);

            return [];
        },

        (uiSession: IPlayerUISession<DyeBrushStorage>) => {
            uiSession.log.debug(`Shutting down extension [${uiSession.extensionContext.extensionName}] `);
        },
        {
            description: '"Dye Brush" Sample Extension',
            notes: 'By Eser - https://tinyurl.com/23xfsxnt',
        }
    );
}
