const { app, ipcMain, nativeTheme, Tray, Menu } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

let tray = null;
let isQuitting = false;

const RPC = require('discord-rpc');
const clientId = '1475181599493587004';
const rpcClient = new RPC.Client({ transport: 'ipc' });

rpcClient.on('ready', () => {
    rpcClient.setActivity({
        details: 'Jugando en Stellar Network',
        state: 'play.stellarmc.pro',
        startTimestamp: Date.now(),
        largeImageKey: 'logo',
        largeImageText: 'Stellar Network',
        instance: true
    });

    console.log('Discord RPC activado.');
});

rpcClient.login({ clientId }).catch(console.error);

function cleanupRPC() {
    if (isQuitting) return;

    isQuitting = true;

    try {
        rpcClient.clearActivity();
        rpcClient.destroy();
        console.log('Discord RPC desconectado correctamente.');
    } catch (e) {
        console.error('Error desconectando RPC:', e);
    }
}

function quitLauncher() {
    cleanupRPC();

    const mainWin = MainWindow.getWindow();

    if (mainWin && !mainWin.isDestroyed()) {
        try {
            mainWin.destroy();
        } catch (e) {}
    }

    const updateWin = UpdateWindow.getWindow();

    if (updateWin && !updateWin.isDestroyed()) {
        try {
            updateWin.destroy();
        } catch (e) {}
    }

    if (tray && !tray.isDestroyed()) {
        try {
            tray.destroy();
        } catch (e) {}
    }

    app.exit(0);
}

let dev = process.env.NODE_ENV === 'dev';

if (dev) {
    let appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    let appdata = path.resolve('./data').replace(/\\/g, '/');

    if (!fs.existsSync(appPath)) {
        fs.mkdirSync(appPath, { recursive: true });
    }

    if (!fs.existsSync(appdata)) {
        fs.mkdirSync(appdata, { recursive: true });
    }

    app.setPath('userData', appPath);
    app.setPath('appData', appdata);
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.whenReady().then(() => {
        UpdateWindow.createWindow();

        tray = new Tray(
            path.join(__dirname, 'assets', 'images', 'icon.png')
        );

        tray.setToolTip('Stellar Network');

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Abrir Launcher',
                click: () => {
                    const win = MainWindow.getWindow();

                    if (win && !win.isDestroyed()) {
                        win.show();
                        win.focus();
                    } else {
                        MainWindow.createWindow();
                    }
                }
            },
            {
                label: 'Cerrar',
                click: () => quitLauncher()
            }
        ]);

        tray.setContextMenu(contextMenu);

        tray.on('double-click', () => {
            const win = MainWindow.getWindow();

            if (win && !win.isDestroyed()) {
                win.show();
                win.focus();
            } else {
                MainWindow.createWindow();
            }
        });
    });
}

ipcMain.on('main-window-open', () => {
    console.log('[STELLAR] Abriendo MainWindow...');

    const existingWindow = MainWindow.getWindow();

    if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.show();
        existingWindow.focus();

        UpdateWindow.destroyWindow();
        return;
    }

    MainWindow.createWindow();
});

ipcMain.on('main-window-dev-tools', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.webContents.openDevTools({ mode: 'detach' });
    }
});

ipcMain.on('main-window-dev-tools-close', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.webContents.closeDevTools();
    }
});

ipcMain.on('main-window-close', () => {
    MainWindow.destroyWindow();
});

ipcMain.on('main-window-reload', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.reload();
    }
});

ipcMain.on('main-window-progress', (event, options) => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.setProgressBar(options.progress / options.size);
    }
});

ipcMain.on('main-window-progress-reset', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.setProgressBar(-1);
    }
});

ipcMain.on('main-window-progress-load', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.setProgressBar(2);
    }
});

ipcMain.on('main-window-minimize', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.minimize();
    }
});

ipcMain.on('main-window-maximize', () => {
    const win = MainWindow.getWindow();

    if (!win || win.isDestroyed()) return;

    if (win.isMaximized()) {
        win.unmaximize();
    } else {
        win.maximize();
    }
});

ipcMain.on('main-window-hide', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.hide();
    }
});

ipcMain.on('main-window-show', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.show();
    }
});

ipcMain.on('minecraft-launch', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.webContents.send('pause-audio');
    }
});

ipcMain.on('minecraft-close', () => {
    const win = MainWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.webContents.send('resume-audio');
    }
});

ipcMain.on('force-exit', () => {
    quitLauncher();
});

ipcMain.handle('Microsoft-window', async (_, client_id) => {
    return await new Microsoft(client_id).getAuth();
});

ipcMain.handle('is-dark-theme', (_, theme) => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;

    return nativeTheme.shouldUseDarkColors;
});

ipcMain.on('update-window-close', () => {
    console.log('[STELLAR] Cerrando UpdateWindow...');
    UpdateWindow.destroyWindow();
});

ipcMain.on('update-window-dev-tools', () => {
    const win = UpdateWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.webContents.openDevTools({ mode: 'detach' });
    }
});

ipcMain.on('update-window-progress', (event, options) => {
    const win = UpdateWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.setProgressBar(options.progress / options.size);
    }
});

ipcMain.on('update-window-progress-reset', () => {
    const win = UpdateWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.setProgressBar(-1);
    }
});

ipcMain.on('update-window-progress-load', () => {
    const win = UpdateWindow.getWindow();

    if (win && !win.isDestroyed()) {
        win.setProgressBar(2);
    }
});

ipcMain.handle('path-user-data', () => {
    return app.getPath('userData');
});

ipcMain.handle('appData', () => {
    return app.getPath('appData');
});

autoUpdater.autoDownload = false;

ipcMain.handle('update-app', async () => {
    return await new Promise(async (resolve, reject) => {
        autoUpdater.checkForUpdates()
            .then(res => resolve(res))
            .catch(error => reject({
                error: true,
                message: error
            }));
    });
});

autoUpdater.on('update-available', () => {
    const updateWindow = UpdateWindow.getWindow();

    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('updateAvailable');
    }
});

ipcMain.on('start-update', () => {
    autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', () => {
    const updateWindow = UpdateWindow.getWindow();

    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('update-not-available');
    }
});

autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall();
});

autoUpdater.on('download-progress', progress => {
    const updateWindow = UpdateWindow.getWindow();

    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('download-progress', progress);
    }
});

autoUpdater.on('error', err => {
    const updateWindow = UpdateWindow.getWindow();

    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('error', err);
    }
});

app.on('window-all-closed', () => {
    cleanupRPC();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

process.on('SIGINT', () => {
    cleanupRPC();
    process.exit();
});

process.on('exit', () => {
    cleanupRPC();
});

ipcMain.on('update-rpc', data => {
    if (isQuitting) return;

    rpcClient.setActivity(data);
});