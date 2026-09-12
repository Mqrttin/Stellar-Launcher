const { ipcRenderer } = require('electron');
const { Status } = require('minecraft-java-core');
const pkg = require('../package.json');

import config from './utils/config.js';
import database from './utils/database.js';
import logger from './utils/logger.js';
import popup from './utils/popup.js';
import { skin2D } from './utils/skin.js';
import slider from './utils/slider.js';

let particleCanvas = null;
let particleCtx = null;
let animationFrameId = null;
let particles = [];

function initParticles() {
    if (document.getElementById('launcher-stars-particles')) return;

    particleCanvas = document.createElement('canvas');
    particleCanvas.id = 'launcher-stars-particles';

    Object.assign(particleCanvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '-1',
        pointerEvents: 'none'
    });

    document.body.appendChild(particleCanvas);
    particleCtx = particleCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    particles = [];
    const maxParticles = 65;

    for (let i = 0; i < maxParticles; i++) {
        particles.push({
            x: Math.random() * particleCanvas.width,
            y: Math.random() * particleCanvas.height,
            radius: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.5 + 0.2,
            speedY: -(Math.random() * 0.2 + 0.05),
            speedX: Math.random() * 0.1 - 0.05
        });
    }

    animateParticles();
}

function resizeCanvas() {
    if (particleCanvas) {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }
}

function animateParticles() {
    if (!particleCtx) return;

    particleCtx.clearRect(
        0,
        0,
        particleCanvas.width,
        particleCanvas.height
    );

    particles.forEach(p => {
        particleCtx.beginPath();
        particleCtx.arc(
            p.x,
            p.y,
            p.radius,
            0,
            Math.PI * 2
        );

        particleCtx.fillStyle = `rgba(130, 230, 255, ${p.alpha})`;
        particleCtx.shadowBlur = 4;
        particleCtx.shadowColor = '#00bcff';
        particleCtx.fill();

        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y < 0) {
            p.y = particleCanvas.height;
            p.x = Math.random() * particleCanvas.width;
            p.alpha = Math.random() * 0.5 + 0.2;
        }

        if (p.x < 0 || p.x > particleCanvas.width) {
            p.speedX *= -1;
        }
    });

    particleCtx.shadowBlur = 0;

    animationFrameId = requestAnimationFrame(animateParticles);
}

async function setBackground(theme) {
    if (typeof theme === 'undefined') {
        let databaseLauncher = new database();
        let configClient = await databaseLauncher.readData('configClient');

        theme = configClient?.launcher_config?.theme || 'auto';
        theme = await ipcRenderer.invoke('is-dark-theme', theme);
    }

    let body = document.body;

    body.className = theme ? 'dark global' : 'light global';

    body.style.backgroundImage = `
        radial-gradient(circle at 50% 35%, rgba(0, 162, 232, 0.23) 0%, transparent 55%),
        radial-gradient(circle at 85% 20%, rgba(0, 100, 200, 0.18) 0%, transparent 45%),
        radial-gradient(circle at 15% 75%, rgba(2, 40, 80, 0.6) 0%, transparent 50%),
        linear-gradient(135deg, #020912 0%, #041321 40%, #01060b 100%)
    `;

    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundRepeat = 'no-repeat';
    body.style.backgroundAttachment = 'fixed';
    body.style.transition = 'background 0.8s ease, opacity .5s ease';

    initParticles();
}

async function setBackgroundAnimated(theme) {
    const body = document.body;

    body.style.opacity = 0;

    setTimeout(async () => {
        await setBackground(theme);
        body.style.opacity = 1;
    }, 500);
}

setBackground();

async function changePanel(id) {
    const panels = document.querySelectorAll('.panel');
    const current = document.querySelector('.panel.active');
    const target = document.querySelector(`.panel.${id}`);

    if (!target || current === target) {
        if (target) {
            target.classList.remove('panel-exit');
            target.classList.add('active');
        }

        return;
    }

    if (current) {
        current.classList.remove('panel-exit');
        current.classList.add('panel-exit');

        await new Promise(resolve => setTimeout(resolve, 220));

        current.classList.remove('active');
        current.classList.remove('panel-exit');
    }

    panels.forEach(panel => {
        if (panel !== target) {
            panel.classList.remove('active');
            panel.classList.remove('panel-exit');
        }
    });

    target.classList.add('active');

    void target.offsetHeight;
}

async function appdata() {
    return await ipcRenderer.invoke('appData');
}

async function addAccount(data) {
    let skin = false;

    if (data?.profile?.skins?.[0]?.base64) {
        skin = await new skin2D().creatHeadTexture(
            data.profile.skins[0].base64
        );
    }

    let accountsList = document.querySelector('.accounts-list');

    if (!accountsList) return;

    let oldAccount = document.getElementById(`${data.ID}`);

    if (oldAccount) {
        oldAccount.remove();
    }

    let div = document.createElement('div');

    div.classList.add('account');
    div.id = data.ID;

    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image:url(' + skin + ');"' : ''}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${data.name}</div>
            <div class="profile-uuid">${data.uuid}</div>
        </div>
        <div class="delete-profile" id="${data.ID}">
            <div class="icon-account-delete delete-profile-icon"></div>
        </div>
    `;

    accountsList.appendChild(div);

    return div;
}

async function accountSelect(data) {
    if (!data || !data.ID) return;

    let account = document.getElementById(`${data.ID}`);
    let activeAccount = document.querySelector('.account-select');

    if (activeAccount) {
        activeAccount.classList.remove('account-select');
    }

    if (account) {
        account.classList.add('account-select');
    }
}

async function setStatus(opt) {
    let nameServerElement = document.querySelector('.server-status-name');
    let statusServerElement = document.querySelector('.server-status-text');
    let playerCountContainer = document.querySelector('.status-player-count');
    let playersOnline = document.querySelector('.status-player-count .player-count');

    if (!statusServerElement && !playerCountContainer && !playersOnline && !nameServerElement) {
        return;
    }

    if (!opt) {
        if (statusServerElement) {
            statusServerElement.classList.add('red');
            statusServerElement.innerHTML = 'Apagado';
        }

        if (playerCountContainer) {
            playerCountContainer.classList.add('red');
        }

        if (playersOnline) {
            playersOnline.innerHTML = '0';
        }

        return;
    }

    let { ip, port, nameServer } = opt;

    if (nameServerElement && nameServer) {
        nameServerElement.innerHTML = nameServer;
    }

    if (!ip || !port) {
        if (statusServerElement) {
            statusServerElement.classList.add('red');
            statusServerElement.innerHTML = 'Apagado';
        }

        if (playerCountContainer) {
            playerCountContainer.classList.add('red');
        }

        if (playersOnline) {
            playersOnline.innerHTML = '0';
        }

        return;
    }

    let status = new Status(ip, port);

    let statusServer = await status.getStatus().catch(err => ({
        error: true,
        errorMessage: err?.message || 'Error desconocido'
    }));

    if (!statusServer.error) {
        if (statusServerElement) {
            statusServerElement.classList.remove('red');
            statusServerElement.innerHTML = 'En línea';
        }

        if (playerCountContainer) {
            playerCountContainer.classList.remove('red');
        }

        if (playersOnline) {
            playersOnline.innerHTML = statusServer.playersConnect ?? '0';
        }
    } else {
        if (statusServerElement) {
            statusServerElement.classList.add('red');
            statusServerElement.innerHTML = 'Apagado';
        }

        if (playerCountContainer) {
            playerCountContainer.classList.add('red');
        }

        if (playersOnline) {
            playersOnline.innerHTML = '0';
        }
    }
}

let accountWatcher = null;

async function watchAccountChanges() {
    if (accountWatcher) return;

    let lastAccount = null;

    accountWatcher = setInterval(async () => {
        try {
            let db = new database();

            let configClient = await db.readData('configClient');

            if (!configClient?.account_selected) return;

            let account = await db.readData(
                'accounts',
                configClient.account_selected
            );

            if (!account) return;

            let current = JSON.stringify(account);

            if (current !== lastAccount) {
                lastAccount = current;

                console.log('Cuenta actualizada en tiempo real:', account);

                document.dispatchEvent(
                    new CustomEvent('account:updated', {
                        detail: account
                    })
                );
            }
        } catch (err) {
            console.error('Error actualizando cuenta:', err);
        }
    }, 1000);
}

export {
    appdata,
    changePanel,
    config,
    database,
    logger,
    popup,
    setBackground,
    setBackgroundAnimated,
    skin2D,
    addAccount,
    accountSelect,
    watchAccountChanges,
    slider as Slider,
    pkg,
    setStatus
};