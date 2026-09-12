import { changePanel, accountSelect, database, Slider, config, setStatus, popup, appdata } from '../utils.js'
const { shell } = require('electron')
const os = require('os')

class Settings {
    static id = "settings"

    async init(config) {
        this.config = config
        this.db = new database()
        this.navBTN()
        this.sidebar()
        this.accounts()
        this.ram()
        this.resolution()
        this.launcher()
    }

    sidebar() {
        const sidebarButtons = document.querySelectorAll('[data-settings-target]')

        sidebarButtons.forEach(button => {
            button.addEventListener('click', () => {
                const target = button.dataset.settingsTarget

                if (target === 'settings') return

                const panels = {
                    play: 'home',
                    instances: 'instances',
                    store: 'store',
                    news: 'news'
                }

                if (panels[target]) {
                    changePanel(panels[target])
                }
            })
        })
    }

    navBTN() {
        const navigation = document.querySelector('.settings-navigation')

        if (!navigation) return

        navigation.addEventListener('click', e => {
            const button = e.target.closest('.settings-nav-item')

            if (!button) return

            const id = button.id

            if (id === 'save') {
                this.setActiveTab('account')
                changePanel('home')
                return
            }

            const tab = document.querySelector(`#${id}-tab`)

            if (!tab) return

            this.setActiveTab(id)
        })
    }

    setActiveTab(id) {
        document.querySelectorAll('.settings-nav-item').forEach(button => {
            button.classList.remove('active')
        })

        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active-settings-tab')
        })

        const button = document.querySelector(`#${id}`)
        const tab = document.querySelector(`#${id}-tab`)

        if (button) button.classList.add('active')
        if (tab) tab.classList.add('active-settings-tab')
    }

    accounts() {
        const accountsList = document.querySelector('.accounts-list')

        if (!accountsList) return

        accountsList.addEventListener('click', async e => {
            const accountElement = e.target.closest('.account')
            const deleteButton = e.target.closest('.delete-profile')

            if (!accountElement) return

            const id = accountElement.id
            const popupAccount = new popup()

            try {
                if (deleteButton) {
                    popupAccount.openPopup({
                        title: 'Confirmar',
                        content: 'Cargando...',
                        color: 'var(--color)'
                    })

                    await this.db.deleteData('accounts', id)

                    const deleteProfile = document.getElementById(id)

                    if (deleteProfile) {
                        deleteProfile.remove()
                    }

                    if (accountsList.children.length === 1) {
                        return changePanel('login')
                    }

                    const configClient = await this.db.readData('configClient')

                    if (configClient.account_selected == id) {
                        const allAccounts = await this.db.readAllData('accounts')

                        if (!allAccounts.length) {
                            return changePanel('login')
                        }

                        const newAccount = allAccounts[0]

                        configClient.account_selected = newAccount.ID

                        await accountSelect(newAccount)

                        const newInstanceSelect = await this.setInstance(newAccount)

                        configClient.instance_selct = newInstanceSelect.instance_selct

                        await this.db.updateData('configClient', configClient)
                    }

                    return
                }

                if (accountElement.id === 'add') {
                    popupAccount.openPopup({
                        title: 'Iniciando',
                        content: 'Cargando...',
                        color: 'var(--color)'
                    })

                    document.querySelector('.cancel-home').style.display = 'inline'

                    return changePanel('login')
                }

                popupAccount.openPopup({
                    title: 'Iniciando',
                    content: 'Cargando...',
                    color: 'var(--color)'
                })

                const account = await this.db.readData('accounts', id)

                if (!account) return

                const configClient = await this.setInstance(account)

                await accountSelect(account)

                configClient.account_selected = account.ID

                await this.db.updateData('configClient', configClient)
            } catch (err) {
                console.error(err)
            } finally {
                popupAccount.closePopup()
            }
        })
    }

    async setInstance(auth) {
        const configClient = await this.db.readData('configClient')
        const instanceSelect = configClient.instance_selct
        const instancesList = await config.getInstanceList()

        for (const instance of instancesList) {
            if (!instance.whitelistActive) continue

            const whitelist = instance.whitelist || []
            const allowed = whitelist.includes(auth.name)

            if (!allowed && instance.name === instanceSelect) {
                const newInstanceSelect = instancesList.find(i => i.whitelistActive === false)

                if (newInstanceSelect) {
                    configClient.instance_selct = newInstanceSelect.name
                    await setStatus(newInstanceSelect.status)
                }
            }
        }

        return configClient
    }

    async ram() {
        const configClient = await this.db.readData('configClient')
        const totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10
        const ramInfoBlock = document.querySelector('.ram-info-block')
        const sliderDiv = document.querySelector('.memory-slider')

        let ram = configClient?.java_config?.java_memory
            ? {
                ramMin: configClient.java_config.java_memory.min,
                ramMax: configClient.java_config.java_memory.max
            }
            : {
                ramMin: 1,
                ramMax: 2
            }

        if (totalMem < ram.ramMin) {
            configClient.java_config.java_memory = {
                min: 1,
                max: 2
            }

            await this.db.updateData('configClient', configClient)

            ram = {
                ramMin: 1,
                ramMax: 2
            }
        }

        if (sliderDiv) {
            sliderDiv.setAttribute('max', Math.trunc(80 * totalMem / 100))
        }

        const slider = new Slider(
            '.memory-slider',
            parseFloat(ram.ramMin),
            parseFloat(ram.ramMax)
        )

        const updateInfo = (min, max) => {
            if (!ramInfoBlock) return

            ramInfoBlock.innerHTML = `
                <b>Tienes <span>${totalMem}</span> GB de RAM total.</b><br>
                Estás usando desde <span>${min}</span> GB hasta <span>${max}</span> GB.
            `
        }

        updateInfo(ram.ramMin, ram.ramMax)

        slider.on('change', async (min, max) => {
            const currentConfig = await this.db.readData('configClient')

            updateInfo(min, max)

            currentConfig.java_config.java_memory = {
                min,
                max
            }

            await this.db.updateData('configClient', currentConfig)
        })
    }

    async resolution() {
        const configClient = await this.db.readData('configClient')

        const resolution = configClient?.game_config?.screen_size || {
            width: 1920,
            height: 1080
        }

        const width = document.querySelector('.width-size')
        const height = document.querySelector('.height-size')
        const resolutionReset = document.querySelector('.size-reset')

        if (width) width.value = resolution.width
        if (height) height.value = resolution.height

        if (width) {
            width.addEventListener('change', async () => {
                const currentConfig = await this.db.readData('configClient')

                currentConfig.game_config.screen_size.width = width.value

                await this.db.updateData('configClient', currentConfig)
            })
        }

        if (height) {
            height.addEventListener('change', async () => {
                const currentConfig = await this.db.readData('configClient')

                currentConfig.game_config.screen_size.height = height.value

                await this.db.updateData('configClient', currentConfig)
            })
        }

        if (resolutionReset) {
            resolutionReset.addEventListener('click', async () => {
                const currentConfig = await this.db.readData('configClient')

                currentConfig.game_config.screen_size = {
                    width: '854',
                    height: '480'
                }

                if (width) width.value = '854'
                if (height) height.value = '480'

                await this.db.updateData('configClient', currentConfig)
            })
        }

        const openModsBtn = document.querySelector('.open-mods-btn')

        if (openModsBtn) {
            openModsBtn.addEventListener('click', async () => {
                const pathMods = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/instances`
                await shell.openPath(pathMods)
            })
        }
    }

    async launcher() {
        const configClient = await this.db.readData('configClient')

        const maxDownloadFiles = configClient?.launcher_config?.download_multi || 100
        const maxDownloadFilesInput = document.querySelector('.max-files')
        const maxDownloadFilesReset = document.querySelector('.max-files-reset')

        if (maxDownloadFilesInput) {
            maxDownloadFilesInput.value = maxDownloadFiles

            maxDownloadFilesInput.addEventListener('change', async () => {
                const currentConfig = await this.db.readData('configClient')

                currentConfig.launcher_config.download_multi = maxDownloadFilesInput.value

                await this.db.updateData('configClient', currentConfig)
            })
        }

        if (maxDownloadFilesReset) {
            maxDownloadFilesReset.addEventListener('click', async () => {
                const currentConfig = await this.db.readData('configClient')

                if (maxDownloadFilesInput) {
                    maxDownloadFilesInput.value = 100
                }

                currentConfig.launcher_config.download_multi = 100

                await this.db.updateData('configClient', currentConfig)
            })
        }
    }
}

export default Settings