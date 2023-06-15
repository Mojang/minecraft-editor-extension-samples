import {
    ActionTypes,
    CursorControlMode,
    EditorInputContext,
    IPlayerUISession,
    InputModifier,
    KeyboardKey,
    registerEditorExtension,
} from '@minecraft/server-editor';
import { Player, Vector, Vector3, system } from '@minecraft/server';

function flyCameraToTarget(player: Player, viewTarget: Vector3, radius: number) {
    // This is imperfect and causes a visible pop.  Would be better if we could get the player's exact eye height
    const eyeHeight = Vector.subtract(player.getHeadLocation(), player.location);
    const viewVector = player.getViewDirection();
    radius = Math.max(radius, 1);
    // FOV in first_person.json is 66 degrees
    const halfFOV = 66 / 2;
    // Compute adjacent side of triangle (distance) when opposite side is radius
    const distanceAway = radius / Math.tan((halfFOV * Math.PI) / 180);
    const destCameraLocation = Vector.subtract(viewTarget, Vector.multiply(viewVector, distanceAway));
    const destPlayerLocation = Vector.subtract(destCameraLocation, eyeHeight);
    const easeTimeInSeconds = 1.5;
    // Unhook camera and have it start moving to the new location
    player.runCommand(
        `/camera @s set minecraft:free ease ${easeTimeInSeconds} in_out_quad pos ${destCameraLocation.x} ${destCameraLocation.y} ${destCameraLocation.z} rot ~ ~`
    );
    // Move the player to a location below our target to avoid it being in the way visually
    player.teleport(Vector.subtract(destPlayerLocation, { x: 0, y: 250, z: 0 }));
    system.runTimeout(() => {
        // Move the player to the final location and re-hook the camera to it
        player.teleport(destPlayerLocation);
        player.runCommand('/camera @s clear');
    }, easeTimeInSeconds * 20);
}
/**
 * Provides a "Grapple" extension for quickly moving the player around the world
 * @beta
 */
export function registerCameraGrapple() {
    registerEditorExtension(
        'camera-grapple',
        uiSession => {
            uiSession.log.debug(`Initializing extension [${uiSession.extensionContext.extensionName}]`);

            // Do a quick test for compatibility -- '/camera' is currently an experiment
            // so if the experimental camera flag is NOT on for this world, we're going to see
            // exceptions thrown
            try {
                const me = uiSession.extensionContext.player;
                me.runCommand('/camera @s clear');
            } catch (error) {
                uiSession.log.error(
                    `The extension [${uiSession.extensionContext.extensionName}] requires the experimental camera toggle ON`
                );
                return [];
            }

            const grappleAction = uiSession.actionManager.createAction({
                actionType: ActionTypes.NoArgsAction,
                onExecute: () => {
                    let destBlockLoc: Vector3 | undefined = undefined;
                    const cursor = uiSession.extensionContext.cursor;

                    // Fixed cursor mode will default to the player view direction
                    if (cursor.isVisible && cursor.getProperties().controlMode !== CursorControlMode.Fixed) {
                        destBlockLoc = cursor.getPosition();
                    } else {
                        const result = uiSession.extensionContext.player.getBlockFromViewDirection();
                        if (!result) {
                            uiSession.log.warning('No Block Found.  Aborting Grapple');
                            return;
                        }
                        destBlockLoc = result?.block.location;
                    }

                    // Location of the center of the block
                    const viewTarget = Vector.add(destBlockLoc, { x: 0.5, y: 0.5, z: 0.5 });
                    flyCameraToTarget(uiSession.extensionContext.player, viewTarget, 2);
                },
            });

            const frameAction = uiSession.actionManager.createAction({
                actionType: ActionTypes.NoArgsAction,
                onExecute: () => {
                    const selection = uiSession.extensionContext.selectionManager.selection;
                    if (selection.isEmpty) {
                        return;
                    }

                    const bounds = selection.getBoundingBox();
                    bounds.max = Vector.add(bounds.max, { x: 1, y: 1, z: 1 });
                    const halfSize = Vector.multiply(Vector.subtract(bounds.max, bounds.min), 0.5);
                    const viewTarget = Vector.add(bounds.min, halfSize);
                    const radius = Math.sqrt(
                        halfSize.x * halfSize.x + halfSize.y * halfSize.y + halfSize.z * halfSize.z
                    );

                    flyCameraToTarget(uiSession.extensionContext.player, viewTarget, radius);
                },
            });

            uiSession.inputManager.registerKeyBinding(
                EditorInputContext.GlobalToolMode,
                grappleAction,
                KeyboardKey.KEY_G,
                InputModifier.Control | InputModifier.Shift
            );
            uiSession.inputManager.registerKeyBinding(
                EditorInputContext.GlobalToolMode,
                frameAction,
                KeyboardKey.KEY_F,
                InputModifier.Control | InputModifier.Shift
            );

            return [];
        },
        (uiSession: IPlayerUISession) => {
            uiSession.log.debug(
                `Shutting down extension [${uiSession.extensionContext.extensionName}] for player [${uiSession.extensionContext.player.name}]`
            );
        },
        {
            description: '"Camera Grapple" Sample Extension',
            notes: 'by Jonas (https://youtu.be/BJWhyDeVb3E)',
        }
    );
}
