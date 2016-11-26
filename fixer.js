'use strict'

// npm
require('dotenv-safe').load()

// core
const url = require('url')

const dbUrl = url.resolve(process.env.DBURL, process.env.DBNAME)
console.log(dbUrl)

/*
const pify = require('pify')
const nano = require('cloudant-nano')
const _ = require('lodash')
*/

/*
const db = nano(dbUrl)
const nano2 = nano(process.env.DBURL)
const changes = pify(nano2.db.changes, { multiArgs: true })
const getDoc = pify(db.get, { multiArgs: true })
const copy = pify(nano2.request, { multiArgs: true })

const defaultObj = {
  db: process.env.DBNAME,
  method: 'copy'
}

changes(process.env.DBNAME, { since: 100, limit: 9 })
  .then((a) => a[0].results)
  .then((a) => Promise.all(a.map((x) => getDoc(x.id, { revs: true, rev: x.changes[0].rev }))))
  .then((a) => a.map((x) => {
    const ret = _.pick(x[0], ['_id', '_rev', '_revisions'])
    ret.goodRev = [ret._revisions.start - 1, ret._revisions.ids[1]].join('-')
    delete ret._revisions
    return ret
  }))
  .then((a) => Promise.all(a.map((doc) => copy(_.defaults({
    doc: doc._id,
    qs: { rev: doc.goodRev },
    headers: { destination: doc._id }
  }, defaultObj)))))
  .then((a) => console.log('AA3:', a))
  .catch((e) => console.error(e))
*/

/*
const allDocs = pify(db.list, { multiArgs: true })
const copyDoc = pify(db.copy, { multiArgs: true })
const delDoc = pify(db.destroy, { multiArgs: true })

const moveDoc = (x) => copyDoc(x.id, `millette:${x.id}`)
  .then(() => delDoc(x.id, x.value.rev))

allDocs({ startkey: '_\ufff0' })
  .then((a) => a[0].rows)
  .then((a) => _.partition(a, (x) => x.id.split(':').length === 2))
  .then((a) => {
    const toDel = a[0].map((x) => delDoc(x.id, x.value.rev))
    const toMove = a[1].map((x) => moveDoc(x))
    return Promise.all(_.concat(toDel, toMove))
  })
  .then((a) => {
    console.log(a.length)
  })
  .catch((e) => console.error(e))
*/
