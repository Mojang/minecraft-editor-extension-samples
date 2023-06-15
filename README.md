# Bedrock Editor Samples

This folder contains a set of sample Bedrock Editor extensions that you can use for reference or to get started with your own extensions.

We recommend that you familiarize yourself with the
- [Editor Extension Starter Kit](https://github.com/Mojang/minecraft-editor-extension-starter-kit#readme) and
- [Editor Extension Getting Started Guide](https://github.com/Mojang/minecraft-editor-extension-starter-kit/tree/main/gettingStarted#readme)

before you start working with these samples.
<br>
<br>
## Test them out

We've included an [Editor Sample Extension Package](./editor-samples.mceditoraddon) extension package with the sample files compiled and ready to go so you can test them out in the Editor right away.

Just download the [Editor Sample Extension Package](./editor-samples.mceditoraddon) file and double-click it to install it in the Editor.
When you create a new test world, just browse into the `Resource Packs` and `Behavior Packs` section of the world settings and add the sample packs to your world - you should see them appear in the tool rail when you start the edit session.

> Note: If you install the extension addons by double-clicking, make sure you select `Minecraft Bedrock Preview` as the default app to open the file with.
If you don't, then the samples won't be visible to the `Minecraft Bedrock Preview` version of the game and you won't be able to see them.

<br>
<br>

## Samples

| Sample | Description |
|--------|-------------|
| Empty | An empty template that just registers an extension - ready for you to fill in with all your amazing code!<br><br>**Notes**: Completely empty apart from very basic extension registration boilerplate code - use this as a starting template when you start your new extension.<br>**Author**: Dave (I put a ton of work into this one! ;) ) |
| Minimal | A mostly pointless and largely empty extension that just has a 'click me' button -- but it does serve as a good example on how to set up a basic extension.<br><br>**Notes**: This is a good example to jump off with as a learning resource.<br>This extension demonstrates the use of UI components and registering an extension while reserving player specific storage space<br>**Author**: Dave |
| Camera Grapple | Adds an extension which has NO UI components.  The extension is bound to global key bindings and demonstrates using the experimental `/camera` command to perform smooth client-side grapple movement.  The extension also implements a `frame up` function which will zoom to fit a selection area so that it fills the screen.<br><br>This extension demonstrates the use of global key bindings, and the `/camera` command, and invoking slash commands from within script.<br><br>**Notes**: This extension will only initialize if the experimental camera toggle is enabled in the world settings. (check the log window for any warnings during startup).<br> **Author**: Jonas |
| Dye Brush | Adds a brush mechanism that allows the user to paint any entity that has a `minecraft:color` component with a dye color specified on a UI dropdown box.<br><br>This extension demonstrates the use of the selection volumes, user cursor and entity component access<br><br>**Notes**: Activated from the tool rail.  Although the extension works, the results are only visible if Actor Simulation is UN-PAUSED (i.e. Actors are animated/moving).  This example also shows the use of the scroll-wheel to cycle through the selected colors.<br>**Author**: Eser |
| Farm Generator | Adds a dialog that allows you to place a selection of randomized farms containing different combinations of crops and animals, as well as adding irrigation to help grow plants.<br><br>This extension demonstrates the use of UI components, block placement and mouse input.<br><br>**Notes**: Activate using CTRL+SHIFT+F or from the tool rail.<br>**Author**: Molly |
| Goto Mark | Adds a dialog that allows you to modify the players current position in the world by directly typing coordinates.  In addition, you can set the players default spawn position (and jump to it at any time during editing).<br>The extension also allows you to set up to 9 custom world locations as named bookmarks, and jump to them at any time during editing.<br><br> This extension demonstrates dynamic UI component updates, text input, and persistent storage using entity dynamic properties.<br><br>**Notes**: No input required, activated from tool rail.<br>**Author**: Chloe, Eser & Dave |
| Portal Generator | Adds a dialog that allows you to place either Nether or End portals (in various states of completion).<br><br>This extension demonstrates dynamic UI component updates, and block placement.<br><br>**Notes**: Activated using CTRL+SHIFT+P or from tool rail.<br>**Author**: Andrew. |
| Tree Generator | Adds a dialog that allows you to place a selection of randomized trees of certain types wherever you click in the world.<br><br>This extension demonstrates the use of UI components, block placement and mouse input.<br><br>**Notes**: Activated using CTRL+SHIFT+T or through the tool rail.<br>**Author**: Jake || | |


## How to use these samples

Use the [Editor Extension Starter Kit](https://github.com/Mojang/minecraft-editor-extension-starter-kit) to create a new extension project.
- Copy the sample TypeScript file into the `<my new extension>/src` folder
- Update the `<my new extension>/src/index.ts` file to register the extension
- Copy any image files from the sample into the `<my new extension>/assets/resource/textures/` folder (create it if you have to)
- Copy any `en_US.lang` files into the `<my new extension>/assets/texts/` folder (create it if you have to)

### Building
- Follow the Extension Starter Kit instructions to deploy the assets (prepare the resource pack)
- Follow the Extension Starter Kit instructions to build and deploy the extension
- Start the Minecraft Bedrock Preview app, and add your new Behavior & Resource packs to your world
- Start the Editor - you should see the new extension in the tool rail (or check the Log Window for any debug/error messages)

> Alternatively - just use the [Editor Extension Starter Kit](https://github.com/Mojang/minecraft-editor-extension-starter-kit#readme) and choose which sample extension you want to deploy from the installer menu.
