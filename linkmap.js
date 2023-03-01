// linkmap.js

class LinkMap {
    map = null
    startUrl = null
    static STATUS_NOT_FETCHED    = 0
    static STATUS_NOT_FOUND      = -1
    static STATUS_FETCHED        = 1
    static STATUS_NON_TEXT       = 2

    constructor(startUrl) {
        this.map = new Map()
        if (startUrl) {
            this.startUrl = startUrl
            this.addUrl(startUrl)
        }
    }
    addUrl = url => {
        if (!this.map.has(url)) 
            this.map.set(
                url,
                {
                    linkText: [],
                    referrer: [],
                    status: this.constructor.STATUS_NOT_FETCHED
                }
            )
        if (!this.startUrl) this.startUrl = url
    }
    get = url => {
        if (!url) return
        return this.map.has(url) ? this.map.get(url) : undefined
    }
    getAll = () => {
        return this.map ? this.map : new Map()
    }
    getStatusForUrl = url => {
        if (!url || !this.map) return
        const _url = this.get(url)
        if (!_url) return
        const { status } = _url
        return typeof status !== 'undefined' ? status : undefined
    }
    addLinkText = (url, text) => {
        this.#process('linkText', url, text)
    }
    addReferrer = (url, referrer) => {
        this.#process('referrer', url, referrer)
    }
    setStatus = (url, val) => {
        // val = val && !isNaN(parseInt(val)) ? parseInt(val) : null
        val = isNaN(parseInt(val)) ? null : val
        if (!val) return
        this.#process('status', url, val)
    }
    getLinksByStatusCode = code => {
        code = isNaN(parseInt(code)) ? null : code
        // code = code && !isNaN(parseInt(code)) ? parseInt(code) : null
        if (    code === null
            ||  ![
                    this.constructor.STATUS_NOT_FETCHED,
                    this.constructor.STATUS_NOT_FOUND,
                    this.constructor.STATUS_FETCHED,
                    this.constructor.STATUS_NON_TEXT
                ].includes(code)
            ||  !this.map.size
        ) return
        return Array.from(this.map.keys())
            .filter(url => this.map.get(url).status === code)
    }
    #process = (type, url, detail) => {
        type = (type==='linkText' || type==='referrer' || type==='status') ? type : false
        url = url || false
        detail = detail || false
        if (!type || !url || !detail) return
        this.addUrl(url)
        let obj = this.map.get(url) || {}
        let {linkText=[], referrer=[], status=0} = obj
        if (type==='linkText') if (!linkText.includes(detail)) linkText.push(detail)
        if (type==='referrer') if (!referrer.includes(detail)) referrer.push(detail)
        if (type==='status') {
            obj.status = detail
            this.map.set(url, obj)
        }
    }
    dump = () => {
        console.log(require('util').inspect(this.map, { showHidden: true, depth: null }))
    }
}

exports.LinkMap = LinkMap