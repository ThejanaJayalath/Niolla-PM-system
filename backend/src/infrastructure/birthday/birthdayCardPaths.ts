import fs from 'fs';
import path from 'path';

export function getBirthdayCardsDir(): string {
  const dir = path.join(process.cwd(), 'uploads', 'birthday-cards');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getAssetsDir(): string {
  return path.join(process.cwd(), 'assets');
}
