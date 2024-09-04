// Copyright (c) Mojang AB.  All rights reserved.

import {
    IObservable,
    IPlayerUISession,
    ISimpleToolOptions,
    ISimpleToolPaneOptions,
    ISimpleToolRailOptions,
    ISimpleToolStatusBarOptions,
    InputModifier,
    KeyboardKey,
    SimpleToolStatusBarVisibility,
    SimpleToolWrapper,
    StatusBarAlignment,
    bindDataSource,
    makeObservable,
    registerEditorExtension,
} from '@minecraft/server-editor';

// This is used in the sub pane which contains the dropdown control, and is used to store the current
// selection for the visibility selector
type SettingsType = {
    selected: IObservable<number>;
};

export class SimpleEmptyTool extends SimpleToolWrapper {
    // Unlike the traditional method of adding storage classes to the IPlayerUISession type and registering
    // that with the editor extension, we're going to use a more traditional Object Oriented approach and just
    // store instance data in the class itself.  This is so much easier than the old way, and should be a far
    // more familiar patter to most developers
    private _settings: SettingsType = {
        selected: makeObservable(0),
    };

    constructor(session: IPlayerUISession) {
        super();

        // Set up a Tool Rail component - this directs the Simple Tool wrapper to create a tool rail item,
        // and add the tool as a Modal tool (it will appear in the left side of the display) and be activated
        // either by the specified key binding, or by clicking on the tool rail icon.
        // Each of the function captures (onFinalize, onTeardown, onActivate, onDeactivate) are optional, but allow
        // you (the developer) to insert your own code into the various stages of the tool's lifecycle (for this
        // particular component of the tool)
        const toolRailOptions: ISimpleToolRailOptions = {
            title: 'sample.simpleempty.tool.title',
            icon: 'pack://textures/simple-empty.png',
            tooltip: 'sample.simpleempty.tool.tooltip',
            onFinalize: component => {
                component.simpleTool.logDebug('onFinalize(ISimpleToolRailComponent)');
            },
            onTeardown: component => {
                component.simpleTool.logDebug('onTeardown(ISimpleToolRailComponent)');
            },
            onActivate: component => {
                component.simpleTool.logDebug('onActivate(ISimpleToolRailComponent)');
            },
            onDeactivate: component => {
                component.simpleTool.logDebug('onDeactivate(ISimpleToolRailComponent)');
            },
        };

        // We've decided that this tool will have a property pane (because we're declaring a tool rail (above), the pane
        // will automatically be bound to the tool rail such that when the tool rail is activated, the pane will be shown
        // (and hidden when the tool rail is deactivated).
        // We're also going to set up some child panes with controllable visibility - we use this to group together sets of
        // UI controls and give the ability to show/hide whole groups together
        //
        // main                             The Main Window Pane
        //  1                               Sub Pane 1 (this has a drop down box that selects which child pane is visible)
        //    1-1                           Sub Sub Pane 1-1
        //    1-2                           Sub Sub Pane 1-2
        //  2                               Sub Pane 2 (this has no children, but demonstrates pane ordering and visibility)
        //
        const paneOptions: ISimpleToolPaneOptions = {
            id: 'main', // a unique canonical name for the pane
            title: 'sample.simpleempty.tool.pane.title',

            onBeginFinalize: component => {
                component.simpleTool.logDebug('onBeginFinalize(Pane main)');
                component.pane.addText('sample.simpleempty.tool.pane.top.text', {
                    border: false,
                });
            },

            childPanes: [
                {
                    id: '1',
                    title: 'sample.simpleempty.tool.pane.subpane1.title',

                    onBeginFinalize: component => {
                        component.simpleTool.logDebug('onBeginFinalize(Sub-Pane(1))');

                        this._settings = bindDataSource(component.pane, this._settings);

                        component.pane.addText('sample.simpleempty.tool.subpane1.text', {
                            border: false,
                        });

                        // Add a dropdown to control the visibility of the child panes
                        component.pane.addDropdown(this._settings.selected, {
                            title: 'sample.simpleempty.tool.comboitem.visible',
                            entries: [
                                {
                                    label: 'sample.simpleempty.tool.comboitem1',
                                    value: 0,
                                },
                                {
                                    label: 'sample.simpleempty.tool.comboitem2',
                                    value: 1,
                                },
                                {
                                    label: 'sample.simpleempty.tool.comboitem3',
                                    value: 2,
                                },
                                {
                                    label: 'sample.simpleempty.tool.comboitem4',
                                    value: 3,
                                },
                            ],
                            onChange: (newValue: number) => {
                                const selected = newValue;
                                component.simpleTool.logInfo(`Setting to: [${selected}].`);

                                const children = component.childPaneList;
                                component.simpleTool.logInfo(`Children: [${JSON.stringify(children)}].`);
                                if (selected === 2) {
                                    // Everything
                                    // Iterate over all of our child windows and show them
                                    component.simpleTool.logInfo(`Show all sub-panes`);
                                    children.forEach(child => {
                                        component.simpleTool.showPane(child);
                                    });
                                } else if (selected === 3) {
                                    // Nothing
                                    // Iterate over all of our child windows and hide them
                                    component.simpleTool.logInfo(`Hide all sub-panes`);
                                    children.forEach(child => {
                                        component.simpleTool.hidePane(child);
                                    });
                                } else {
                                    // Show only sub-pane 1 or 2
                                    // In this case, we use the tool component to exclusively show the selected child
                                    // which will automatically show the desired pane and hide the others (and call
                                    // the relevant onShow/onHide events for each pane as appropriate)
                                    const child = children[selected];
                                    component.simpleTool.logInfo(`Show only Child: [${child}].`);
                                    component.simpleTool.showPaneExclusively(child);
                                }
                            },
                        });
                    },

                    childPanes: [
                        {
                            id: '1-1',
                            title: 'sample.simpleempty.tool.subpane1.subpane1.title',
                            onBeginFinalize: component => {
                                component.simpleTool.logDebug('onBeginFinalize(Sub Sub Pane(1-1))');
                                component.pane.addText('sample.simpleempty.tool.subpane1.subpane1.text', {
                                    border: false,
                                });
                            },
                        },
                        {
                            id: '1-2',
                            title: 'sample.simpleempty.tool.subpane1.subpane2.title',
                            onBeginFinalize: component => {
                                component.simpleTool.logDebug('onBeginFinalize(Sub Sub Pane(1-2))');
                                component.pane.addText('sample.simpleempty.tool.subpane1.subpane2.text', {
                                    border: false,
                                });
                            },
                        },
                    ],

                    onEndFinalize: component => {
                        component.simpleTool.logDebug('onEndFinalize(Sub Pane(1))');
                        component.pane.addText('A sub pane (should be at the bottom after the sub-panes)');

                        // Set initial visibility of the child panes
                        component.simpleTool.showPaneExclusively('1-1');
                    },
                },
                {
                    id: '2',
                    title: 'Sub Pane(2)',
                    onEndFinalize: component => {
                        component.simpleTool.logDebug('onEndFinalize(Sub Pane(2))');
                        component.pane.addText('A sub pane');
                    },
                },
            ],

            onEndFinalize: component => {
                component.simpleTool.logDebug('onEndFinalize(Pane main)');
                component.pane.addText('sample.simpleempty.tool.pane.bottom.text', {
                    border: false,
                });
            },
            onTeardown: component => {
                component.simpleTool.logDebug('onTeardown(Pane main)');
            },
            onShow: component => {
                component.simpleTool.logDebug('onShow(Pane main)');
            },
            onHide: component => {
                component.simpleTool.logDebug('onHide(Pane main)');
            },
        };

        // We'll set up a completely optional status bar component that does nothing, but we'll tie the visibility into the
        // modal tool visibility (so if the primary pane is visible, then the status bar will be too). This is optional, and
        // only works if there's a ISimpleToolPropertyPane component added to the tool, otherwise it will be ignored and the
        // status bar will always be visible.
        const statusBarOptions: ISimpleToolStatusBarOptions = {
            alignment: StatusBarAlignment.Left,
            text: 'Simple Empty Status',
            size: 50,
            visibility: SimpleToolStatusBarVisibility.VisibleWhenActive,
            onFinalize: statusBar => {
                statusBar.simpleTool.logDebug('onFinalize(ISimpleToolStatusBarComponent)');
            },
            onTeardown: statusBar => {
                statusBar.simpleTool.logDebug('onTeardown(ISimpleToolStatusBarComponent)');
            },
            onShow: statusBar => {
                statusBar.simpleTool.logDebug('onShow(ISimpleToolStatusBarComponent)');
            },
            onHide: statusBar => {
                statusBar.simpleTool.logDebug('onHide(ISimpleToolStatusBarComponent)');
            },
        };

        // This is the root options structure for the entire tool... you set up the basic options for the tool here, and add
        // additional components as needed (in this case, a status bar, a tool rail, and a property pane)
        // YOu can also specify an activation key binding and some functions to be called during the lifecycle of the tool
        const options: ISimpleToolOptions = {
            name: 'Simple Empty Tool',
            onFinalize: tool => {
                tool.logDebug('onFinalize(ISimpleTool)');
            },
            onTeardown: tool => {
                tool.logDebug('onTeardown(ISimpleTool)');
            },
            statusBarOptions: statusBarOptions,
            toolRailOptions: toolRailOptions,
            propertyPaneOptions: paneOptions,

            activationKeyBinding: {
                binding: {
                    key: KeyboardKey.KEY_B,
                    modifier: InputModifier.Shift | InputModifier.Control,
                },
            },
        };

        // Now call the constructor of the base class (the Simple Tool wrapper) with all the options
        // you just set up.  This will create the tool and force the editor system to set up all the
        // different component parts and bind them into the system
        this.setupSimpleTool(session, options);
    }
}

/**
 * Provides a "Simple Empty Tool" extension to demonstrate the new Simple Tool wrapper system
 * @beta
 */
export function registerSimpleEmptyTool() {
    registerEditorExtension(
        'simple-empty-sample',
        uiSession => {
            uiSession.log.debug(`Initializing extension [${uiSession.extensionContext.extensionInfo.name}]`);

            // Just instantiate the tool and return it to the editor - the editor will deal with cleaning up
            // and shutting down the tool when it's no longer required
            const simpleEmptyTool = new SimpleEmptyTool(uiSession);

            // Return an array of things for the editor to clean up.
            // If you wanted to, you can create many individual tools in this single register function
            // and return them all in the array, and the editor will clean them all up when the extension
            // is unloaded
            return [simpleEmptyTool];
        },
        uiSession => {
            uiSession.log.debug(
                `Shutting down extension [${uiSession.extensionContext.extensionInfo.name}] for player [${uiSession.extensionContext.player.name}]`
            );
        },
        {
            description: '"Simple Empty Tool" Sample Extension',
            notes: 'by Dave (https://youtu.be/KyElxl_j4Wc?si=Mem99VTjqAE_UE2T)',
        }
    );
}
