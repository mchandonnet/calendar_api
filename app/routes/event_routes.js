// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for events
const Event = require('./../models/event')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { example: { title: '', text: 'foo' } } -> { example: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// GET EVENTS FOR A SPECIFIC DATE
// GET /events/date/:date
router.get('/events/date/:date', requireToken, (req, res, next) => {
  Event.find({ owner: req.user.id, startDate: req.params.date }, null, {sort: { 'startTime': 1 }}) //, (_err, events) => { }
    .populate('owner')
    .then(event => {
      // `events` will be an array of Mongoose documents
      // we want to convert each one to a POJO, so we use `.map` to
      // apply `.toObject` to each one
      return event.map(event => event)
    })
    // respond with status 200 and JSON of the events
    .then(event => res.status(200).json({ event }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// GET ALL EVENTS FOR A SPECIFIC USER
// GET /events
router.get('/events', requireToken, (req, res, next) => {
  Event.find({ owner: req.user.id }, null, {sort: { 'startDate': 1, 'startTime': 1 }}) // , (_err, events) => { }
    .populate('owner')
    .then(event => {
      // `events` will be an array of Mongoose documents
      // we want to convert each one to a POJO, so we use `.map` to
      // apply `.toObject` to each one
      return event.map(event => event)
    })
    // respond with status 200 and JSON of the events
    .then(event => res.status(200).json({ event }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// SHOW
// GET /events/5a7db6c74d55bc51bdf39793
router.get('/events/:id', requireToken, (req, res, next) => {
  // req.params.id will be set based on the `:id` in the route
  Event.findById(req.params.id)
    .then(handle404)
    // if `findById` is succesful, respond with 200 and "example" JSON
    .then(event => res.status(200).json({ event: event.toObject() }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// CREATE
// POST /events
router.post('/events', requireToken, (req, res, next) => {
  // set owner of new example to be current user
  console.log(req.user.id)

  req.body.event.owner = req.user.id
  console.log(req.body.event)

  const eventData = req.body.event

  Event.create(eventData)
    // respond to succesful `create` with status 201 and JSON of new "example"
    .then(event => {
      res.status(201).json({ event: event.toObject() })
    })
    // if an error occurs, pass it off to our error handler
    // the error handler needs the error message and the `res` object so that it
    // can send an error message back to the client
    .catch(next)
})

// UPDATE
// PATCH /events/5a7db6c74d55bc51bdf39793
router.patch('/events/:id', requireToken, removeBlanks, (req, res, next) => {
  // if the client attempts to change the `owner` property by including a new
  // owner, prevent that by deleting that key/value pair
  delete req.body.event.owner
  const eventData = req.body.event

  Event.findById(req.params.id)
    .then(handle404)
    .then(event => {
      // pass the `req` object and the Mongoose record to `requireOwnership`
      // it will throw an error if the current user isn't the owner
      requireOwnership(req, event)

      // pass the result of Mongoose's `.update` to the next `.then`
      return event.updateOne(eventData)
    })
    // if that succeeded, return 204 and no JSON
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// DESTROY
// DELETE /events/5a7db6c74d55bc51bdf39793
router.delete('/events/:id', requireToken, (req, res, next) => {
  Event.findById(req.params.id)
    .then(handle404)
    .then(event => {
      // throw an error if current user doesn't own `example`
      requireOwnership(req, event)
      // delete the example ONLY IF the above didn't throw
      event.deleteOne()
    })
    // send back 204 and no content if the deletion succeeded
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

module.exports = router
