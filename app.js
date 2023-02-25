#!/usr/bin/env node

const axios = require('axios')
const cheerio = require('cheerio')
const { report } = require('process')
const process = require('process')
const sqlite3 = require('sqlite3')

const db = new sqlite3.Database(':memory:')

let baseUrl,
    startUrl = (process.argv.length > 2) ? process.argv[2] : 'https://soarcorowa.com/links',
    debug = false

const setDebug = (bool) => debug = !!(bool || false)

const delay = async (msec) => {
	msec = msec || 1000
	msec = parseInt(msec) || 1000
	if (debug) console.log(`sleeping ${msec}msecs ...`)
	return new Promise(resolve => setTimeout(resolve, msec))
}

const dbCreate = () => {
    db.run(`
        CREATE TABLE links (
            _id INTEGER PRIMARY KEY NOT NULL,
            url TEXT NOT NULL,
            linkText TEXT,
            modified DATETIME DEFAULT (datetime('now', 'localtime'))
        );
    `)
}

const getLinks = async (url) => {
	let map
    if (debug) console.log(33, `baseUrl = ${baseUrl}`)
	try {
        map = new Map() // url: [ link_text, CODE (-1=error, 0=not fetched, 1=fetched) ]
		const pageHTML = await axios.get(url)

        /* return true if not text */
        let { headers } = pageHTML
        let contentType = headers['content-type'] || headers2['Content-type'] || headers2['Content-Type']
        if (debug) console.log(41, {contentType})
        if (!contentType.toLowerCase().startsWith('text/')) return true

		const $ = cheerio.load(pageHTML.data)

		$('a[href]').each((i, e) => {
			// let _startUrl = startUrl.replace(/\/+$/, '') // remove trailing /
			let url = $(e).attr('href')
			if (!url || url.startsWith('#')) return
			
			url = url.replace(/\/+$/, '') // remove trailing /
			url = url.startsWith('http') ? url : `${baseUrl}${url}`
			let linkText = $(e).text() && $(e).text().trim().length ? $(e).text().trim() : url
			map.set(url, [linkText, 0])
		})
	}
	catch (err) {
        if (debug) console.error(57, err.response.status, {url: url})
        return false
    }
	return map
}

const spider = async (url, map, level) => {
	level = level || 0
	// map = map || new Map()
	map = (map instanceof Map) ? map : new Map() // url: [ link_text, CODE (-1=error, 0=not fetched, 1=fetched) ]

	// if (!url.startsWith(startUrl)) return map
    if (url === startUrl && level===0) map.set(url, ['__START__', 0])
    if (url === startUrl && level===0) baseUrl = startUrl.match(/^https?\:\/\/[^/]+/)[0]

    if (level===0) {
        console.log(`spidering ${url} ...`)
    }

	let _map = await getLinks(url)
    if (!debug) {
        process.stdout.cursorTo(0)
        //process.stdout.write(' '.repeat(80))
        process.stdout.write(' '.repeat(process.stdout.getWindowSize()[0]))
        process.stdout.cursorTo(0)
        let idx = Array.from(map.keys()).findIndex(key => key === url) || 0
        process.stdout.write(
            `processing url: ${url} ${idx + 1} of ${map.size}` 
        )
    }
    if (debug) console.log(49, {
        _map,
        url, 
        //asObj: Object.fromEntries(_map)
    })
    if (_map === false) { // url wasn't able to be fetched by axios
        let item = (map.has(url)) ? map.get(url) : null
        item = item ? [...item.slice(0,1), -1] : ['___', -1]
        map.set(url, item)
        return { map, level }
    }
    if (_map === true) { // url WAS able to be fetched by axios but is not of content-type: text/*
        let item = (map.has(url)) ? map.get(url) : null
        item = item ? [...item.slice(0,1), 2] : ['___', 2]
        map.set(url, item)
        return { map, level }
    }
    if (!_map.size) { // url was gotten but no links found there
        return { map, level }
    }
    if (_map && _map instanceof Map) {
        // url was fetched so mark the url as having been spidered
        let item = (map.has(url)) ? map.get(url) : null
        item = item ? [...item.slice(0,1), 1] : [url, 1]
        map.set(url, item)
        level += 1
        // add to the map any other hitherto unknown links found
        for (let [key, value] of _map) {
            key = key.trim()
            if (map.has(key)) {
                if (debug) console.log(59, `map already has url ${key}`, map.get(key), 'new value:', value)
                /* TODO: handle multiple linkText instances for same url */
                // let _linkText = Array.isArray(map.get(key)) && map.get(key).length > 0
                //     ? map.get(key).shift()
                //     : ''
                // let linkTextArr 
            }
            if (!map.has(key)) map.set(key, value)
        }
    }
    if (debug) console.log(66, {map})

    let nextUrl
    const getNextUrl = map => Array.from(map.keys())
        .filter(key => map.get(key)[1]===0 && key.startsWith(baseUrl))
        .shift()

    let hasMoreUrls = Array.from(map.keys()).filter(key => map.get(key)[1]===0 && key.startsWith(baseUrl)).length
    while (hasMoreUrls) {
        nextUrl = getNextUrl(map)
        if (debug) console.log(119, {hasMoreUrls, nextUrl, level})
        if (nextUrl) {
            await delay()
            ;({ level, map } = await spider(nextUrl, map, level)) // recurse
        }
        nextUrl = getNextUrl(map)
        hasMoreUrls = Array.from(map.keys()).filter(key => map.get(key)[1]===0 && key.startsWith(baseUrl)).length
    }

    if (debug) console.log('exiting... ', {map, level})
    return { map, level }
}

const showReport = map => {
    // map = map || false
    map = map && map instanceof Map ? map : false
    if (!map) return
    console.log(157, {map})
    
    const linksSkipped = Array.from(map.keys()).filter(key => map.get(key)[1]===0)
    if (linksSkipped.length) {
        console.log('\nLINKS SKIPPED (EXTERNAL?)\n')
        linksSkipped.forEach(link => console.log(link))
        console.log('\n')
    }
    const linksNotText = Array.from(map.keys()).filter(key => map.get(key)[1]===2)
    if (linksNotText.length) {
        console.log('\nLINKS TO DOWNLOADS OR IMAGES\n')
        linksNotText.forEach(link => console.log(link))
        console.log('\n')
    }
    const brokenLinks = Array.from(map.keys()).filter(key => map.get(key)[1] < 0)
    if (brokenLinks.length) {
        console.log('\nBROKEN LINKS\n')
        brokenLinks.forEach(link => console.log(link))
        console.log('\n')
    }
    const linksOk = Array.from(map.keys()).filter(key => map.get(key)[1]===1)
    if (linksOk.length) {
        console.log('\nWORKING LINKS\n')
        linksOk.forEach(link => console.log(link))
        console.log('\n')
    }
}

;(async () => {
    
	let { level, map } = await spider(startUrl)
    if (debug) console.log(124, {map, level})
    showReport(map)
})()


 
