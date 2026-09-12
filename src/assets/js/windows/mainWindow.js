const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const pkg = require("../../../../package.json");

let dev = process.env.DEV_TOOL === "open";
let mainWindow = undefined;
let consoleWindow = undefined;
let consoleLogs = [];

function getWindow() {
    return mainWindow;
}

function getConsoleWindow() {
    return consoleWindow;
}

function addConsoleLog(type, name, message) {
    const log = {
        type,
        name: name || "STELLAR",
        message: String(message ?? ""),
        time: new Date().toLocaleTimeString()
    };

    consoleLogs.push(log);

    if (consoleLogs.length > 500) {
        consoleLogs.shift();
    }

    if (consoleWindow && !consoleWindow.isDestroyed() && consoleWindow.webContents) {
        consoleWindow.webContents.send("stellar-console-log", log);
    }
}

function destroyConsoleWindow() {
    if (!consoleWindow) return;

    if (!consoleWindow.isDestroyed()) {
        consoleWindow.destroy();
    }

    consoleWindow = undefined;
}

function destroyWindow() {
    destroyConsoleWindow();

    if (!mainWindow) {
        app.quit();
        return;
    }

    mainWindow.destroy();
    mainWindow = undefined;
    app.quit();
}

function openConsoleWindow() {
    if (consoleWindow && !consoleWindow.isDestroyed()) {
        consoleWindow.show();
        consoleWindow.focus();
        return consoleWindow;
    }

    consoleWindow = new BrowserWindow({
        title: "Stellar Console",
        width: 950,
        height: 620,
        minWidth: 700,
        minHeight: 450,
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        frame: false,
        backgroundColor: "#020b14",
        show: false,
        icon: path.join(
            app.getAppPath(),
            "src/assets/images",
            `icon.${os.platform() === "win32" ? "ico" : "png"}`
        ),
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            sandbox: false
        }
    });

    consoleWindow.loadFile(
        path.join(app.getAppPath(), "src/panels/console.html")
    );

    consoleWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
        console.error("[STELLAR CONSOLE]", errorCode, errorDescription, validatedURL);
    });

    consoleWindow.once("ready-to-show", () => {
        if (!consoleWindow || consoleWindow.isDestroyed()) return;

        consoleWindow.show();
        consoleWindow.focus();

        for (const log of consoleLogs) {
            consoleWindow.webContents.send("stellar-console-log", log);
        }
    });

    consoleWindow.on("closed", () => {
        consoleWindow = undefined;
    });

    return consoleWindow;
}

function createWindow() {
    destroyConsoleWindow();

    mainWindow = new BrowserWindow({
        title: pkg.preductname,
        width: 1450,
        height: 880,
        minWidth: 980,
        minHeight: 552,
        resizable: true,
        icon: path.join(
            app.getAppPath(),
            "src/assets/images",
            `icon.${os.platform() === "win32" ? "ico" : "png"}`
        ),
        frame: os.platform() !== "win32",
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            sandbox: false
        }
    });

    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);

    mainWindow.loadFile(
        path.join(app.getAppPath(), "src/launcher.html")
    );

    mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
        let type = "info";

        if (level === 2) {
            type = "warn";
        }

        if (level === 3) {
            type = "error";
        }

        addConsoleLog(type, "LAUNCHER", message);
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown") return;

        if (input.key === "F12") {
            event.preventDefault();
            openConsoleWindow();
            return;
        }

        if (
            input.control &&
            input.shift &&
            input.key.toUpperCase() === "I"
        ) {
            event.preventDefault();

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.openDevTools({
                    mode: "detach"
                });
            }

            return;
        }
    });

    mainWindow.on("close", () => {
        destroyConsoleWindow();
        mainWindow = undefined;
        app.quit();
    });

    mainWindow.once("ready-to-show", () => {
        if (!mainWindow) return;

        if (dev) {
            mainWindow.webContents.openDevTools({
                mode: "detach"
            });
        }

        mainWindow.show();
    });
}

ipcMain.on("stellar-console-log", (event, data) => {
    if (!data) return;

    addConsoleLog(
        data.type || "info",
        data.name || "STELLAR",
        data.message || ""
    );
});

ipcMain.on("console-close", () => {
    if (consoleWindow && !consoleWindow.isDestroyed()) {
        consoleWindow.close();
    }
});

ipcMain.on("console-minimize", () => {
    if (consoleWindow && !consoleWindow.isDestroyed()) {
        consoleWindow.minimize();
    }
});

module.exports = {
    getWindow,
    getConsoleWindow,
    openConsoleWindow,
    destroyConsoleWindow,
    createWindow,
    destroyWindow
};