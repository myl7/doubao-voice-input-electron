import { Tray, Menu, app, nativeImage } from "electron";
import { join } from "path";
import { createOrShowFloatingWindow, showSettingsWindow } from "./windows";

let tray: Tray | null = null;

export function createTray(): Tray {
    // Use a template image (monochrome for macOS menu bar)
    const iconPath = join(__dirname, "../../resources/tray-icon.png");
    let icon: Electron.NativeImage;

    try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
            // Fallback: create a tiny 16x16 icon programmatically
            icon = nativeImage.createEmpty();
        }
    } catch {
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);
    tray.setToolTip("豆包语音输入");
    updateTrayMenu();

    return tray;
}

export function updateTrayMenu(): void {
    if (!tray) return;

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Show Window",
            click: () => {
                createOrShowFloatingWindow();
            },
        },
        { type: "separator" },
        {
            label: "Settings...",
            accelerator: "CmdOrCtrl+,",
            click: () => showSettingsWindow(),
        },
        { type: "separator" },
        {
            label: "Quit",
            accelerator: "CmdOrCtrl+Q",
            click: () => app.quit(),
        },
    ]);

    tray.setContextMenu(contextMenu);
}
