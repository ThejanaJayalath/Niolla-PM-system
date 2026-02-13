// Catch-all so /api/v1/* (e.g. /api/v1/auth/login) hits the Express app.
const { app } = require('../../backend/dist/presentation/app');
module.exports = app;
