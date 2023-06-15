import { registerEditorExtension } from '@minecraft/server-editor';

/**
 * Provides a sample extension registration function
 * @public
 */
export function registerEmptyExtension() {
    registerEditorExtension(
        'empty-template',
        uiSession => {
            uiSession.log.debug(
                `Initializing extension [${uiSession.extensionContext.extensionName}] for player [${uiSession.extensionContext.player.name}]`
            );
            return [];
        },

        uiSession => {
            uiSession.log.debug(
                `Shutting down extension [${uiSession.extensionContext.extensionName}] for player [${uiSession.extensionContext.player.name}]`
            );
        },
        {
            description: 'Empty Sample Extension',
            notes: 'Insert any notes, ownership info, etc here.  http://alturl.com/p749b',
        }
    );
}
