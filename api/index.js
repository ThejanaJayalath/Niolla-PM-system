// Vercel: /api/* is rewritten to /api with path in query. Restore path so Express can route.
const { app } = require('../backend/dist/presentation/app');

function handler(req, res) {
  const url = req.url || '';
  const q = url.indexOf('?');
  const pathname = q >= 0 ? url.slice(0, q) : url;
  const search = q >= 0 ? url.slice(q) : '';

  if (pathname === '/api' && search) {
    const params = new URLSearchParams(search);
    const path = params.get('path');
    if (path) {
      params.delete('path');
      const rest = params.toString();
      req.url = '/api/' + path + (rest ? '?' + rest : '');
    }
  }
  app(req, res);
}

module.exports = handler;
