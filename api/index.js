// Vercel serverless entry: run Express app for all /api/* requests.
// Backend must be built first (backend/dist).
const { app } = require('../backend/dist/presentation/app');
module.exports = app;
