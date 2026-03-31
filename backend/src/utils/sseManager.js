const logger = require('./logger');

// Map of evaluationId -> Set of response objects
const sseClients = new Map();

/**
 * Register a new SSE client for an evaluation.
 */
function sseConnect(evaluationId, res) {
  if (!sseClients.has(evaluationId)) {
    sseClients.set(evaluationId, new Set());
  }
  sseClients.get(evaluationId).add(res);
  logger.info(`SSE client connected for evaluation: ${evaluationId}`);

  res.on('close', () => {
    sseDisconnect(evaluationId, res);
  });
}

/**
 * Remove a client.
 */
function sseDisconnect(evaluationId, res) {
  const clients = sseClients.get(evaluationId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      sseClients.delete(evaluationId);
    }
  }
  logger.info(`SSE client disconnected for evaluation: ${evaluationId}`);
}

/**
 * Emit a data event to all clients watching an evaluation.
 */
function sseEmit(evaluationId, data) {
  const clients = sseClients.get(evaluationId);
  if (!clients || clients.size === 0) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (err) {
      logger.warn(`SSE write failed for ${evaluationId}: ${err.message}`);
      sseDisconnect(evaluationId, res);
    }
  }

  logger.debug(`SSE emitted to ${clients.size} client(s) for ${evaluationId}: ${data.status}`);
}

/**
 * Send heartbeat to all clients.
 */
function startHeartbeat() {
  setInterval(() => {
    for (const [evaluationId, clients] of sseClients.entries()) {
      for (const res of clients) {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          sseDisconnect(evaluationId, res);
        }
      }
    }
  }, 15000);
}

module.exports = { sseConnect, sseDisconnect, sseEmit, startHeartbeat };
