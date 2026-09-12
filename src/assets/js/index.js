/**
 * @author ImNotRuso-Mqrttin
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { ipcRenderer, shell } = require('electron');
const pkg = require('../package.json');
const os = require('os');
import { config, database } from './utils.js';
const nodeFetch = require("node-fetch");

class Splash {
    constructor() {
        this.splash = document.querySelector(".splash");
        this.message = document.querySelector(".message");
        this.progress = document.querySelector(".progress");
        this.updateChecking = false;
        this.updateHandled = false;

        document.addEventListener('DOMContentLoaded', async () => {
            console.log('[STELLAR] DOM cargado');

            startBackgroundParticles();

            try {
                const databaseLauncher = new database();
                const configClient = await databaseLauncher.readData('configClient');
                const theme = configClient?.launcher_config?.theme || "auto";

                const isDarkTheme = await ipcRenderer.invoke(
                    'is-dark-theme',
                    theme
                );

                document.body.className = isDarkTheme
                    ? 'dark global'
                    : 'light global';

                if (process.platform === 'win32') {
                    ipcRenderer.send('update-window-progress-load');
                }

                console.log('[STELLAR] Configuración inicial cargada');
            } catch (error) {
                console.error('[STELLAR] Error cargando configuración:', error);
            }

            this.startAnimation();
        });
    }

    async startAnimation() {
        console.log('[STELLAR] Iniciando animación');

        await sleep(100);

        const splashElement = document.querySelector("#splash");

        if (splashElement) {
            splashElement.style.display = "block";
        }

        await sleep(500);

        if (this.splash) {
            this.splash.classList.add("opacity");
        }

        await sleep(500);

        if (this.splash) {
            this.splash.classList.add("translate");
        }

        if (this.message) {
            this.message.classList.add("opacity");
        }

        await sleep(1000);

        console.log('[STELLAR] Animación terminada');
        this.checkUpdate();
    }

    async checkUpdate() {
        if (this.updateChecking) return;

        this.updateChecking = true;

        console.log('[1] checkUpdate');

        this.setStatus('Buscando actualizaciones...');

        ipcRenderer.once('updateAvailable', () => {
            if (this.updateHandled) return;

            this.updateHandled = true;

            console.log('[STELLAR] Hay una actualización disponible');

            this.setStatus('Hay una actualización disponible!');

            if (os.platform() === 'win32') {
                this.toggleProgress();
                ipcRenderer.send('start-update');
            } else {
                this.dowloadUpdate();
            }
        });

        ipcRenderer.once('update-not-available', () => {
            if (this.updateHandled) return;

            this.updateHandled = true;

            console.log('[STELLAR] No hay actualización disponible');

            this.maintenanceCheck();
        });

        ipcRenderer.once('error', (event, err) => {
            if (this.updateHandled) return;

            this.updateHandled = true;

            console.error('[STELLAR] Error del updater:', err);

            this.maintenanceCheck();
        });

        ipcRenderer.on('download-progress', (event, progress) => {
            if (!progress) return;

            ipcRenderer.send('update-window-progress', {
                progress: progress.transferred,
                size: progress.total
            });

            this.setProgress(
                progress.transferred,
                progress.total
            );
        });

        try {
            console.log('[STELLAR] Ejecutando update-app');

            await ipcRenderer.invoke('update-app');

            console.log('[2] update-app terminó');
        } catch (error) {
            if (this.updateHandled) return;

            console.error('[2 ERROR]', error);

            this.updateHandled = true;

            this.maintenanceCheck();
        }
    }

    getLatestReleaseForOS(osName, preferredFormat, asset) {
        if (!Array.isArray(asset)) {
            return null;
        }

        return asset
            .filter(asset => {
                const name = asset.name.toLowerCase();
                const isOSMatch = name.includes(osName);
                const isFormatMatch = name.endsWith(preferredFormat);

                return isOSMatch && isFormatMatch;
            })
            .sort(
                (a, b) =>
                    new Date(b.created_at) -
                    new Date(a.created_at)
            )[0];
    }

    async dowloadUpdate() {
        try {
            const repoURL = pkg.repository.url
                .replace("git+", "")
                .replace(".git", "")
                .replace("https://github.com/", "")
                .split("/");

            const githubAPI = await nodeFetch(
                'https://api.github.com'
            ).then(res => res.json());

            const githubAPIRepoURL = githubAPI.repository_url
                .replace("{owner}", repoURL[0])
                .replace("{repo}", repoURL[1]);

            const githubAPIRepo = await nodeFetch(
                githubAPIRepoURL
            ).then(res => res.json());

            const releases_url = await nodeFetch(
                githubAPIRepo.releases_url.replace("{/id}", '')
            ).then(res => res.json());

            if (!Array.isArray(releases_url) || !releases_url.length) {
                return this.shutdown(
                    "No se encontraron versiones disponibles."
                );
            }

            const latestRelease = releases_url[0].assets;
            let latest;

            if (os.platform() === 'darwin') {
                latest = this.getLatestReleaseForOS(
                    'mac',
                    '.dmg',
                    latestRelease
                );
            } else if (os.platform() === 'linux') {
                latest = this.getLatestReleaseForOS(
                    'linux',
                    '.appimage',
                    latestRelease
                );
            }

            if (!latest) {
                return this.shutdown(
                    "No se encontró una actualización compatible."
                );
            }

            this.setStatus(
                `Hay una actualización disponible !<br><div class="download-update">Actualizar</div>`
            );

            const downloadButton = document.querySelector(
                ".download-update"
            );

            if (downloadButton) {
                downloadButton.addEventListener("click", () => {
                    shell.openExternal(
                        latest.browser_download_url
                    );

                    this.shutdown("Actualización en curso...");
                });
            }
        } catch (error) {
            console.error(
                '[STELLAR] Error obteniendo actualización:',
                error
            );

            this.shutdown(
                "No se pudo obtener la actualización."
            );
        }
    }

    async maintenanceCheck() {
        console.log('[3] maintenanceCheck');

        try {
            console.log('[STELLAR] Ejecutando config.GetConfig');

            const res = await config.GetConfig();

            console.log('[4] GetConfig terminó');
            console.log('[STELLAR] Configuración:', res);

            if (res && res.maintenance) {
                console.log('[STELLAR] Launcher en mantenimiento');

                this.shutdown(
                    res.maintenance_message ||
                    "El servidor está en mantenimiento."
                );

                return;
            }

            console.log('[5] llamando startLauncher');

            this.startLauncher();
        } catch (error) {
            console.error('[4 ERROR]', error);

            console.log('[STELLAR] Continuando hacia MainWindow');

            this.startLauncher();
        }
    }

    startLauncher() {
        console.log('[6] startLauncher');

        this.setStatus('Iniciando el Launcher');

        ipcRenderer.send('main-window-open');
        ipcRenderer.send('update-window-close');
    }

    shutdown(text) {
        this.setStatus(`${text}<br>Apagando en 5s`);

        let i = 4;

        const interval = setInterval(() => {
            this.setStatus(
                `${text}<br>Apagando en ${i--}s`
            );

            if (i < 0) {
                clearInterval(interval);
                ipcRenderer.send('update-window-close');
            }
        }, 1000);
    }

    setStatus(text) {
        if (this.message) {
            this.message.innerHTML = text;
        }

        console.log(
            '[STELLAR]',
            String(text).replace(/<[^>]*>/g, '')
        );
    }

    toggleProgress() {
        if (!this.progress) return;

        if (this.progress.classList.toggle("show")) {
            this.setProgress(0, 1);
        }
    }

    setProgress(value, max) {
        if (!this.progress) return;

        this.progress.value = value;
        this.progress.max = max;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

document.addEventListener("keydown", e => {
    if (
        (e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
        e.keyCode === 123
    ) {
        ipcRenderer.send("update-window-dev-tools");
    }
});

function startBackgroundParticles() {
    const container = document.getElementById('space-container');

    if (!container) return;

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resize();

    window.addEventListener('resize', resize);

    const particles = [];
    const maxParticles = 60;

    for (let i = 0; i < maxParticles; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.6 + 0.4,
            alpha: Math.random() * 0.6 + 0.2,
            speedY: -(Math.random() * 0.25 + 0.05),
            speedX: Math.random() * 0.1 - 0.05
        });
    }

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        particles.forEach(p => {
            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                p.radius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = `rgba(135, 235, 255, ${p.alpha})`;
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#00bcff';

            ctx.fill();

            p.y += p.speedY;
            p.x += p.speedX;

            if (p.y < 0) {
                p.y = canvas.height;
                p.x = Math.random() * canvas.width;
                p.alpha = Math.random() * 0.6 + 0.2;
            }

            if (p.x < 0 || p.x > canvas.width) {
                p.speedX *= -1;
            }
        });

        ctx.shadowBlur = 0;

        requestAnimationFrame(animate);
    }

    animate();
}

new Splash();