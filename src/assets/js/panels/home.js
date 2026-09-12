import {
    config,
    database,
    logger,
    changePanel,
    appdata,
    setStatus,
    pkg,
    popup,
    setBackgroundAnimated,
    watchAccountChanges
} from '../utils.js'

const { Launch, Microsoft } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')

class Home {
    static id = "home";

    getInstanceType(instanceName = "") {
        const name = String(instanceName).toLowerCase()
        if (name.includes("cobblemon")) return "cobblemon"
        if (name.includes("pixelmon")) return "pixelmon"
        return null
    }

    getInstanceUIName(instanceName = "") {
        const name = String(instanceName)
        const lowerName = name.toLowerCase()

        if (lowerName.includes("cobblemon")) {
            if (lowerName.includes("bajos recursos")) return "Cobblemon (Bajos Recursos)"
            if (lowerName.includes("altos recursos")) return "Cobblemon (Altos Recursos)"
            return "Cobblemon"
        }

        if (lowerName.includes("pixelmon")) {
            if (lowerName.includes("bajos recursos")) return "Pixelmon (Bajos Recursos)"
            if (lowerName.includes("altos recursos")) return "Pixelmon (Altos Recursos)"
            return "Pixelmon"
        }

        return name
    }

    async init(config) {
        this.config = config
        this.db = new database()

        let configClient = await this.db.readData('configClient')

        if (!configClient || Object.keys(configClient).length === 0) {
            console.log("Creando configClient por primera vez")

            await this.db.createData('configClient', {
                account_selected: null,
                instance_selct: null,
                launcher_config: {
                    closeLauncher: "close-launcher",
                    download_multi: true,
                    intelEnabledMac: false
                },
                java_config: {
                    java_path: null,
                    java_memory: {
                        min: 2,
                        max: 4
                    }
                },
                game_config: {
                    screen_size: {
                        width: 854,
                        height: 480
                    }
                }
            })
        }

        this.initSocials()
        this.initPartnerLogos()

        await this.updateAccountStatus()
        watchAccountChanges()
        this.loadAccounts()

        document.addEventListener('account:updated', async e => {
            console.log("Cuenta actualizada en tiempo real:", e.detail)

            const account = e.detail

            await this.updateAccountStatus()
            await this.updatePlayerHead(account)
        })

        document.addEventListener('account:selected', async () => {
            console.log("Cuenta cambiada, actualizando estado...")
            await this.updateAccountStatus()
        })

        this.updateServerPlayers()

        setInterval(() => {
            this.updateServerPlayers()
        }, 15000)

        this.instancesSelect()

        const settingsBtn = document.querySelector('.settings-btn')

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                changePanel('settings')
            })
        }

        const manageAccountBtn = document.querySelector('.manage-account')
        if (manageAccountBtn) {
            manageAccountBtn.addEventListener('click', () => {
                changePanel('settings')
                setTimeout(() => {
                    const accountBtn = document.getElementById('account')
                    if (accountBtn) {
                        accountBtn.click()
                    }
                }, 150)
            })
        }

        const instancesBtn = document.getElementById('nav-instances')

        if (instancesBtn) {
            instancesBtn.addEventListener('click', () => {
                changePanel('instances')
            })
        }

        const selectInstanceBtn = document.querySelector('.select-instance')

        if (selectInstanceBtn) {
            selectInstanceBtn.addEventListener('click', () => {
                changePanel('instances')
            })
        }

        const newsBtn = document.getElementById('nav-news')

        if (newsBtn) {
            newsBtn.addEventListener('click', () => {
                changePanel('news')
            })
        }

        const discordBtn = document.getElementById('nav-discord')
        const storeBtn = document.getElementById('nav-store')

        if (discordBtn) {
            discordBtn.addEventListener('click', () => {
                shell.openExternal('https://discord.gg/pokearena')
            })
        }

        if (storeBtn) {
            storeBtn.addEventListener('click', () => {
                shell.openExternal('https://tienda.pokearena.net/')
            })
        }

        const openFolderBtn = document.getElementById('open-folder')

        if (openFolderBtn) {
            openFolderBtn.addEventListener('click', async () => {
                const launcherPath = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/instances`
                shell.openPath(launcherPath)
            })
        }

        const playerHead = document.querySelector(".player-head")

        if (playerHead) {
            playerHead.addEventListener("click", () => {
                const settingsButton = document.querySelector(".settings-btn")

                if (!settingsButton) return

                settingsButton.click()

                setTimeout(() => {
                    const btn = document.getElementById("account")

                    if (btn) {
                        btn.click()
                    }
                }, 150)
            })
        }

        let configClientFinal = await this.db.readData('configClient')
        let instancia = configClientFinal.instance_selct || "cobblemon"
        let tipoInstancia = this.getInstanceType(instancia) || "cobblemon"

        await this.loadNewsAndTikTok(tipoInstancia)

        document.addEventListener('instance:selected', async e => {
            const instance = e.detail?.instance

            if (!instance) return

            const instanceCard = document.querySelector('.instance-card')

            if (instanceCard && instance.image) {
                instanceCard.style.backgroundImage = `url("${instance.image}")`
            }

            const instanceName = instance.name || ""
            const instanceType = this.getInstanceType(instanceName)
            const uiName = this.getInstanceUIName(instanceName)
            const statusName = document.querySelector('.server-status-name')

            if (statusName) {
                statusName.innerHTML = this.escapeHtml(uiName)
            }

            if (instance.status) {
                setStatus(instance.status)
            }

            setBackgroundAnimated(undefined, undefined, instanceType)

            await this.loadNewsAndTikTok(instanceType || "cobblemon")
        })

        const tabButtons = document.querySelectorAll(".tab-btn")
        const newsContainer = document.getElementById("news-content")
        const tiktokContainer = document.getElementById("tiktok-content")

        tabButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                tabButtons.forEach(b => b.classList.remove("active"))
                btn.classList.add("active")

                const tab = btn.dataset.tab

                if (tab === "news") {
                    if (newsContainer) newsContainer.style.display = "block"
                    if (tiktokContainer) tiktokContainer.style.display = "none"
                }

                if (tab === "tiktok") {
                    if (newsContainer) newsContainer.style.display = "none"
                    if (tiktokContainer) tiktokContainer.style.display = "block"
                }
            })
        })

        const tooltip = document.createElement('div')
        tooltip.classList.add('tooltip')
        document.body.appendChild(tooltip)

        function showTooltip(e) {
            const text = e.currentTarget.dataset.tooltip

            if (!text) return

            tooltip.innerText = text
            tooltip.style.opacity = "1"
            tooltip.style.left = "0px"
            tooltip.style.top = "0px"

            const rect = e.currentTarget.getBoundingClientRect()
            const tooltipRect = tooltip.getBoundingClientRect()

            let left = rect.left + rect.width / 2 - tooltipRect.width / 2
            let top = rect.top - tooltipRect.height - 8

            if (left < 4) {
                left = 4
            }

            if (left + tooltipRect.width > window.innerWidth - 4) {
                left = window.innerWidth - tooltipRect.width - 4
            }

            if (top < 4) {
                top = rect.bottom + 8
            }

            tooltip.style.left = left + "px"
            tooltip.style.top = top + "px"
            tooltip.style.transform = "translateY(0)"
        }

        function hideTooltip() {
            tooltip.style.opacity = "0"
            tooltip.style.transform = "translateY(-4px)"
        }

        document.querySelectorAll('[data-tooltip]').forEach(el => {
            el.addEventListener('mouseenter', showTooltip)
            el.addEventListener('mouseleave', hideTooltip)
            el.addEventListener('mousemove', showTooltip)
        })
    }

    initSocials() {
        const socials = document.querySelectorAll('.social-block')

        socials.forEach(social => {
            social.addEventListener('click', () => {
                shell.openExternal(social.dataset.url)
            })
        })
    }

    initPartnerLogos() {
        const logos = [
            {
                id: 'logo-top-left',
                url: 'https://tienda.pokearena.net/'
            },
            {
                id: 'logo-top-right',
                url: 'https://discord.gg/yewwunrTFY'
            }
        ]

        logos.forEach(logo => {
            const elem = document.getElementById(logo.id)

            if (elem) {
                elem.addEventListener('click', () => {
                    shell.openExternal(logo.url)
                })
            }
        })
    }

    async instancesSelect() {
        const configClient = await this.db.readData('configClient')
        const instancesList = await config.getInstanceList()
        const instanceSelect = configClient.instance_selct

        const playBTN = document.querySelector('.play-instance')
        const statusServer = document.querySelector('.status-server')

        if (instanceSelect) {
            const uiName = this.getInstanceUIName(instanceSelect)
            const instanceType = this.getInstanceType(instanceSelect)
            const statusName = document.querySelector('.server-status-name')

            if (statusName) {
                statusName.innerHTML = this.escapeHtml(uiName)
            }

            const instanceInfo = instancesList.find(i => i.name === instanceSelect)

            if (instanceInfo) {
                setStatus(instanceInfo.status)

                const instanceCard = document.querySelector('.instance-card')

                if (instanceCard && instanceInfo.image) {
                    instanceCard.style.backgroundImage = `url("${instanceInfo.image}")`
                }
            }

            setBackgroundAnimated(undefined, undefined, instanceType)
        }

        if (playBTN) {
            playBTN.onclick = () => {
                this.startGame()
            }
        }

        if (statusServer) {
            statusServer.onclick = () => {
                changePanel('instances')
            }
        }
    }

    async startGame() {
        const fs = require('fs')
        const path = require('path')
        const launch = new Launch()

        const configClient = await this.db.readData('configClient')

        console.log("CONFIG CLIENT =>", configClient)

        const instance = await config.getInstanceList()

        console.log("ACCOUNT_SELECTED =>", configClient.account_selected)

        let authenticator = await this.db.readData(
            'accounts',
            configClient.account_selected
        )

        console.log("AUTH OBJECT =>", authenticator)

        if (authenticator && authenticator.meta?.type === 'Xbox') {
            console.log("Refrescando sesión Microsoft antes de iniciar...")

            try {
                const refreshed = await new Microsoft(this.config.client_id).refresh(authenticator)

                if (refreshed.error) {
                    throw new Error("Refresh inválido")
                }

                refreshed.ID = authenticator.ID

                await this.db.updateData(
                    'accounts',
                    refreshed,
                    authenticator.ID
                )

                authenticator = refreshed

                console.log("Sesión refrescada correctamente")
            } catch (err) {
                console.log("Error refrescando sesión:", err)

                const pop = new popup()

                pop.openPopup({
                    title: 'Sesión expirada',
                    content: 'Tu sesión expiró. Inicia sesión nuevamente.',
                    color: 'red',
                    options: true
                })

                changePanel('login')
                return
            }
        }

        if (!configClient.account_selected) {
            const pop = new popup()

            pop.openPopup({
                title: 'Cuenta no seleccionada',
                content: 'Debes iniciar sesión con una cuenta premium para jugar.',
                color: 'red',
                options: true
            })

            changePanel('login')
            return
        }

        if (!authenticator) {
            const pop = new popup()

            pop.openPopup({
                title: 'Cuenta inválida',
                content: 'La cuenta seleccionada no existe. Inicia sesión nuevamente.',
                color: 'red',
                options: true
            })

            changePanel('login')
            return
        }

        if (
            !authenticator.access_token ||
            !authenticator.client_token ||
            !authenticator.uuid ||
            !authenticator.name
        ) {
            const pop = new popup()

            pop.openPopup({
                title: 'Sesión expirada',
                content: 'Tu sesión premium expiró. Inicia sesión nuevamente.',
                color: 'red',
                options: true
            })

            changePanel('login')
            return
        }

        if (authenticator.offline === true) {
            const pop = new popup()

            pop.openPopup({
                title: 'Cuenta no premium',
                content: 'Esta instancia requiere una cuenta premium.',
                color: 'red',
                options: true
            })

            return
        }

        const options = instance.find(i => i.name == configClient.instance_selct)

        if (!options) {
            const pop = new popup()

            pop.openPopup({
                title: 'Instancia no encontrada',
                content: 'No se pudo encontrar la instancia seleccionada.',
                color: 'red',
                options: true
            })

            return
        }

        const playInstanceBTN = document.querySelector('.play-instance')
        const selectInstanceBTN = document.querySelector('.select-instance')
        const infoStartingBOX = document.querySelector('.info-starting-game')
        const infoStarting = document.querySelector(".info-starting-game-text")
        const progressBar = document.querySelector('.progress-bar')
        const downloadPercentage = document.querySelector('.download-percentage')
        const downloadSize = document.querySelector('.download-size')
        const downloadSpeed = document.querySelector('.download-speed')
        const downloadFileName = document.querySelector('.download-file-name')

        const opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 30000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loadder.minecraft_version,
            detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,
            loader: {
                type: options.loadder.loadder_type,
                build: options.loadder.loadder_version,
                enable: options.loadder.loadder_type == 'none' ? false : true
            },
            verify: options.verify,
            ignored: [...options.ignored],
            java: {
                path: configClient.java_config.java_path
            },
            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },
            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }

        ipcRenderer.send('minecraft-launch')

        try {
            const baseDir = path.join(process.env.APPDATA, '.SUH')
            const asmDir = path.join(baseDir, 'libraries', 'org', 'ow2', 'asm', '9.6')
            const asmJar = path.join(baseDir, 'libraries', 'org', 'ow2', 'asm', 'asm-9.6.jar')

            if (fs.existsSync(asmDir)) {
                fs.rmSync(asmDir, {
                    recursive: true,
                    force: true
                })

                console.log('[Launcher]: Eliminada carpeta vieja ASM 9.6')
            }

            if (fs.existsSync(asmJar)) {
                fs.rmSync(asmJar, {
                    force: true
                })

                console.log('[Launcher]: Eliminado archivo asm-9.6.jar')
            }

            const versionsDir = path.join(baseDir, 'versions')

            if (fs.existsSync(versionsDir)) {
                const versions = fs.readdirSync(versionsDir).filter(v => {
                    const jsonFile = path.join(versionsDir, v, `${v}.json`)
                    return fs.existsSync(jsonFile)
                })

                for (const version of versions) {
                    const versionPath = path.join(
                        versionsDir,
                        version,
                        `${version}.json`
                    )

                    try {
                        let json = fs.readFileSync(versionPath, 'utf8')

                        if (json.includes('org.ow2.asm:asm:9.6')) {
                            json = json.replace(
                                /,\s*\{\s*"downloads"[\s\S]+?"org\.ow2\.asm:asm:9\.6"[\s\S]+?\}/,
                                ''
                            )

                            fs.writeFileSync(versionPath, json)

                            console.log(
                                `[Launcher]: Eliminada referencia a ASM 9.6 en ${version}.json`
                            )
                        }
                    } catch (err) {
                        console.warn(
                            `[Launcher]: No se pudo editar ${version}.json:`,
                            err
                        )
                    }
                }
            }
        } catch (err) {
            console.warn(
                '[Launcher]: Error al limpiar ASM 9.6 automáticamente:',
                err
            )
        }

        launch.Launch(opt)

        console.log("AUTH OBJECT =>", authenticator)

        if (playInstanceBTN) {
            playInstanceBTN.style.display = "none"
        }

        if (selectInstanceBTN) {
            selectInstanceBTN.style.display = "none"
        }

        if (infoStartingBOX) {
            infoStartingBOX.style.display = "block"
        }

        if (progressBar) {
            progressBar.style.display = ""
            progressBar.value = 0
            progressBar.max = 100
        }

        launch.on('progress', (downloaded, total) => {
            const safeDownloaded = Number(downloaded) || 0
            const safeTotal = Number(total) || 0

            const percent = safeTotal > 0
                ? (safeDownloaded / safeTotal) * 100
                : 0

            const clean = Math.min(
                Math.max(percent, 0),
                100
            )

            const downloadedMB = safeDownloaded / 1024 / 1024
            const totalMB = safeTotal / 1024 / 1024

            if (infoStarting) {
                infoStarting.innerHTML = 'Descargando...'
            }

            if (downloadPercentage) {
                downloadPercentage.textContent = `${clean.toFixed(0)}%`
            }

            if (downloadSize) {
                downloadSize.textContent =
                    `${downloadedMB.toFixed(2)} MB / ${totalMB.toFixed(2)} MB`
            }

            if (progressBar) {
                progressBar.value = clean
            }

            ipcRenderer.send('main-window-progress', {
                progress: safeDownloaded,
                size: safeTotal > 0 ? safeTotal : 1
            })
        })

        launch.on('extract', file => {
            if (infoStarting) {
                infoStarting.innerHTML = 'Verificando archivos...'
            }

            if (downloadFileName && file) {
                downloadFileName.textContent = file
            }
        })

        launch.on('estimated', time => {
            const hours = Math.floor(time / 3600)
            const minutes = Math.floor((time - hours * 3600) / 60)
            const seconds = Math.floor(
                time - hours * 3600 - minutes * 60
            )

            console.log(`${hours}h ${minutes}m ${seconds}s`)
        })

        launch.on('speed', speed => {
            const safeSpeed = Number(speed) || 0
            const speedMB = safeSpeed / 1024 / 1024

            if (downloadSpeed) {
                downloadSpeed.textContent =
                    `${speedMB.toFixed(2)} MB/s`
            }

            console.log(`${speedMB.toFixed(2)} MB/s`)
        })

        launch.on('patch', patch => {
            console.log(patch)

            ipcRenderer.send('main-window-progress-load')

            if (infoStarting) {
                infoStarting.innerHTML = 'Configurando el juego...'
            }
        })

        launch.on('data', e => {
            ipcRenderer.send('main-window-progress-reset')

            if (progressBar) {
                progressBar.style.display = "none"
            }

            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-hide")
            }

            new logger('Minecraft', '#36b030')

            ipcRenderer.send('main-window-progress-load')

            if (infoStarting) {
                infoStarting.innerHTML = 'Ejecutando...'
            }

            console.log(e)
        })

        launch.on('close', code => {
            ipcRenderer.send('force-exit')
            return
        })

        launch.on('error', err => {
            const popupError = new popup()

            popupError.openPopup({
                title: 'Error',
                content: err.error,
                color: 'red',
                options: true
            })

            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            }

            ipcRenderer.send('main-window-progress-reset')

            if (infoStartingBOX) {
                infoStartingBOX.style.display = "none"
            }

            if (playInstanceBTN) {
                playInstanceBTN.style.display = "flex"
            }

            if (infoStarting) {
                infoStarting.innerHTML = 'Verificación'
            }

            new logger(pkg.name, '#7289da')

            console.log(err)
        })
    }

    async loadAccounts() {
        try {
            const accounts = await this.db.readData('accounts')

            if (!accounts) return

            const configClient = await this.db.readData('configClient')

            if (!configClient.account_selected) return

            const account = await this.db.readData(
                'accounts',
                configClient.account_selected
            )

            if (account) {
                await this.updatePlayerHead(account)
            }
        } catch (err) {
            console.error("Error cargando cuentas:", err)
        }
    }

    async updateAccountStatus() {
        const configClient = await this.db.readData('configClient')

        if (!configClient.account_selected) return

        const account = await this.db.readData(
            'accounts',
            configClient.account_selected
        )

        if (!account) return

        const topTitle = document.querySelector('.account-status h4')
        const topText = document.querySelector('.account-status p')
        const crown = document.querySelector('.crown')
        const cardText = document.querySelector('.premium-text')
        const playerName = document.querySelector('.account-card h2')

        if (playerName) {
            playerName.textContent = account.name || "Jugador"
        }

        const isPremium = account.meta?.type === "Xbox"

        if (isPremium) {
            if (crown) {
                crown.textContent = "★"
                crown.style.color = "#ffd54a"
            }

            if (topTitle) {
                topTitle.textContent = "Cuenta Activa"
            }

            if (topText) {
                topText.textContent = "Premium"
                topText.style.color = "#39ff70"
            }

            if (cardText) {
                cardText.textContent = "Premium"
                cardText.style.color = "#39ff70"
            }
        } else {
            if (crown) {
                crown.textContent = "★"
                crown.style.color = "#777"
            }

            if (topTitle) {
                topTitle.textContent = "Cuenta Activa"
            }

            if (topText) {
                topText.textContent = "No Premium"
                topText.style.color = "#ff4d4d"
            }

            if (cardText) {
                cardText.textContent = "No Premium"
                cardText.style.color = "#ff4d4d"
            }
        }

        await this.updatePlayerHead(account)
    }

    async updateServerPlayers() {
        try {
            const response = await fetch(
                'https://api.mcstatus.io/v2/status/java/play.pokearena.net'
            )

            const data = await response.json()
            const online = data.players ? data.players.online : 0

            const counter = document.getElementById("online-count")

            if (counter) {
                counter.textContent = online
            }

            const playerCount = document.querySelector(".player-count")

            if (playerCount) {
                const max = data.players?.max || 0
                playerCount.textContent = `${online}/${max}`
            }
        } catch (err) {
            console.error(
                "Error obteniendo jugadores online:",
                err
            )

            const counter = document.getElementById("online-count")

            if (counter) {
                counter.textContent = 0
            }

            const playerCount = document.querySelector(".player-count")

            if (playerCount) {
                playerCount.textContent = "0/0"
            }
        }
    }

    async loadNewsAndTikTok(instanceType = "cobblemon") {
        try {
            const newsResponse = await fetch(
                'https://web.stellarmc.pro/news/api.php?category=general&limit=4'
            )

            if (!newsResponse.ok) {
                throw new Error(`HTTP ${newsResponse.status}`)
            }

            const newsData = await newsResponse.json()

            const featuredContainer = document.getElementById("home-featured-news")
            const latestContainer = document.getElementById("home-latest-news")
            const newsContainer = document.getElementById("news-content")
            const tiktokContainer = document.getElementById("tiktok-content")

            if (featuredContainer && latestContainer) {
                featuredContainer.innerHTML = ""
                latestContainer.innerHTML = ""

                const news = Array.isArray(newsData.news)
                    ? newsData.news
                    : []

                if (news.length > 0) {
                    const first = news[0]
                    const firstTitle = this.getNewsTitle(first)
                    const firstDescription = this.getNewsDescription(first)
                    const firstImage = first.image || 'https://web.stellarmc.pro/img/fondofinalPA.png'
                    const firstDate = this.getNewsDate(first.date)

                    featuredContainer.innerHTML = `
                        <div class="featured-image-box">
                            <img
                                class="featured-image"
                                src="${this.escapeAttribute(firstImage)}"
                                alt="${this.escapeAttribute(firstTitle)}"
                            >
                        </div>
                        <div class="featured-content">
                            <span class="featured-category">
                                ${this.escapeHtml(String(first.category || "DISCORD").toUpperCase())}
                            </span>
                            <h2>${this.escapeHtml(firstTitle)}</h2>
                            <p>${this.escapeHtml(firstDescription)}</p>
                            <span class="featured-date">
                                ${this.escapeHtml(firstDate)}
                            </span>
                        </div>
                    `

                    featuredContainer.style.cursor = "pointer"
                    featuredContainer.dataset.newsId = first.id || ""

                    featuredContainer.onclick = () => {
                        this.openHomeNews(first)
                    }

                    news.slice(1, 4).forEach(item => {
                        const title = this.getNewsTitle(item)
                        const description = this.getNewsDescription(item)
                        const image = item.image || 'https://web.stellarmc.pro/img/fondofinalPA.png'
                        const date = this.getNewsDate(item.date)

                        const card = document.createElement("div")

                        card.classList.add("latest-card")
                        card.style.cursor = "pointer"

                        if (item.id) {
                            card.dataset.newsId = item.id
                        }

                        card.innerHTML = `
                            <img
                                src="${this.escapeAttribute(image)}"
                                alt="${this.escapeAttribute(title)}"
                            >
                            <div class="latest-content">
                                <h3>${this.escapeHtml(title)}</h3>
                                <p>${this.escapeHtml(description)}</p>
                                <span class="latest-date">
                                    ${this.escapeHtml(date)}
                                </span>
                            </div>
                        `

                        card.addEventListener("click", () => {
                            this.openHomeNews(item)
                        })

                        latestContainer.appendChild(card)
                    })
                } else {
                    featuredContainer.innerHTML = `
                        <div class="featured-content">
                            <h2>No hay novedades</h2>
                            <p>No hay noticias disponibles actualmente.</p>
                        </div>
                    `
                }
            }

            if (newsContainer && tiktokContainer) {
                newsContainer.innerHTML = ""
                tiktokContainer.innerHTML = ""

                const legacyNews = Array.isArray(newsData.news)
                    ? newsData.news
                    : []

                if (legacyNews.length > 0) {
                    legacyNews.slice(0, 5).forEach(item => {
                        const div = document.createElement("div")

                        div.classList.add("news-item")

                        const title = this.getNewsTitle(item)
                        const description = this.getNewsDescription(item)
                        const date = this.getNewsDate(item.date)
                        const avatar = item.author?.avatar || ""

                        if (item.id) {
                            div.dataset.newsId = item.id
                        }

                        div.innerHTML = `
                            <div style="display:flex;align-items:center;gap:10px;">
                                ${
                                    avatar
                                        ? `<img src="${this.escapeAttribute(avatar)}" style="width:40px;height:40px;border-radius:50%;">`
                                        : ""
                                }
                                <div>
                                    <div class="news-item-title">
                                        ${this.escapeHtml(item.author?.name || "Discord")}
                                    </div>
                                    <div class="news-item-sub">
                                        ${this.escapeHtml(date)}
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top:10px;">
                                ${this.escapeHtml(description)}
                            </div>
                        `

                        if (item.url) {
                            div.style.cursor = "pointer"

                            div.addEventListener("click", () => {
                                shell.openExternal(item.url)
                            })
                        }

                        newsContainer.appendChild(div)
                    })
                } else {
                    newsContainer.innerHTML = `<p>No hay novedades.</p>`
                }

                try {
                    const tiktokResponse = await fetch(
                        'https://web.stellarmc.pro/news/api.php?category=tiktok&limit=1'
                    )

                    if (tiktokResponse.ok) {
                        const tiktokData = await tiktokResponse.json()

                        const tiktokNews = Array.isArray(tiktokData.news)
                            ? tiktokData.news
                            : []

                        if (tiktokNews.length > 0) {
                            const tiktok = tiktokNews[0]
                            const div = document.createElement("div")

                            div.classList.add("news-item")

                            div.innerHTML = `
                                <div class="news-item-title">
                                    Último TikTok
                                </div>
                                <div class="news-item-sub">
                                    Haz click para verlo
                                </div>
                                ${
                                    tiktok.image
                                        ? `<img src="${this.escapeAttribute(tiktok.image)}" alt="Miniatura TikTok" style="width:200px;max-width:100%;height:auto;border-radius:10px;margin-top:10px;">`
                                        : ""
                                }
                            `

                            div.style.cursor = "pointer"

                            div.addEventListener("click", () => {
                                if (tiktok.content) {
                                    shell.openExternal(tiktok.content)
                                    return
                                }

                                if (tiktok.url) {
                                    shell.openExternal(tiktok.url)
                                }
                            })

                            tiktokContainer.appendChild(div)
                        } else {
                            tiktokContainer.innerHTML = `<p>No hay TikTok reciente.</p>`
                        }
                    } else {
                        tiktokContainer.innerHTML = `<p>No hay TikTok reciente.</p>`
                    }
                } catch (error) {
                    console.error(
                        "Error cargando TikTok:",
                        error
                    )

                    tiktokContainer.innerHTML = `<p>No hay TikTok reciente.</p>`
                }

                const tabButtons = document.querySelectorAll(".tab-btn")

                tabButtons.forEach(b => {
                    b.classList.remove("active")
                })

                const defaultTab = document.querySelector('[data-tab="news"]')

                if (defaultTab) {
                    defaultTab.classList.add("active")
                }

                newsContainer.style.display = "block"
                tiktokContainer.style.display = "none"
            }
        } catch (err) {
            console.error(
                "Error cargando novedades:",
                err
            )

            const featuredContainer = document.getElementById("home-featured-news")
            const latestContainer = document.getElementById("home-latest-news")

            if (featuredContainer) {
                featuredContainer.innerHTML = `
                    <div class="featured-content">
                        <h2>No se pudieron cargar las noticias</h2>
                        <p>Inténtalo nuevamente más tarde.</p>
                    </div>
                `
            }

            if (latestContainer) {
                latestContainer.innerHTML = ""
            }
        }
    }

    getNewsTitle(news) {
        if (!news) return "Nueva publicación"

        const content = String(news.content || "").trim()

        if (!content) {
            return news.author?.name || "Nueva publicación"
        }

        const lines = content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)

        if (!lines.length) {
            return news.author?.name || "Nueva publicación"
        }

        let title = lines[0]

        title = title
            .replace(/^#+\s*/, "")
            .replace(/\*\*/g, "")
            .replace(/__/g, "")
            .trim()

        if (title.length > 80) {
            title = `${title.substring(0, 77)}...`
        }

        return title
    }

    getNewsDescription(news) {
        if (!news) return ""

        const content = String(news.content || "").trim()

        if (!content) {
            return ""
        }

        const lines = content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)

        if (lines.length <= 1) {
            return content.length > 140
                ? `${content.substring(0, 137)}...`
                : content
        }

        let description = lines.slice(1).join(" ")

        description = description
            .replace(/\*\*/g, "")
            .replace(/__/g, "")
            .trim()

        if (description.length > 180) {
            description = `${description.substring(0, 177)}...`
        }

        return description
    }

    getNewsDate(dateValue) {
        if (!dateValue) {
            return ""
        }

        const date = new Date(dateValue)

        if (Number.isNaN(date.getTime())) {
            return ""
        }

        const months = [
            "Enero",
            "Febrero",
            "Marzo",
            "Abril",
            "Mayo",
            "Junio",
            "Julio",
            "Agosto",
            "Septiembre",
            "Octubre",
            "Noviembre",
            "Diciembre"
        ]

        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
    }

    openHomeNews(news) {
        if (!news) return

        changePanel('news')

        setTimeout(() => {
            const newsPanel = document.querySelector('.panel.news')

            if (!newsPanel) return

            let target = null

            if (news.id) {
                target = Array.from(
                    newsPanel.querySelectorAll('[data-news-id]')
                ).find(element => element.dataset.newsId === String(news.id))
            }

            if (!target) {
                target = newsPanel.querySelector('.news-card')
            }

            if (target) {
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                })

                target.classList.add("home-news-focus")

                setTimeout(() => {
                    target.classList.remove("home-news-focus")
                }, 1200)
            }
        }, 350)
    }

    escapeHtml(value = "") {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    escapeAttribute(value = "") {
        return this.escapeHtml(value)
    }

    getdate(e) {
        const date = new Date(e)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const day = date.getDate()

        const allMonth = [
            'Enero',
            'Febrero',
            'Marzo',
            'Abril',
            'Mayo',
            'Junio',
            'Julio',
            'Agosto',
            'Septiembre',
            'Octubre',
            'Noviembre',
            'Diciembre'
        ]

        return {
            year: year,
            month: allMonth[month - 1],
            day: day
        }
    }

    async updatePlayerHead(account) {
        const playerHead = document.querySelector('.player-head')
        const skinViewer = document.getElementById('skin-viewer')

        if (!playerHead || !skinViewer) return

        let skinName = "Steve"

        if (
            account &&
            account.meta?.type === "Xbox" &&
            account.name
        ) {
            skinName = account.name
        }

        const skinUrl = `https://render.crafty.gg/3d/bust/${encodeURIComponent(skinName)}`

        skinViewer.src = skinUrl
    }
}

export default Home;