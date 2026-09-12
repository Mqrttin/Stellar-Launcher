import { changePanel } from '../utils.js'

class News {

    constructor() {
        this.news = []
        this.currentCategory = 'all'
        this.elements = {}
        this.refreshInterval = null
        this.apiUrl = 'https://web.stellarmc.pro/news/api.php'
        this.defaultImage = 'https://web.stellarmc.pro/img/fondofinalPA.png'
        this.currentModalItem = null
    }

    async init(config) {
        this.config = config
        this.cacheElements()

        if (!this.elements.panel) {
            console.error('News: no se encontró .news-page')
            return
        }

        this.bindEvents()
        this.bindNavigation()
        this.bindModal()

        await this.loadNews()

        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }

        this.refreshInterval = setInterval(() => {
            this.loadNews(true)
        }, 300000)
    }

    cacheElements() {
        this.elements.panel = document.querySelector('.news-page')

        if (!this.elements.panel) {
            return
        }

        this.elements.featured = this.elements.panel.querySelector('#news-featured')
        this.elements.grid = this.elements.panel.querySelector('#news-grid')
        this.elements.count = this.elements.panel.querySelector('#news-count')
        this.elements.results = this.elements.panel.querySelector('#news-results')
        this.elements.filters = this.elements.panel.querySelectorAll('.news-filter')
        this.elements.modal = this.elements.panel.querySelector('#news-modal')
        this.elements.modalImage = this.elements.panel.querySelector('#news-modal-image')
        this.elements.modalCategory = this.elements.panel.querySelector('#news-modal-category')
        this.elements.modalDate = this.elements.panel.querySelector('#news-modal-date')
        this.elements.modalTitle = this.elements.panel.querySelector('#news-modal-title')
        this.elements.modalAvatar = this.elements.panel.querySelector('#news-modal-avatar')
        this.elements.modalAvatarPlaceholder = this.elements.panel.querySelector('#news-modal-avatar-placeholder')
        this.elements.modalAuthor = this.elements.panel.querySelector('#news-modal-author')
        this.elements.modalRole = this.elements.panel.querySelector('#news-modal-role')
        this.elements.modalBody = this.elements.panel.querySelector('#news-modal-body')
    }

    bindEvents() {
        this.elements.filters?.forEach(button => {
            button.addEventListener('click', () => {
                this.setCategory(button.dataset.category || 'all')
            })
        })
    }

    bindNavigation() {
        this.elements.panel?.querySelectorAll('[data-news-target]').forEach(button => {
            button.addEventListener('click', async () => {
                const target = button.dataset.newsTarget

                if (target === 'news') {
                    return
                }

                if (target === 'play') {
                    this.closeModal()
                    changePanel('home')
                    return
                }

                if (target === 'instances') {
                    this.closeModal()
                    changePanel('instances')
                    return
                }

                if (target === 'store') {
                    const element = document.getElementById('nav-store')

                    if (element) {
                        element.click()
                    }

                    return
                }

                if (target === 'settings') {
                    document.querySelector('.home .settings-btn')?.click()
                }
            })
        })
    }

    bindModal() {
        this.elements.panel?.querySelectorAll('[data-news-modal-close]').forEach(element => {
            element.addEventListener('click', () => {
                this.closeModal()
            })
        })

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                this.closeModal()
            }
        })
    }

    escapeHTML(value) {
        const div = document.createElement('div')
        div.textContent = String(value ?? '')
        return div.innerHTML
    }

    normalizeContent(value) {
        if (!value) {
            return ''
        }

        return String(value)
            .replace(/<@!?\d+>/g, '')
            .replace(/<@&\d+>/g, '')
            .replace(/<#\d+>/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/\r/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    }

    getCategoryName(category) {
        const names = {
            general: 'Discord',
            tiktok: 'TikTok',
            youtube: 'YouTube',
            cobblemon: 'Cobblemon',
            pixelmon: 'Pixelmon'
        }

        return names[category] || 'Stellar'
    }

    getCategoryIcon(category) {
        const icons = {
            general: `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.54 5.01A16.9 16.9 0 0 0 15.47 3.7l-.5 1.03a15.2 15.2 0 0 0-5.94 0L8.53 3.7a16.9 16.9 0 0 0-4.07 1.31C1.88 8.89 1.18 12.7 1.53 16.46a16.7 16.7 0 0 0 5.02 2.56l1.22-1.67c-.67-.25-1.31-.56-1.91-.92l.47-.36c3.68 1.72 7.67 1.72 11.31 0l.48.36c-.6.36-1.24.67-1.91.92l1.22 1.67a16.7 16.7 0 0 0 5.02-2.56c.41-4.38-.7-8.15-2.91-11.45ZM8.6 14.8c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.9 2.2-2 2.2Zm6.8 0c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.9 2.2-2 2.2Z"/>
                </svg>
            `,

            tiktok: `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 7.12a5.2 5.2 0 0 1-3.02-3.02A5.18 5.18 0 0 1 16.28 2h-3.65v13.7a2.77 2.77 0 1 1-1.9-2.63v-3.7a6.48 6.48 0 1 0 5.49 6.33V8.76a8.75 8.75 0 0 0 5.1 1.63V6.74a5.18 5.18 0 0 1-1.73.38Z"/>
                </svg>
            `,

            youtube: `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.53 3.56 12 3.56 12 3.56s-7.53 0-9.39.51A3 3 0 0 0 .5 6.19 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12c1.86.51 9.39.51 9.39.51s7.53 0 9.39-.51a3 3 0 0 0 2.11-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.81ZM9.55 15.6V8.4L15.82 12l-6.27 3.6Z"/>
                </svg>
            `,

            cobblemon: `
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="m12 2.5 8 4.5v10l-8 4.5L4 17V7l8-4.5Z" stroke="currentColor" stroke-width="1.6"/>
                    <path d="m8 10 4-2 4 2-4 2-4-2Zm0 3 4 2 4-2" stroke="currentColor" stroke-width="1.6"/>
                </svg>
            `,

            pixelmon: `
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 3h10v3h3v8h-3v4h-4v3h-2v-3H7v-4H4V6h3V3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                    <path d="M8 9h3M13 9h3M8 13h3M13 13h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
            `
        }

        return icons[category] || icons.general
    }

    getFirstImage(item) {
        if (item?.image) {
            return item.image
        }

        if (item?.image_url) {
            return item.image_url
        }

        if (Array.isArray(item?.attachments)) {
            for (const attachment of item.attachments) {
                if (!attachment?.url) {
                    continue
                }

                const type = String(attachment.content_type || '').toLowerCase()
                const name = String(attachment.name || '').toLowerCase()

                if (
                    type.startsWith('image/') ||
                    /\.(png|jpg|jpeg|webp|gif)$/i.test(name)
                ) {
                    return attachment.url
                }
            }
        }

        if (Array.isArray(item?.embeds)) {
            for (const embed of item.embeds) {
                if (embed?.image) {
                    if (typeof embed.image === 'string') {
                        return embed.image
                    }

                    if (embed.image?.url) {
                        return embed.image.url
                    }
                }

                if (embed?.thumbnail) {
                    if (typeof embed.thumbnail === 'string') {
                        return embed.thumbnail
                    }

                    if (embed.thumbnail?.url) {
                        return embed.thumbnail.url
                    }
                }
            }
        }

        return this.defaultImage
    }

    getEmbedTitle(item) {
        if (!Array.isArray(item?.embeds)) {
            return ''
        }

        for (const embed of item.embeds) {
            if (embed?.title) {
                return this.normalizeContent(embed.title)
            }
        }

        return ''
    }

    getEmbedDescription(item) {
        if (!Array.isArray(item?.embeds)) {
            return ''
        }

        for (const embed of item.embeds) {
            if (embed?.description) {
                return this.normalizeContent(embed.description)
            }
        }

        return ''
    }

    getSocialUrl(item) {
        if (!item) {
            return ''
        }

        if (Array.isArray(item.embeds)) {
            for (const embed of item.embeds) {
                if (embed?.url) {
                    return String(embed.url)
                }
            }
        }

        if (
            item.content &&
            /^https?:\/\/\S+$/i.test(String(item.content).trim())
        ) {
            return String(item.content).trim()
        }

        return ''
    }

    getAuthor(item) {
        return item?.author?.global_name ||
            item?.author?.display_name ||
            item?.author?.name ||
            item?.author?.username ||
            'Stellar Network'
    }

    getAvatar(item) {
        if (item?.author?.avatar) {
            return item.author.avatar
        }

        if (item?.author?.avatar_url) {
            return item.author.avatar_url
        }

        return ''
    }

    getRole(item) {
        const role = item?.author?.role

        if (!role) {
            return null
        }

        if (typeof role === 'string') {
            return {
                name: role,
                color: ''
            }
        }

        return {
            id: role.id || '',
            name: role.name || '',
            color: role.color || ''
        }
    }

    getRoleClass(role) {
        if (!role?.name) {
            return ''
        }

        return String(role.name).toLowerCase() === 'developer'
            ? 'developer'
            : ''
    }

    getRoleStyle(role) {
        if (!role?.color) {
            return ''
        }

        if (String(role.name).toLowerCase() === 'developer') {
            return ''
        }

        return `color:${this.escapeHTML(role.color)};`
    }

    normalizeNews(item, index) {
        const allowedCategories = [
            'general',
            'tiktok',
            'youtube',
            'cobblemon',
            'pixelmon'
        ]

        const rawCategory = String(
            item?.category || 'general'
        ).toLowerCase()

        const category = allowedCategories.includes(rawCategory)
            ? rawCategory
            : 'general'

        const isSocial = category === 'tiktok' || category === 'youtube'
        const rawContent = String(item?.content || '')

        const content = isSocial
            ? ''
            : this.normalizeContent(rawContent)

        const embedTitle = this.getEmbedTitle(item)
        const embedDescription = this.getEmbedDescription(item)

        let title = ''

        if (isSocial && embedTitle) {
            title = embedTitle
        } else if (embedTitle) {
            title = embedTitle
        } else if (content) {
            const firstLine = content.split('\n')[0].trim()

            if (firstLine.length <= 100) {
                title = firstLine
            }
        }

        if (!title) {
            title = item?.channel_name ||
                this.getCategoryName(category)
        }

        let description = ''

        if (!isSocial) {
            description = embedDescription || content

            if (description === title) {
                description = ''
            }

            if (description.length > 260) {
                description = `${description.slice(0, 257).trim()}...`
            }
        } else if (embedDescription) {
            description = embedDescription

            if (
                description === 'TikTok | Make Your Day' ||
                description === 'YouTube'
            ) {
                description = ''
            }
        }

        const role = this.getRole(item)

        return {
            id: item?.id || `news-${index}`,
            category,
            title,
            description,
            content,
            image: this.getFirstImage(item),
            date: item?.date || '',
            author: this.getAuthor(item),
            avatar: this.getAvatar(item),
            role,
            channel: item?.channel_name || this.getCategoryName(category),
            socialUrl: isSocial ? this.getSocialUrl(item) : ''
        }
    }

    formatDate(date) {
        if (!date) {
            return ''
        }

        const parsed = new Date(date)

        if (Number.isNaN(parsed.getTime())) {
            return ''
        }

        const diff = Math.floor(
            (Date.now() - parsed.getTime()) / 1000
        )

        if (diff < 60) {
            return 'Ahora'
        }

        if (diff < 3600) {
            return `Hace ${Math.floor(diff / 60)} min`
        }

        if (diff < 86400) {
            return `Hace ${Math.floor(diff / 3600)} h`
        }

        if (diff < 604800) {
            return `Hace ${Math.floor(diff / 86400)} d`
        }

        return parsed.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    getFilteredNews() {
        if (this.currentCategory === 'all') {
            return [...this.news]
        }

        return this.news.filter(item => {
            return item.category === this.currentCategory
        })
    }

    getFeatured() {
        const general = this.news.filter(item => {
            return item.category === 'general'
        })

        if (general.length) {
            return general[0]
        }

        return this.news[0] || null
    }

    setCategory(category) {
        this.currentCategory = category || 'all'

        this.elements.filters?.forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.category === this.currentCategory
            )
        })

        this.render()
    }

    setNews(items) {
        this.news = Array.isArray(items)
            ? items
                .map((item, index) => this.normalizeNews(item, index))
                .sort((a, b) => {
                    return new Date(b.date || 0) -
                        new Date(a.date || 0)
                })
            : []

        this.render()
    }

    getAuthorHTML(item, mini = false) {
        const role = item.role

        const roleName = role?.name
            ? String(role.name).toUpperCase()
            : ''

        const roleClass = this.getRoleClass(role)
        const roleStyle = this.getRoleStyle(role)

        const avatar = item.avatar
            ? `<img src="${this.escapeHTML(item.avatar)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
            : ''

        const placeholder = `
            <span class="${mini ? 'mini-avatar' : 'author-placeholder'}" ${avatar ? 'style="display:none"' : ''}>
                ${this.getCategoryIcon(item.category)}
            </span>
        `

        return `
            ${avatar}
            ${placeholder}
            <span class="author-name">
                ${roleName ? `<span class="news-rank ${roleClass}" style="${roleStyle}">${this.escapeHTML(roleName)}</span>` : ''}
                <span>${this.escapeHTML(item.author)}</span>
            </span>
        `
    }

    renderFeatured() {
        const item = this.getFeatured()

        if (!item) {
            this.elements.featured.innerHTML = `
                <div class="news-empty">
                    <div class="news-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M4 5h16v14H4z" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <h3>No hay novedades</h3>
                    <p>Cuando haya publicaciones aparecerán aquí.</p>
                </div>
            `

            return
        }

        const image = item.image || this.defaultImage
        const isSocial = item.category === 'tiktok' || item.category === 'youtube'
        const actionText = isSocial ? 'Ver publicación' : 'Ver anuncio'

        this.elements.featured.innerHTML = `
            <article class="featured-card" data-news-id="${this.escapeHTML(item.id)}">
                <div class="featured-image" style="background-image:url('${this.escapeHTML(image)}')"></div>
                <div class="featured-overlay"></div>

                <div class="featured-content">
                    <div class="featured-top">
                        <span class="featured-category">
                            <span class="category-icon">
                                ${this.getCategoryIcon(item.category)}
                            </span>
                            ${this.escapeHTML(this.getCategoryName(item.category))}
                        </span>

                        <span class="featured-date">
                            ${this.escapeHTML(this.formatDate(item.date))}
                        </span>
                    </div>

                    <div class="featured-main">
                        <span class="featured-label">ÚLTIMA PUBLICACIÓN</span>

                        <h3>${this.escapeHTML(item.title)}</h3>

                        ${item.description ? `
                            <p>${this.escapeHTML(item.description)}</p>
                        ` : ''}
                    </div>

                    <div class="featured-bottom">
                        <div class="news-author">
                            ${this.getAuthorHTML(item)}
                        </div>

                        <button class="news-open" data-news-id="${this.escapeHTML(item.id)}">
                            ${actionText}

                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </article>
        `

        this.bindNewsCards()
    }

    renderGrid() {
        const items = this.getFilteredNews()

        if (!items.length) {
            this.elements.grid.innerHTML = `
                <div class="news-empty news-empty-grid">
                    <div class="news-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M4 5h16v14H4z" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </div>

                    <h3>Sin publicaciones</h3>
                    <p>No encontramos novedades en esta categoría.</p>
                </div>
            `

            return
        }

        this.elements.grid.innerHTML = items.map(item => {
            const image = item.image || this.defaultImage
            const isSocial = item.category === 'tiktok' || item.category === 'youtube'

            return `
                <article class="news-card" data-news-id="${this.escapeHTML(item.id)}">
                    <div
                        class="news-card-image"
                        style="background-image:url('${this.escapeHTML(image)}')">
                    </div>

                    <div class="news-card-body">
                        <div class="news-card-top">
                            <span class="news-card-category">
                                <span class="card-category-icon">
                                    ${this.getCategoryIcon(item.category)}
                                </span>

                                ${this.escapeHTML(this.getCategoryName(item.category))}
                            </span>

                            <span class="news-card-date">
                                ${this.escapeHTML(this.formatDate(item.date))}
                            </span>
                        </div>

                        <h3>${this.escapeHTML(item.title)}</h3>

                        <p>
                            ${this.escapeHTML(
                                item.description ||
                                (
                                    isSocial
                                        ? `Nueva publicación en ${this.getCategoryName(item.category)}.`
                                        : `Nueva publicación en ${item.channel}.`
                                )
                            )}
                        </p>

                        <div class="news-card-footer">
                            <div class="news-card-author">
                                ${this.getAuthorHTML(item, true)}
                            </div>

                            <button
                                class="news-card-open"
                                data-news-id="${this.escapeHTML(item.id)}"
                                aria-label="Ver publicación">

                                <svg viewBox="0 0 24 24" fill="none">
                                    <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </article>
            `
        }).join('')

        this.bindNewsCards()
    }

    bindNewsCards() {
        this.elements.panel?.querySelectorAll('[data-news-id]').forEach(element => {
            element.addEventListener('click', event => {
                if (
                    event.target.closest('.news-card-open') ||
                    event.target.closest('.news-open')
                ) {
                    event.stopPropagation()
                }

                const id = element.dataset.newsId

                if (!id) {
                    return
                }

                const item = this.news.find(
                    news => String(news.id) === String(id)
                )

                if (item) {
                    this.openModal(item)
                }
            })
        })
    }

    renderModalContent(item) {
        if (!this.elements.modal) {
            return
        }

        const image = item.image || this.defaultImage
        const role = item.role
        const roleName = role?.name
            ? String(role.name).toUpperCase()
            : ''

        const isSocial = item.category === 'tiktok' || item.category === 'youtube'

        this.elements.modalImage.style.backgroundImage =
            `url("${image.replace(/"/g, '%22')}")`

        this.elements.modalCategory.innerHTML = `
            <span class="category-icon">
                ${this.getCategoryIcon(item.category)}
            </span>

            ${this.escapeHTML(this.getCategoryName(item.category))}
        `

        this.elements.modalDate.textContent =
            this.formatDate(item.date)

        this.elements.modalTitle.textContent =
            item.title

        this.elements.modalAuthor.textContent =
            item.author

        this.elements.modalRole.textContent =
            roleName

        this.elements.modalRole.className =
            this.getRoleClass(role)

        if (role && roleName === 'DEVELOPER') {
            this.elements.modalRole.classList.add('developer')
        } else if (role?.color) {
            this.elements.modalRole.style.color = role.color
        }

        if (item.avatar) {
            this.elements.modalAvatar.src = item.avatar
            this.elements.modalAvatar.style.display = 'block'
            this.elements.modalAvatarPlaceholder.style.display = 'none'

            this.elements.modalAvatar.onerror = () => {
                this.elements.modalAvatar.style.display = 'none'
                this.elements.modalAvatarPlaceholder.style.display = 'flex'
            }
        } else {
            this.elements.modalAvatar.style.display = 'none'
            this.elements.modalAvatarPlaceholder.style.display = 'flex'

            this.elements.modalAvatarPlaceholder.innerHTML =
                this.getCategoryIcon(item.category)
        }

        if (isSocial && item.socialUrl) {
            const platform = item.category === 'tiktok'
                ? 'TikTok'
                : 'YouTube'

            this.elements.modalBody.innerHTML = `
                <div class="news-social-content">
                    <p>Disfruta de esta publicación en ${platform}.</p>

                    <button
                        type="button"
                        class="news-social-button"
                        data-social-url="${this.escapeHTML(item.socialUrl)}">

                        Abrir ${platform}

                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            `

            this.elements.modalBody
                .querySelector('.news-social-button')
                ?.addEventListener('click', event => {
                    event.stopPropagation()

                    const url = event.currentTarget.dataset.socialUrl

                    if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer')
                    }
                })

            return
        }

        const content = item.content || item.description || ''

        this.elements.modalBody.innerHTML =
            this.formatModalContent(content)
    }

    formatModalContent(content) {
        if (!content) {
            return '<p>No hay contenido adicional para esta publicación.</p>'
        }

        return String(content)
            .split(/\n{2,}/)
            .map(paragraph => {
                const html = this.escapeHTML(paragraph)
                    .replace(/\n/g, '<br>')

                return `<p>${html}</p>`
            })
            .join('')
    }

    openModal(item) {
        if (!this.elements.modal) {
            return
        }

        this.currentModalItem = item
        this.renderModalContent(item)

        this.elements.modal.classList.add('open')
        this.elements.modal.setAttribute('aria-hidden', 'false')
    }

    closeModal() {
        if (!this.elements.modal) {
            return
        }

        this.elements.modal.classList.remove('open')
        this.elements.modal.setAttribute('aria-hidden', 'true')
        this.currentModalItem = null
    }

    render() {
        if (!this.elements.featured || !this.elements.grid) {
            return
        }

        const filtered = this.getFilteredNews()

        if (this.elements.count) {
            this.elements.count.textContent =
                this.news.length
        }

        if (this.elements.results) {
            this.elements.results.textContent =
                `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}`
        }

        this.renderFeatured()
        this.renderGrid()
    }

    async loadNews(silent = false) {
        try {
            if (!silent && this.elements.grid) {
                this.elements.grid.innerHTML = `
                    <div class="news-loading">
                        <span class="news-spinner"></span>
                        <span>Cargando noticias...</span>
                    </div>
                `
            }

            const response = await fetch(
                `${this.apiUrl}?category=all&limit=100&_=${Date.now()}`,
                {
                    method: 'GET',
                    cache: 'no-store'
                }
            )

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const result = await response.json()

            if (!result || result.success !== true) {
                throw new Error(
                    result?.error || 'Error obteniendo noticias'
                )
            }

            this.setNews(result.news || [])
        } catch (error) {
            console.error('News API:', error)

            if (!silent) {
                this.showError()
            }
        }
    }

    showError() {
        const errorHTML = `
            <div class="news-empty">
                <div class="news-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 8v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <circle cx="12" cy="17" r="1" fill="currentColor"/>
                        <path d="m12 3 9 17H3L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                    </svg>
                </div>

                <h3>No se pudieron cargar las novedades</h3>
                <p>Comprueba tu conexión e inténtalo nuevamente.</p>
            </div>
        `

        if (this.elements.featured) {
            this.elements.featured.innerHTML =
                errorHTML
        }

        if (this.elements.grid) {
            this.elements.grid.innerHTML = `
                <div class="news-empty news-empty-grid">
                    <div class="news-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M12 8v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                            <circle cx="12" cy="17" r="1" fill="currentColor"/>
                            <path d="m12 3 9 17H3L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                    </div>

                    <h3>Error de conexión</h3>
                    <p>No fue posible obtener las últimas publicaciones.</p>
                </div>
            `
        }
    }
}

News.id = 'news'

export default News