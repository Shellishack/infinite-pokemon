# Infinite Pokémon branding

The active wordmark is `infinite-pokemon-logo.svg`, used by the game title, Electron startup screen and README. It is code-native vector artwork with no external font dependency.

The earlier Tamer PNG and its prompt are retained as unused historical artwork. They are not referenced by the active UI.

The Electron window/taskbar icon is `app-icon.ico` (16,24,32,48,64,128,256px); `app-icon.png` is the512px companion used in the desktop header and on non-Windows platforms. Both are rendered from `app-icon.svg` with `npm run icon:build`. The browser favicon uses the SVG directly.
