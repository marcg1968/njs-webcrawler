

const { parentPort } = require('worker_threads')
const sqlite3 = require('sqlite3')

const dbname = (+new Date()) + '.sqlite'
let db = new sqlite3.Database(dbname, err => {
    if (err) {
        console.log('Getting error ', {err})
        exit(1)
    }
})

db.run(`
    CREATE TABLE links (
        _id INTEGER PRIMARY KEY NOT NULL,
        url TEXT NOT NULL,
        linkText TEXT,
        modified DATETIME DEFAULT (datetime('now', 'localtime'))
    );
    `, res => {
        console.log(21, {result})
    }
    , err  => {
        if (err) console.log(24, {err})
    }
)


parentPort.once('message', msg => {
    console.log(`${__filename}:31:`, 'received data from mainWorker', JSON.stringify(msg))
})

// CREATE TABLE links (_id INTEGER PRIMARY KEY NOT NULL, url TEXT NOT NULL, linkText TEXT, modified DATETIME DEFAULT (datetime('now', 'localtime')));