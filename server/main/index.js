'use strict'

// npm
const Wreck = require('wreck')
const nano = require('cloudant-nano')
const pify = require('pify')
const truncate = require('html-truncate')
const sharp = require('sharp')
const marked = require('marked')

// core
const url = require('url')
const qs = require('querystring')

const reserved = ['edit', 'punch', 'contact', 'admin', 'new', 'user', 'css', 'js', 'img']

const makeOpts = (name, docs, noEnd) => {
  const opts = { startkey: [name], reduce: false }
  if (!noEnd) { opts.endkey = [name, '\ufff0'] }
  if (docs) { opts.include_docs = true }
  return opts
}

const jsonOpts = (opts) => {
  if (opts.startkey) { opts.startkey = JSON.stringify(opts.startkey) }
  if (opts.endkey) { opts.endkey = JSON.stringify(opts.endkey) }
  return qs.stringify(opts)
}

exports.register = (server, options, next) => {
  const dbUrl = url.resolve(options.db.url, options.db.name)

  const menu = function (request, reply) {
    const db = nano({ url: dbUrl })
    if (request.auth.credentials && request.auth.credentials.cookie) { db.cookie = request.auth.credentials.cookie }
    const view = pify(db.view, { multiArgs: true })
    view('app', 'menu', makeOpts('millette'))
      .then((x) => {
        const items = request.auth.credentials
          ? x[0].rows
            .map((r) => r.value)
            .map((r) => {
              r.path = '/punch' + r.path
              return r
            })
          : []
        items.unshift({ path: '/', title: 'Accueil' })
        items.push({ path: '/admin', title: 'Admin' })
        if (!request.auth.credentials) {
          items.push({ path: '/contact', title: 'Contact' })
        }
        return reply(items.map((item) => {
          item.active = item.path === request.path
          return item
        }))
      })
      .catch((e) => {
        console.log('EEEEE:', e)
        reply(e)
      })
  }

  const mapperContact = (request, callback) => {
    if (request.auth.credentials) { return callback(new Error('ouch')) }
    callback(null, dbUrl + '/_design/app/_update/comment', { accept: 'application/json' })
  }

  const responderContact = (err, res, request, reply) => {
    if (err) { return reply(err) } // FIXME: how to test?
    const go = (err, payload) => {
      if (err) { return reply(err) } // FIXME: how to test?
      reply.view('10-4', { theMsg: 'oh well', payload: payload })
    }
    Wreck.read(res, { json: true }, go)
  }

  const contact = function (request, reply) {
    if (request.auth.credentials) { return reply.view('eliza', { menu: request.pre.menu }) }
    reply.view('contact', { menu: request.pre.menu })
  }

  const mapper = (request, callback) => {
    const it = [dbUrl]
    let dest
    if (request.params.pathy && request.params.pathy !== 'admin') {
      it.push(request.params.pathy)
      dest = it.join('/')
    } else {
      it.push('_design/app/_view/menu')
      dest = it.join('/') + '?' + jsonOpts(makeOpts('millette', true))
    }
    callback(null, dest, { accept: 'application/json' })
  }

  const mapperImg = (request, callback) => {
    callback(null, [dbUrl, request.params.pathy, request.params.img].join('/'))
  }

  const responder = (err, res, request, reply) => {
    if (err) { return reply(err) } // FIXME: how to test?
    if (res.statusCode >= 400) { return reply.boom(res.statusCode, new Error(res.statusMessage)) }
    // if (request.params.action && request.params.action !== 'edit') { return reply.notFound(request.params.action) }

    const go = (err, payload) => {
      if (err) { return reply(err) } // FIXME: how to test?
      let tpl
      let obj
      if (payload._id) {
        const last = request.path.split('/').pop()
        if (last === 'edit') {
          tpl = 'edit-doc'
        } else {
          tpl = 'doc'
          payload.content = marked(payload.content)
        }
        if (!payload._attachments) { payload._attachments = [] }
        obj = { menu: request.pre.menu, doc: payload }
      } else if (payload.rows) {
        obj = {
          menu: request.pre.menu,
          docs: payload.rows.map((d) => {
            if (d.doc.content) {
              d.doc.content = marked(truncate(d.doc.content, options.teaser.length, { keepImageTag: true }))
            }
            if (!d.doc._attachments) { d.doc._attachments = [] }
            return d.doc
          })
        }
        if (request.path === '/admin') {
          tpl = 'admin'
          if (request.query.next) {
            obj.next = request.query.next.slice(1).split('/')
          }
        } else {
          if (request.auth.credentials) {
            tpl = 'front'
          } else {
            tpl = 'visitor'
          }
        }
      } else {
        return reply.notImplemented('What\'s that?', payload)
      }
      const etag = request.auth && request.auth.credentials && request.auth.credentials.name
        ? ('"' + res.headers.etag.slice(1, -1) + ':' + request.auth.credentials.name + '"')
        : res.headers.etag
      reply.view(tpl, obj).etag(etag)
    }
    Wreck.read(res, { json: true }, go)
  }

  const getDoc = function (request, reply) {
    const db = nano({ url: dbUrl })
    if (request.auth.credentials && request.auth.credentials.cookie) { db.cookie = request.auth.credentials.cookie }
    const get = pify(db.get, { multiArgs: true })
    get(request.payload.punch || request.params.pathy)
      .then((x) => {
        const doc = x[0]
        if (doc.weight && typeof doc.weight === 'string') {
          doc.weight = parseFloat(doc.weight)
        }
        reply(doc)
      })
      .catch(reply)
  }

  const resize = (image, width, height) => sharp(image).resize(width, height).max().toBuffer()

  const punchIt = function (request, reply) {
    const doc = request.pre.m1
    if (!doc.punches) { doc.punches = [] }
    const punch = { datetime: new Date().toISOString() }
    if (request.payload.comment) { punch.comment = request.payload.comment }
    doc.punches.push(punch)
    const db = nano({ url: dbUrl, cookie: request.auth.credentials.cookie })
    const insert = pify(db.insert, { multiArgs: true })
    insert(doc)
      .then((a) => {
        reply.redirect(request.payload.next || '/')
      })
      .catch((err) => {
        console.log('ERR:', err)
        reply(err)
      })
  }

  const newDoc = function (request, reply) {
    reply.view('new-doc', { doc: { _attachments: [] }, menu: request.pre.menu })
  }

  const editDoc = function (request, reply) {
    if (reserved.indexOf(request.payload.id) !== -1) { return reply.forbidden('The provided field "id" is unacceptable.', { reserved: reserved }) }
    request.payload._id = request.payload.id
    delete request.payload.id

    if (request.payload.rev) {
      request.payload._rev = request.payload.rev
      delete request.payload.rev
    }

    const db = nano({ url: dbUrl, cookie: request.auth.credentials.cookie })

    const insert = pify(
      (request.payload.jpeg && request.payload.jpeg.length)
        ? db.multipart.insert
        : db.insert,
      { multiArgs: true }
    )

    let p
    if (request.pre && request.pre.m1 && request.pre.m1.punches) {
      request.payload.punches = request.pre.m1.punches
    }

    if (request.payload.weight && typeof request.payload.weight === 'string') {
      request.payload.weight = parseFloat(request.payload.weight)
    }

    if (request.payload.jpeg && request.payload.jpeg.length) {
      p = sharp(request.payload.jpeg).metadata()
        .then((m) => Promise.all([
          request.payload.jpeg,
          resize(request.payload.jpeg, 160, 90),
          resize(request.payload.jpeg, 320, 180),
          resize(request.payload.jpeg, 800, 450),
          resize(request.payload.jpeg, 1280, 720),
          m.format
        ]))
        .then((stuff) => {
          const format = stuff.pop()
          delete request.payload.jpeg

          return stuff.map((im, n) => {
            return {
              name: `top-image${n ? ('-' + n) : ''}.${format}`,
              data: im,
              content_type: 'image/' + format
            }
          })
        })
        .then((atts) => insert(request.payload, atts, request.payload._id))
    } else {
      if (request.pre && request.pre.m1 && request.pre.m1._attachments) {
        request.payload._attachments = request.pre.m1._attachments
      }
      delete request.payload.jpeg
      p = insert(request.payload)
    }

    p.then((x) => reply.redirect('/punch/' + x[0].id))
      .catch((err) => reply.boom(err.statusCode, err))
  }

  server.route({
    method: 'GET',
    path: '/contact',
    config: {
      pre: [{ assign: 'menu', method: menu }],
      handler: contact
    }
  })

  server.route({
    method: 'POST',
    path: '/contact',
    handler: {
      proxy: {
        passThrough: true,
        mapUri: mapperContact,
        onResponse: responderContact
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/punch/new',
    config: {
      auth: { mode: 'required' },
      pre: [{ assign: 'menu', method: menu }],
      handler: newDoc
    }
  })

  server.route({
    method: 'POST',
    path: '/punch/new',
    config: {
      auth: { mode: 'required' },
      handler: editDoc
    }
  })

  server.route({
    method: 'GET',
    path: '/',
    config: {
      pre: [{ assign: 'menu', method: menu }],
      handler: {
        proxy: {
          passThrough: true,
          mapUri: mapper,
          onResponse: responder
        }
      }
    }
  })

  server.route({
    method: 'POST',
    path: '/',
    config: {
      pre: [ { method: getDoc, assign: 'm1' } ],
      auth: { mode: 'required' },
      handler: punchIt
    }
  })

  server.route({
    method: 'GET',
    path: '/admin',
    config: {
      pre: [{ assign: 'menu', method: menu }],
      // auth: { mode: 'required' },
      handler: {
        proxy: {
          passThrough: true,
          mapUri: mapper,
          onResponse: responder
        }
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/punch/{pathy}',
    config: {
      pre: [{ assign: 'menu', method: menu }],
      auth: { mode: 'required' },
      handler: {
        proxy: {
          passThrough: true,
          mapUri: mapper,
          onResponse: responder
        }
      }
    }
  })

  server.route({
    method: 'GET',
    path: `/punch/{pathy}/{img}`,
    config: {
      auth: { mode: 'required' },
      handler: {
        proxy: {
          passThrough: true,
          mapUri: mapperImg
        }
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/punch/{pathy}/edit',
    config: {
      pre: [{ assign: 'menu', method: menu }],
      auth: { mode: 'required' },
      handler: {
        proxy: {
          passThrough: true,
          mapUri: mapper,
          onResponse: responder
        }
      }
    }
  })

  server.route({
    method: 'POST',
    path: '/punch/{pathy}/edit',
    config: {
      pre: [ { method: getDoc, assign: 'm1' } ],
      auth: { mode: 'required' },
      handler: editDoc
    }
  })

  console.log(`CouchDB: ${dbUrl}`)
  next()
}

exports.register.attributes = {
  dependencies: ['h2o2'],
  name: 'main'
}
