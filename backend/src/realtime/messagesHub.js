// Hub minim; extindere pus in to do pentru streaming.
// ajuta backend-ul sa porneasca chiar si inainte sa fie legat fluxul in timp real.

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
      // ignor fluxuri stricate; curatarea se face la handler-ul de close
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

