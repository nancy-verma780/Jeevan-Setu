/**
 * Real-time updates with Server-Sent Events. Events carry no data, only a topic,
 * so they can go to every signed-in client safely; each client then refetches
 * what it is allowed to see.
 */
const clients = new Set();

export function subscribe(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  const client = { res };
  clients.add(client);
  req.on("close", () => clients.delete(client));
}

export function publish(topic = "change") {
  const line = `event: change\ndata: ${JSON.stringify({ topic, at: Date.now() })}\n\n`;
  for (const c of clients) c.res.write(line);
}

setInterval(() => {
  for (const c of clients) c.res.write(": keep-alive\n\n");
}, 25_000).unref();

export const liveClientCount = () => clients.size;
