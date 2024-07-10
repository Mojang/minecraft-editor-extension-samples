// Copyright (c) Mojang AB.  All rights reserved.

import { CursorTargetMode, IDisposable, Ray } from '@minecraft/server-editor';
import {
    bindDataSource,
    IPlayerUISession,
    registerEditorExtension,
    IModalTool,
    ActionTypes,
    MouseProps,
    MouseActionType,
    MouseInputType,
    KeyboardKey,
    InputModifier,
    EditorInputContext,
    IPropertyPane,
} from '@minecraft/server-editor';
import { Vector3 } from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

enum PortalType {
    Nether = 0,
    End = 1,
}

enum PortalOrientation {
    X = 0,
    Z = 1,
}

type ExtensionStorage = {
    tool?: IModalTool;
};

type PortalGeneratorSession = IPlayerUISession<ExtensionStorage>;

type PaneDataSourceType = {
    replaceFloor: boolean;
    portalType: PortalType;
};

type NetherDataSourceType = {
    sizeX: number;
    sizeY: number;
    orientation: PortalOrientation;
    corners: boolean;
    percentComplete: number;
};

type EndDataSourceType = {
    filledEyeCount: number;
};

interface IPortalGenerator {
    set parentPane(value: IPropertyPane);

    subPane(uiSession: PortalGeneratorSession): IPropertyPane | undefined;

    activatePane(uiSession: PortalGeneratorSession): void;
    deactivatePane(): void;

    generatePortal(uiSession: PortalGeneratorSession): void;
}

class PortalGenerator implements IDisposable {
    private _netherPortal: NetherPortal;
    private _endPortal: EndPortal;
    private _activePortal?: IPortalGenerator;

    private _pane?: IPropertyPane;
    private _settings: PaneDataSourceType = {
        replaceFloor: true,
        portalType: PortalType.Nether,
    };
    private _dataSource?: PaneDataSourceType;

    constructor() {
        this._netherPortal = new NetherPortal();
        this._endPortal = new EndPortal();
    }

    public toolPane(uiSession: PortalGeneratorSession): IPropertyPane | undefined {
        if (!this._pane) {
            uiSession.log.error('Tool pane not initialized');
            return undefined;
        }
        return this._pane;
    }

    initialize(uiSession: PortalGeneratorSession, storage: ExtensionStorage) {
        // Create Action
        const toolToggleAction = uiSession.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                uiSession.toolRail.setSelectedOptionId(tool.id, true);
            },
        });

        // Add the extension to the tool rail and give it an icon
        const tool = uiSession.toolRail.addTool(
            {
                title: 'sample.portalgenerator.title',
                icon: 'pack://textures/portal-generator.png',
                tooltip: 'sample.portalgenerator.tooltip',
            },
            toolToggleAction
        );

        // Register a global shortcut (CTRL + SHIFT + P) to select the tool
        uiSession.inputManager.registerKeyBinding(
            EditorInputContext.GlobalToolMode,
            toolToggleAction,
            { key: KeyboardKey.KEY_P, modifier: InputModifier.Control | InputModifier.Shift },
            {
                uniqueId: 'editorSamples:portalGenerator:toggleTool',
                label: 'sample.portalgenerator.keyBinding.toggleTool',
            }
        );

        // Create an action that will be executed on left mouse click
        const executeMouseAction = uiSession.actionManager.createAction({
            actionType: ActionTypes.MouseRayCastAction,
            onExecute: (_mouseRay: Ray, mouseProps: MouseProps) => {
                if (
                    mouseProps.mouseAction === MouseActionType.LeftButton &&
                    mouseProps.inputType === MouseInputType.ButtonDown &&
                    this._activePortal
                ) {
                    this._activePortal.generatePortal(uiSession);
                }
            },
        });
        tool.registerMouseButtonBinding(executeMouseAction);

        storage.tool = tool;

        // Build the UI components (and the sub pane with the options)
        this.buildPane(uiSession);

        if (this._pane && this._dataSource) {
            tool.bindPropertyPane(this._pane);
            this.activatePortalGenerator(uiSession, this._dataSource.portalType);
        }
    }

    teardown(): void {}

    buildPane(uiSession: PortalGeneratorSession) {
        const pane = uiSession.createPropertyPane({
            title: 'sample.portalgenerator.pane.title',
        });

        this._dataSource = bindDataSource(pane, this._settings);

        pane.addBool(this._dataSource, 'replaceFloor', {
            title: 'sample.portalgenerator.pane.replacefloor',
            onChange: (_obj: object, _property: string, _oldValue: object, _newValue: object) => {
                const targetMode = this._dataSource?.replaceFloor ? CursorTargetMode.Block : CursorTargetMode.Face;
                uiSession.extensionContext.cursor.setProperties({ targetMode });
            },
        });

        pane.addDropdown(this._dataSource, 'portalType', {
            title: 'sample.portalgenerator.pane.portaltype',
            dropdownItems: [
                {
                    label: 'sample.portalgenerator.pane.portaltype.nether',
                    value: PortalType.Nether,
                },
                {
                    label: 'sample.portalgenerator.pane.portaltype.end',
                    value: PortalType.End,
                },
            ],
            onChange: (_obj: object, _property: string, _oldValue: object, _newValue: object) => {
                const portalType = this._dataSource?.portalType as PortalType;
                this.activatePortalGenerator(uiSession, portalType);
            },
        });

        this._pane = pane;
        this._endPortal.parentPane = pane;
        this._netherPortal.parentPane = pane;
    }

    activatePortalGenerator(uiSession: PortalGeneratorSession, portalType: PortalType): void {
        this._pane?.hide();

        if (this._activePortal) {
            this._activePortal.deactivatePane();
        }

        if (portalType === PortalType.Nether) {
            this._activePortal = this._netherPortal;
        } else {
            this._activePortal = this._endPortal;
        }

        this._activePortal.activatePane(uiSession);

        this._pane?.show();
    }
}

class NetherPortal implements IPortalGenerator {
    private _pane?: IPropertyPane;
    private _parentPane?: IPropertyPane;

    private _settings: NetherDataSourceType = {
        sizeX: 4,
        sizeY: 5,
        orientation: PortalOrientation.X,
        corners: true,
        percentComplete: 100,
    };
    private _dataSource?: NetherDataSourceType;

    constructor() {}

    public subPane(uiSession: PortalGeneratorSession): IPropertyPane | undefined {
        if (!this._pane) {
            uiSession.log.error('Sub pane not initialized');
            return undefined;
        }
        return this._pane;
    }

    public set parentPane(value: IPropertyPane) {
        this._parentPane = value;
    }

    activatePane(uiSession: PortalGeneratorSession): void {
        if (this._pane) {
            this.deactivatePane();
        }

        this._pane = this.buildSubPane(uiSession);
        this._pane?.show();
    }

    deactivatePane(): void {
        if (this._dataSource) {
            this._settings = this._dataSource;
        }

        if (this._pane) {
            this._pane.hide();
            this._parentPane?.removePropertyPane(this._pane);
        }

        this._dataSource = undefined;
        this._pane = undefined;
    }

    buildSubPane(uiSession: PortalGeneratorSession): IPropertyPane | undefined {
        const windowPane = this._parentPane;
        if (!windowPane) {
            uiSession.log.error('Failed to find window binding');
            return undefined;
        }

        const subPane = windowPane.createPropertyPane({
            title: 'sample.portalgenerator.pane.nether.pane.title',
        });

        this._dataSource = bindDataSource(subPane, this._settings);

        subPane.addDropdown(this._dataSource, 'orientation', {
            title: 'sample.portalgenerator.pane.nether.pane.orientation',
            dropdownItems: [
                {
                    label: 'sample.portalgenerator.pane.nether.pane.orientation.x',
                    value: PortalOrientation.X,
                },
                {
                    label: 'sample.portalgenerator.pane.nether.pane.orientation.y',
                    value: PortalOrientation.Z,
                },
            ],
            onChange: (obj: object, _property: string, _oldValue: object, _newValue: object) => {
                this._settings.orientation = Number(_newValue);
            },
        });

        subPane.addNumber(this._dataSource, 'sizeX', {
            title: 'sample.portalgenerator.pane.nether.pane.width',
            min: 4,
            max: 33,
            showSlider: false,
        });

        subPane.addNumber(this._dataSource, 'sizeY', {
            title: 'sample.portalgenerator.pane.nether.pane.height',
            min: 5,
            max: 33,
            showSlider: false,
        });

        subPane.addBool(this._dataSource, 'corners', {
            title: 'sample.portalgenerator.pane.nether.pane.corners',
        });

        subPane.addNumber(this._dataSource, 'percentComplete', {
            title: 'sample.portalgenerator.pane.nether.pane.percentage',
            min: 0,
            max: 100,
            showSlider: true,
        });

        return subPane;
    }

    generatePortal(uiSession: PortalGeneratorSession): void {
        const me = uiSession.extensionContext.player;
        const location = uiSession.extensionContext.cursor.getPosition();

        const targetBlock = me.dimension.getBlock(location);
        if (targetBlock === undefined) {
            uiSession.log.warning('No block selected');
            return;
        }

        if (this._dataSource?.percentComplete === 0) {
            return;
        }

        if (me.dimension.id.endsWith('the_end')) {
            uiSession.log.warning('You cannot create a nether portal in the end');
            return;
        }

        uiSession.extensionContext.transactionManager.openTransaction('Transaction group portal generator');

        let from: Vector3 = location;
        let to: Vector3 = { x: 0, y: 0, z: 0 };

        if (this._dataSource?.orientation === PortalOrientation.X) {
            to = {
                x: location.x + this._dataSource.sizeX,
                y: location.y + this._dataSource.sizeY,
                z: location.z,
            };
        } else if (this._dataSource?.orientation === PortalOrientation.Z) {
            to = {
                x: location.x,
                y: location.y + this._dataSource.sizeY,
                z: location.z + this._dataSource.sizeX,
            };
        } else {
            uiSession.log.error('Failed to get valid orientation');
            uiSession.extensionContext.transactionManager.discardOpenTransaction();
            return;
        }

        const yEnd = this._dataSource.sizeY - 1;
        const xEnd = this._dataSource.sizeX - 1;
        uiSession.extensionContext.transactionManager.trackBlockChangeArea(from, to);
        for (let y = 0; y < this._dataSource.sizeY; ++y) {
            for (let x = 0; x < this._dataSource.sizeX; ++x) {
                let block = MinecraftBlockTypes.Air;

                // Percent complete is randomized percentage
                if (this._dataSource.percentComplete !== 100) {
                    const randVal = getRandomInt(100);
                    if (this._dataSource.percentComplete - randVal < 0) {
                        continue;
                    }
                }

                // Set as obsidian for bottom, top, and edges of portal
                if (
                    !this._dataSource.corners &&
                    ((y === 0 && x === 0) ||
                        (y === 0 && x === xEnd) ||
                        (y === yEnd && x === xEnd) ||
                        (y === yEnd && x === 0))
                ) {
                    continue; // no corners
                } else if (y === 0 || y === yEnd || x === 0 || x === xEnd) {
                    block = MinecraftBlockTypes.Obsidian;
                } else {
                    continue;
                }

                const loc: Vector3 =
                    this._dataSource.orientation === PortalOrientation.X
                        ? { x: location.x + x, y: location.y + y, z: location.z }
                        : { x: location.x, y: location.y + y, z: location.z + x };

                me.dimension.getBlock(loc)?.setType(block);
            }
        }

        let ori = 'x';
        if (this._dataSource.orientation === PortalOrientation.Z) {
            ori = 'z';
            from = { x: location.x, y: location.y + 1, z: location.z + 1 };
            to = {
                x: location.x,
                y: location.y + this._dataSource.sizeY - 2,
                z: location.z + this._dataSource.sizeX - 2,
            };
        } else {
            from = { x: location.x + 1, y: location.y + 1, z: location.z };
            to = {
                x: location.x + this._dataSource.sizeX - 2,
                y: location.y + this._dataSource.sizeY - 2,
                z: location.z,
            };
        }

        if (this._dataSource.percentComplete === 100) {
            // We must fill the portals as it must have the axis set while setting the type
            // or the engine will destroy the block and the scripting API wont allow both in one operation
            me.dimension.runCommand(
                `FILL ${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} portal ["portal_axis":"${ori}"]`
            );
        }

        uiSession.extensionContext.transactionManager.commitOpenTransaction();
    }
}

class EndPortal implements IPortalGenerator {
    private _pane?: IPropertyPane;
    private _parentPane?: IPropertyPane;
    private _settings: EndDataSourceType = {
        filledEyeCount: 12,
    };
    private _dataSource?: EndDataSourceType;

    constructor() {}

    public subPane(uiSession: PortalGeneratorSession): IPropertyPane | undefined {
        if (!this._pane) {
            uiSession.log.error('Sub pane not initialized');
            return undefined;
        }
        return this._pane;
    }

    public set parentPane(value: IPropertyPane) {
        this._parentPane = value;
    }

    activatePane(uiSession: PortalGeneratorSession): void {
        if (this._pane) {
            this.deactivatePane();
        }

        this._pane = this.buildSubPane(uiSession);
        this._pane?.show();
    }

    deactivatePane(): void {
        if (this._dataSource) {
            this._settings = this._dataSource;
        }

        if (this._pane) {
            this._pane.hide();
            this._parentPane?.removePropertyPane(this._pane);
        }

        this._dataSource = undefined;
        this._pane = undefined;
    }

    buildSubPane(uiSession: PortalGeneratorSession): IPropertyPane | undefined {
        const windowPane = this._parentPane;
        if (!windowPane) {
            uiSession.log.error('Failed to find window pane');
            return undefined;
        }

        const subPane = windowPane.createPropertyPane({
            title: 'sample.portalgenerator.pane.end.pane.title',
        });

        this._dataSource = bindDataSource(subPane, this._settings);

        subPane.addNumber(this._dataSource, 'filledEyeCount', {
            title: 'sample.portalgenerator.pane.end.pane.filledcount',
            min: 0,
            max: 12,
            showSlider: true,
        });

        return subPane;
    }

    generatePortal(uiSession: PortalGeneratorSession): void {
        if (!this._dataSource) {
            uiSession.log.error('No data source bound');
            return;
        }

        const me = uiSession.extensionContext.player;
        const location = uiSession.extensionContext.cursor.getPosition();

        const targetBlock = me.dimension.getBlock(location);
        if (targetBlock === undefined) {
            uiSession.log.error('No block selected');
            return;
        }

        uiSession.extensionContext.transactionManager.openTransaction('Transaction group portal generator');

        const from: Vector3 = { x: location.x, y: location.y, z: location.z };
        const to: Vector3 = { x: location.x + 4, y: location.y, z: location.z + 4 };

        let eyesToUse: boolean[] = [false, false, false, false, false, false, false, false, false, false, false, false];
        if (this._dataSource.filledEyeCount === 12) {
            eyesToUse = [true, true, true, true, true, true, true, true, true, true, true, true];
        } else if (this._dataSource.filledEyeCount !== 0) {
            const possibleEyeLocs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            for (let i = 0; i < this._dataSource.filledEyeCount; ++i) {
                const rand = Math.floor(Math.random() * possibleEyeLocs.length);
                eyesToUse[possibleEyeLocs[rand]] = true;
                possibleEyeLocs.splice(rand, 1);
            }
        }

        let i = 0;
        uiSession.extensionContext.transactionManager.trackBlockChangeArea(from, to);

        for (let z = 0; z < 5; ++z) {
            for (let x = 0; x < 5; ++x) {
                let rot = 0;
                let blockType = MinecraftBlockTypes.Air;
                if (x === 0 && z !== 0 && z !== 4) {
                    // west edge
                    blockType = MinecraftBlockTypes.EndPortalFrame;
                    rot = 3;
                } else if (x === 4 && z !== 0 && z !== 4) {
                    // east edge
                    blockType = MinecraftBlockTypes.EndPortalFrame;
                    rot = 1;
                } else if (z === 0 && x !== 0 && x !== 4) {
                    // south edge
                    blockType = MinecraftBlockTypes.EndPortalFrame;
                    rot = 0;
                } else if (z === 4 && x !== 0 && x !== 4) {
                    // north edge
                    blockType = MinecraftBlockTypes.EndPortalFrame;
                    rot = 2;
                } else if (this._dataSource.filledEyeCount === 12 && x >= 1 && z >= 1 && x <= 3 && z <= 3) {
                    // center
                    blockType = MinecraftBlockTypes.EndPortal;
                } else {
                    continue;
                }

                const block = me.dimension.getBlock({ x: location.x + x, y: location.y, z: location.z + z });

                if (block) {
                    block.setType(blockType);
                    if (blockType === MinecraftBlockTypes.EndPortalFrame) {
                        const perm = block.permutation
                            .withState('direction', rot)
                            .withState('end_portal_eye_bit', eyesToUse[i]);
                        block.setPermutation(perm);
                        i += 1;
                    }
                } else {
                    uiSession.log.error('Failed to get block');
                }
            }
        }

        uiSession.extensionContext.transactionManager.commitOpenTransaction();
    }
}

function getRandomInt(upper: number) {
    return Math.ceil(Math.random() * (upper + 1));
}

/**
 * Register Portal Generator extension
 */
export function registerPortalGeneratorExtension() {
    registerEditorExtension<ExtensionStorage>(
        'portal-generator-sample',
        uiSession => {
            uiSession.log.debug(`Initializing [${uiSession.extensionContext.extensionInfo.name}] extension`);

            uiSession.scratchStorage = {};

            const generator = new PortalGenerator();
            generator.initialize(uiSession, uiSession.scratchStorage);

            return [generator];
        },
        uiSession => {
            uiSession.log.debug(`Shutting down [${uiSession.extensionContext.extensionInfo.name}] extension`);
        },
        {
            description: '"Portal Generator" Sample Extension',
            notes: 'by Andrew - https://tinyurl.com/2s3a3yey',
        }
    );
}
