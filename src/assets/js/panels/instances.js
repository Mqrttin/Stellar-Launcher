/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, setStatus, setBackgroundAnimated, changePanel } from '../utils.js'

class Instances {
    static id = "instances";

    async init(configJS) {
        this.config = configJS
        this.db = new database()

        this.instances = []
        this.selectedInstanceName = null

        this.rowsElement = document.getElementById('instances-rows')
        this.loadingElement = document.getElementById('instances-loading')
        this.emptyElement = document.getElementById('instances-empty')
        this.backButton = document.getElementById('back-home')

        const navButtons = document.querySelectorAll('.instances .nav-btn')

        navButtons.forEach(button => {
            button.onclick = async () => {
                const id = button.id

                if (id === 'nav-play') {
                    changePanel('home')
                    return
                }

                if (id === 'nav-news') {
                    changePanel('news')
                    return
                }

                if (id === 'nav-instances') {
                    changePanel('instances')
                }
            }
        })

        if (this.backButton) {
            this.backButton.onclick = async () => {
                const panel = document.querySelector('.instances')

                if (panel) {
                    panel.classList.add('panel-exit')
                    await new Promise(resolve => setTimeout(resolve, 220))
                    panel.classList.remove('panel-exit')
                }

                changePanel('home')
            }
        }

        try {
            await this.loadSelectedInstance()
            await this.loadInstances()
        } catch (err) {
            console.error('[Instances] Error al iniciar panel:', err)
            this.showEmpty()
        }
    }

    async loadSelectedInstance() {
        try {
            const configClient = await this.db.readData('configClient')
            this.selectedInstanceName = configClient?.instance_selct || null
        } catch (err) {
            this.selectedInstanceName = null
        }
    }

    async loadInstances() {
        this.showLoading()

        let instancesList = []

        try {
            instancesList = await config.getInstanceList()
        } catch (err) {
            console.error('[Instances] Error obteniendo instancias:', err)
            instancesList = []
        }

        if (!Array.isArray(instancesList) || !instancesList.length) {
            this.showEmpty()
            return
        }

        this.instances = instancesList.sort((a, b) => {
            const nameA = a?.name || ''
            const nameB = b?.name || ''
            return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
        })

        this.render()
    }

    chunkIntoRows(items, size = 4) {
        const rows = []

        for (let i = 0; i < items.length; i += size) {
            rows.push(items.slice(i, i + size))
        }

        return rows
    }

    getServerText(instance) {
        const serverName = instance?.status?.nameServer || ''
        const serverIp = instance?.status?.ip || ''

        if (serverName && serverIp) return `${serverName} • ${serverIp}`
        if (serverName) return serverName
        if (serverIp) return serverIp

        return ''
    }

    isSelected(instance) {
        return instance?.name && instance.name === this.selectedInstanceName
    }

    getInstanceType(instanceName = '') {
        const name = String(instanceName).toLowerCase()

        if (name.includes('cobblemon')) return 'cobblemon'
        if (name.includes('pixelmon')) return 'pixelmon'

        return null
    }

    createCard(instance) {
        const card = document.createElement('button')
        const selected = this.isSelected(instance)

        card.type = 'button'
        card.className = `instance-card${selected ? ' selected' : ''}`
        card.setAttribute('data-instance-name', instance?.name || '')
        card.setAttribute('aria-label', `Seleccionar instancia ${instance?.name || 'Instancia'}`)

        const imageHtml = instance?.image
            ? `<img class="instance-card-image" src="${this.escapeAttribute(instance.image)}" alt="${this.escapeAttribute(instance.name || 'Instancia')}">`
            : `<div class="instance-card-image-fallback">🖼️</div>`

        const serverText = this.getServerText(instance)

        card.innerHTML = `
            <div class="instance-card-image-wrapper">
                ${imageHtml}
                <div class="instance-card-overlay"></div>
            </div>

            <div class="instance-card-body">
                <h2 class="instance-card-title">${this.escapeHtml(instance?.name || 'Instancia')}</h2>

                <div class="instance-card-meta">
                    <div class="instance-card-server">${this.escapeHtml(serverText)}</div>
                </div>

                <div class="instance-card-footer">
                    <span class="instance-card-selected-label">
                        ${selected ? 'Seleccionada' : ''}
                    </span>
                </div>
            </div>
        `

        card.addEventListener('click', () => this.selectInstance(instance))

        return card
    }

    async selectInstance(instance) {
        try {
            if (!instance?.name) return

            const configClient = await this.db.readData('configClient')
            configClient.instance_selct = instance.name
            await this.db.updateData('configClient', configClient)

            this.selectedInstanceName = instance.name

            if (instance.status) {
                setStatus(instance.status)
            }

            const type = this.getInstanceType(instance.name)
            setBackgroundAnimated(undefined, undefined, type)

            this.render()

            document.dispatchEvent(new CustomEvent('instance:selected', {
                detail: { instance }
            }))

            console.log('[Instances] Instancia seleccionada:', instance.name)

            const panel = document.querySelector('.instances')

            if (panel) {
                panel.classList.add('panel-exit')
                await new Promise(resolve => setTimeout(resolve, 220))
                panel.classList.remove('panel-exit')
            }

            changePanel('home')
        } catch (err) {
            console.error('[Instances] Error al seleccionar instancia:', err)
        }
    }

    render() {
        if (!this.rowsElement) return

        this.rowsElement.innerHTML = ''

        const rows = this.chunkIntoRows(this.instances, 4)

        for (const rowItems of rows) {
            const row = document.createElement('div')
            row.className = 'instances-row'

            for (const instance of rowItems) {
                row.appendChild(this.createCard(instance))
            }

            this.rowsElement.appendChild(row)
        }

        this.showRows()
    }

    showLoading() {
        if (this.loadingElement) this.loadingElement.style.display = 'flex'
        if (this.emptyElement) this.emptyElement.style.display = 'none'
        if (this.rowsElement) this.rowsElement.style.display = 'none'
    }

    showEmpty() {
        if (this.loadingElement) this.loadingElement.style.display = 'none'
        if (this.emptyElement) this.emptyElement.style.display = 'flex'
        if (this.rowsElement) this.rowsElement.style.display = 'none'
    }

    showRows() {
        if (this.loadingElement) this.loadingElement.style.display = 'none'
        if (this.emptyElement) this.emptyElement.style.display = 'none'
        if (this.rowsElement) this.rowsElement.style.display = 'flex'
    }

    escapeHtml(value = '') {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;')
    }

    escapeAttribute(value = '') {
        return this.escapeHtml(value)
    }
}

export default Instances;