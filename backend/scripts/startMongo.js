/**
 * Start local MongoDB for development (Windows default install path).
 * Run in a separate terminal: npm run start:mongo
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const mongoExe =
  process.env.MONGOD_PATH ||
  'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';

const dbPath = path.join(__dirname, '..', 'data', 'db');
const logPath = path.join(__dirname, '..', 'data', 'mongo-log', 'mongod.log');

fs.mkdirSync(dbPath, { recursive: true });
fs.mkdirSync(path.dirname(logPath), { recursive: true });

if (!fs.existsSync(mongoExe)) {
  console.error(`mongod not found at: ${mongoExe}`);
  console.error('Install MongoDB or set MONGOD_PATH in .env');
  process.exit(1);
}

console.log('Starting MongoDB on 127.0.0.1:27017 ...');
console.log(`Data: ${dbPath}`);

const child = spawn(
  mongoExe,
  [
    '--dbpath',
    dbPath,
    '--port',
    '27017',
    '--bind_ip',
    '127.0.0.1',
    '--logpath',
    logPath,
    '--logappend',
    '--setParameter',
    'diagnosticDataCollectionEnabled=false',
    '--wiredTigerCacheSizeGB',
    '0.25',
  ],
  { stdio: 'inherit' }
);

child.on('exit', (code) => process.exit(code ?? 0));
