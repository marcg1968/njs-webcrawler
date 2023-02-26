#!/usr/bin/env node

const axios = require('axios')
const cheerio = require('cheerio')
const process = require('process')

let baseUrl,
    startUrl = (process.argv.length > 2) ? process.argv[2] : false,
    // debug = false
    debug = (process.argv.length > 3) ? !!(process.argv[3]) : false

const setDebug = (bool) => debug = !!(bool || false)

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

const delay = async (msec) => {
	msec = msec || 1000
	msec = parseInt(msec) || 1000
	if (debug) console.log(`sleeping ${msec}msecs ...`)
	return new Promise(resolve => setTimeout(resolve, msec))
}

const getLinks = async (url, linkmap) => {
    linkmap = (linkmap && linkmap instanceof LinkMap) ? linkmap : false
    if (!linkmap) return
    const { STATUS_NOT_FOUND, STATUS_FETCHED, STATUS_NON_TEXT } = LinkMap
    const referrer = url
	try {
		const pageHTML = await axios.get(url)
        linkmap.addUrl(url)
        linkmap.setStatus(url, STATUS_FETCHED)

        /* set status to 2 if not text */
        let { headers } = pageHTML
        let contentType = headers['content-type'] || headers2['Content-type'] || headers2['Content-Type']
        if (!contentType.toLowerCase().startsWith('text/')) linkmap.setStatus(url, STATUS_NON_TEXT)

		const $ = cheerio.load(pageHTML.data)
		$('a[href]').each((i, e) => {
			let url = $(e).attr('href')
			if (!url || url.startsWith('#')) return
			url = url.replace(/\/+$/, '') // remove trailing /
			url = url.startsWith('http') ? url : `${baseUrl}${url}`
			let linkText = $(e).text() && $(e).text().trim().length ? $(e).text().trim() : url
            linkmap.addUrl(url)
            linkmap.addLinkText(url, linkText)
            linkmap.addReferrer(url, referrer)
		})
	}
	catch (err) {
        if (debug) console.error(57, err.response.status, {url: url})
        linkmap.setStatus(url, STATUS_NOT_FOUND)
        return false
    }
    return true
}

const spider = async (url, linkmap, level) => {
	level = level || 0
	linkmap = (linkmap instanceof LinkMap) ? linkmap : new LinkMap(url)
    const { STATUS_NOT_FETCHED } = LinkMap

    if (url === startUrl && level===0) baseUrl = startUrl.match(/^https?\:\/\/[^/]+/)[0]

    if (debug) console.log(175, 'linkmap', require('util').inspect(linkmap, { showHidden: true, depth: null }))
    if (level===0) console.log(`spidering ${url} ...`)

    level += 1

	let result = await getLinks(url, linkmap)
    // console.log(195, require('util').inspect(linkmap, { showHidden: true, depth: null }))
    // console.log('\n')

    let idx = Array.from(linkmap.getAll().keys()).findIndex(key => key === url) || 0
    outputProgress({url, index:(idx + 1), total: Array.from(linkmap.getAll().keys()).length || 0})

    const getNextUrl = linkmap => 
        Array.from(linkmap.getAll().keys())
            .filter(url => linkmap.getStatusForUrl(url)===STATUS_NOT_FETCHED && url.startsWith(baseUrl))
            .shift()
    if (debug) console.log(190, {getNextUrl: getNextUrl(linkmap)})
    
    let hasMoreUrls = linkmap => 
        Array.from(linkmap.getAll().keys())
            .filter(url => linkmap.getStatusForUrl(url)===STATUS_NOT_FETCHED && url.startsWith(baseUrl))
            .length
    while (hasMoreUrls(linkmap)) {
        const nextUrl = getNextUrl(linkmap)
        if (debug) console.log(119, {hasMoreUrls: hasMoreUrls(linkmap), nextUrl, level})
        if (nextUrl) {
            // await delay()
            ;({ linkmap, level } = await spider(nextUrl, linkmap, level)) // recurse
        }
    }

    if (debug) console.log('exiting... ', {linkmap, level})
    return { linkmap, level }
}

const showReport = linkmap => {
    linkmap = linkmap && linkmap instanceof LinkMap ? linkmap : false
    if (!linkmap) return
    if (debug) console.log(157, {linkmap})
    // console.log(244, 'dump ::'); linkmap.dump()

    const outputListOfLinksOfStatusType = ({linkmap, code=null, hdr=''}) => {
        code = isNaN(parseInt(code)) ? null : parseInt(code)
        if (    code === null
            ||  !linkmap 
            ||  !(linkmap instanceof LinkMap)
            ||  ![
                    LinkMap.STATUS_NOT_FETCHED,
                    LinkMap.STATUS_NOT_FOUND,
                    LinkMap.STATUS_FETCHED,
                    LinkMap.STATUS_NON_TEXT
                ].includes(code)
        ) return
        const links = linkmap.getLinksByStatusCode(code)
        if (!links) return
        const underline = '='.repeat(hdr.length)
        console.log(`\n${underline}\n${hdr}\n${underline}\n`)
        links.forEach(link => console.log(link))
        console.log('')
    }

    outputListOfLinksOfStatusType({linkmap, code: LinkMap.STATUS_NOT_FETCHED, hdr: 'LINKS SKIPPED (EXTERNAL?)'})
    outputListOfLinksOfStatusType({linkmap, code: LinkMap.STATUS_NON_TEXT,    hdr: 'LINKS TO DOWNLOADS OR IMAGES'})
    outputListOfLinksOfStatusType({linkmap, code: LinkMap.STATUS_NOT_FOUND,   hdr: 'BROKEN LINKS'})
    outputListOfLinksOfStatusType({linkmap, code: LinkMap.STATUS_FETCHED,     hdr: 'WORKING LINKS'})

    return
}

const outputProgress = ({url=null, index=0, total=0}) => {
    if (!url) return
    process.stdout.cursorTo(0)
    process.stdout.write(' '.repeat(process.stdout.getWindowSize()[0]))
    process.stdout.cursorTo(0)
    url = (url.length > process.stdout.getWindowSize()[0] - 27)
        ? url.substr(0, 23) + '...'
        : url.padEnd(process.stdout.getWindowSize()[0] - 27, ' ')
    process.stdout.write(
        `processing url: ${url} ${index} of ${total}` 
    )
}

const usage = () => {
    console.log(`Usage: ${process.argv[1]} START_URL [OUTPUT_DEBUG]`)
}

;(async () => {
    if (!startUrl) return usage()
	let { level, linkmap } = await spider(startUrl)
    process.stdout.cursorTo(0)
    process.stdout.write(' '.repeat(process.stdout.getWindowSize()[0]))
    if (debug) console.log(124, {linkmap, level})
    if (level===0) return console.log(`URL ${startUrl} not found`)
    showReport(linkmap)
})()
