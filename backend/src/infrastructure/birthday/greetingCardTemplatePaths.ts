import fs from 'fs';
import path from 'path';

export function getGreetingTemplatesDir(): string {
  const dir = path.join(process.cwd(), 'uploads', 'greeting-templates');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
