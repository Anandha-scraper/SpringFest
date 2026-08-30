/** HTTP layer for /api/events — read the request, call the service, pick the
 * status code. Every rule about what an event is lives in event.service.js. */
import * as events from "../services/event.service.js";

export async function list(req, res) {
  res.json(await events.listEvents());
}

export async function detail(req, res) {
  res.json(await events.getEvent(req.params.eventId));
}

export async function create(req, res) {
  res.status(201).json(await events.createEvent(req.body || {}));
}

export async function update(req, res) {
  res.json(await events.updateEvent(req.params.eventId, req.body || {}));
}

export async function remove(req, res) {
  await events.deleteEvent(req.params.eventId);
  res.status(204).end();
}
