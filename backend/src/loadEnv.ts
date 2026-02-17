import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root first, before any other app code runs
dotenv.config({ path: path.join(__dirname, '..', '.env') });
