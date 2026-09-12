/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { app, ipcMain, nativeTheme, Tray, Menu } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater');

const path = require('path');
const fs = require('fs');

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

let tray = null; // Tray global
let isQuitting = false; // Flag para evitar actualizar RPC después de cerrar

// ---------------- Discord RPC ----------------
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

// ---------------- Función para limpiar RPC ----------------
function cleanupRPC() {
    if (!isQuitting) {
        isQuitting = true;
        try {
            rpcClient.clearActivity(); // Borra la presencia
            rpcClient.destroy();       // Desconecta
            console.log('Discord RPC desconectado correctamente.');
        } catch (e) {
            console.error('Error desconectando RPC:', e);
        }
    }
}

// ---------------- Función para salir del launcher ----------------
function quitLauncher() {
    cleanupRPC();

    const mainWin = MainWindow.getWindow();
    if (mainWin && !mainWin.isDestroyed()) try { mainWin.destroy(); } catch(e) {}

    const updateWin = UpdateWindow.getWindow();
    if (updateWin && !updateWin.isDestroyed()) try { updateWin.destroy(); } catch(e) {}

    if (tray && !tray.isDestroyed()) try { tray.destroy(); } catch(e) {}

    app.exit(0);
}

// ---------------- Resto de tu código original ----------------
let dev = process.env.NODE_ENV === 'dev';

if (dev) {
    let appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    let appdata = path.resolve('./data').replace(/\\/g, '/');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
    if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
    app.setPath('userData', appPath);
    app.setPath('appData', appdata)
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {

    //UpdateWindow.createWindow();
    if (dev) MainWindow.createWindow();
    else UpdateWindow.createWindow();

    // ---------------- Tray ----------------
    tray = new Tray(path.join(__dirname, 'assets', 'images', 'icon.png'));
    tray.setToolTip('Stellar Network');

    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Abrir Launcher',
            click: () => {
                let win = MainWindow.getWindow();
                if (win) { win.show(); win.focus(); }
                else MainWindow.createWindow();
            }
        },
        { label: 'Cerrar', click: () => quitLauncher() }
    ]);
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        let win = MainWindow.getWindow();
        if (win) win.show();
    });

    let win = MainWindow.getWindow();
    if (win) {
        win.on('close', (event) => {
            event.preventDefault();
            quitLauncher();
        });
    }
});

// ---------------- IPC ----------------
ipcMain.on('main-window-open', () => MainWindow.createWindow());
ipcMain.on('main-window-dev-tools', () => MainWindow.getWindow().webContents.openDevTools({ mode: 'detach' }));
ipcMain.on('main-window-dev-tools-close', () => MainWindow.getWindow().webContents.closeDevTools());
ipcMain.on('main-window-close', () => MainWindow.destroyWindow());
ipcMain.on('main-window-reload', () => MainWindow.getWindow().reload());
ipcMain.on('main-window-progress', (event, options) => MainWindow.getWindow().setProgressBar(options.progress / options.size));
ipcMain.on('main-window-progress-reset', () => MainWindow.getWindow().setProgressBar(-1));
ipcMain.on('main-window-progress-load', () => MainWindow.getWindow().setProgressBar(2));
ipcMain.on('main-window-minimize', () => MainWindow.getWindow().minimize());
ipcMain.on('main-window-maximize', () => {
    if (MainWindow.getWindow().isMaximized()) MainWindow.getWindow().unmaximize();
    else MainWindow.getWindow().maximize();
});
ipcMain.on('main-window-hide', () => MainWindow.getWindow().hide());
ipcMain.on('main-window-show', () => MainWindow.getWindow().show());
ipcMain.on('minecraft-launch', () => { const win = MainWindow.getWindow(); if(win) win.webContents.send('pause-audio'); });
ipcMain.on('minecraft-close', () => { const win = MainWindow.getWindow(); if(win) win.webContents.send('resume-audio'); });
ipcMain.on('force-exit', () => quitLauncher());

ipcMain.handle('Microsoft-window', async (_, client_id) => { return await new Microsoft(client_id).getAuth(); });
ipcMain.handle('is-dark-theme', (_, theme) => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return nativeTheme.shouldUseDarkColors;
});
ipcMain.on('update-window-close', () => UpdateWindow.destroyWindow());
ipcMain.on('update-window-dev-tools', () => UpdateWindow.getWindow().webContents.openDevTools({ mode: 'detach' }));
ipcMain.on('update-window-progress', (event, options) => UpdateWindow.getWindow().setProgressBar(options.progress / options.size));
ipcMain.on('update-window-progress-reset', () => UpdateWindow.getWindow().setProgressBar(-1));
ipcMain.on('update-window-progress-load', () => UpdateWindow.getWindow().setProgressBar(2));
ipcMain.handle('path-user-data', () => app.getPath('userData'));
ipcMain.handle('appData', e => app.getPath('appData'));

autoUpdater.autoDownload = false;
ipcMain.handle('update-app', async () => {
    return await new Promise(async (resolve, reject) => {
        autoUpdater.checkForUpdates().then(res => resolve(res)).catch(error => reject({ error: true, message: error }));
    });
});
autoUpdater.on('update-available', () => { const updateWindow = UpdateWindow.getWindow(); if(updateWindow) updateWindow.webContents.send('updateAvailable'); });
ipcMain.on('start-update', () => autoUpdater.downloadUpdate());
autoUpdater.on('update-not-available', () => { const updateWindow = UpdateWindow.getWindow(); if(updateWindow) updateWindow.webContents.send('update-not-available'); });
autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());
autoUpdater.on('download-progress', (progress) => { const updateWindow = UpdateWindow.getWindow(); if(updateWindow) updateWindow.webContents.send('download-progress', progress); });
autoUpdater.on('error', (err) => { const updateWindow = UpdateWindow.getWindow(); if(updateWindow) updateWindow.webContents.send('error', err); });

// ---------------- Manejo de cierres globales ----------------
app.on('window-all-closed', () => { cleanupRPC(); if(process.platform !== 'darwin') app.quit(); });
process.on('SIGINT', () => { cleanupRPC(); process.exit(); });
process.on('exit', () => { cleanupRPC(); });

// ---------------- Evitar actualizar RPC después de cerrar ----------------
ipcMain.on('update-rpc', (data) => {
    if (isQuitting) return;
    rpcClient.setActivity(data);
});