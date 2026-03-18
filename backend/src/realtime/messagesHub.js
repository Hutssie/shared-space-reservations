// Minimal hub; expanded in "streaming" todo.
// Keeps backend booting even before realtime stream is wired.

/** @type {Map<string, Set<import('express').Response>>} */
const streamsByUserId = new Map();

export function publishToUser(userId, event, data) {
  const streams = streamsByUserId.get(userId);
  if (!streams || streams.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of streams) {
    try {
      res.write(payload);
    } catch {
      // ignore broken streams; cleanup happens on close handler
    }
  }
}

export function attachStream(userId, res) {
  let set = streamsByUserId.get(userId);
  if (!set) {
    set = new Set();
    streamsByUserId.set(userId, set);
  }
  set.add(res);
  res.on('close', () => {
    set.delete(res);
    if (set.size === 0) streamsByUserId.delete(userId);
  });
}

export function isUserOnline(userId) {
  const set = streamsByUserId.get(userId);
  return Boolean(set && set.size > 0);
}

