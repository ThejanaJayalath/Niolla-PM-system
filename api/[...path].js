// Catch-all: /api/* (e.g. /api/v1/auth/login) all hit the Express app.
const { app } = require('../backend/dist/presentation/app');
module.exports = app;
