import fs from 'fs';
import path from 'path';
import { getAssetsDir, getBirthdayCardsDir } from './birthdayCardPaths';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function loadLogoDataUri(): string | null {
  const assets = getAssetsDir();
  for (const name of ['proposal-logo.png', 'proposal-logo.jpg', 'proposal-logo.jpeg']) {
    const p = path.join(assets, name);
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      const ext = path.extname(name).slice(1).toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      return `data:${mime};base64,${buf.toString('base64')}`;
    }
  }
  return null;
}

export type GreetingCampaignType = 'birthday' | 'anniversary' | 'festival';

export function buildDefaultGreeting(personName: string, roleLabel: string): string {
  const displayName = personName.trim() || 'Friend';
  if (roleLabel === 'Employee' || roleLabel === 'PM' || roleLabel === 'Owner') {
    return `Happy Birthday ${displayName}! 🎂 Wishing you a fantastic year ahead. Thank you for being a valued member of Team NIOLLA Solutions. - From Team NIOLLA Solutions`;
  }
  return `Happy Birthday ${displayName}! 🎂 Wishing you a fantastic year ahead. Thank you for being a valued partner of NIOLLA. - From Team NIOLLA Solutions`;
}

export function buildAnniversaryGreeting(clientName: string, projectName: string): string {
  const name = clientName.trim() || 'Friend';
  const project = projectName.trim() || 'your project';
  return `Dear ${name}, thank you for one incredible year with "${project}"! 🎉 We are grateful for your trust in NIOLLA and look forward to many more successes together. - From Team NIOLLA Solutions`;
}

export function buildFestivalGreeting(personName: string, festivalLabel: string): string {
  const name = personName.trim() || 'Friend';
  return `Warm ${festivalLabel} wishes, ${name}! ✨ Thank you for connecting with NIOLLA. May this season bring joy and prosperity. - From Team NIOLLA Solutions`;
}

const FESTIVAL_LABELS: Record<string, string> = {
  new_year: 'New Year',
  christmas: 'Christmas',
  vesak: 'Vesak',
  deepavali: 'Deepavali',
  general: 'festive',
};

export function festivalLabel(key: string): string {
  return FESTIVAL_LABELS[key] || FESTIVAL_LABELS.general;
}

function buildBrandedSvg(opts: {
  headline: string;
  personName: string;
  subline: string;
  gradient?: [string, string, string];
}): string {
  const safeName = escapeXml(opts.personName.trim() || 'Friend');
  const [c1, c2, c3] = opts.gradient || ['#4f46e5', '#7c3aed', '#db2777'];
  const logo = loadLogoDataUri();
  const logoBlock = logo
    ? `<image href="${logo}" x="312" y="48" width="176" height="72" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="400" y="95" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="700" fill="#ffffff">NIOLLA</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="50%" style="stop-color:${c2}"/>
      <stop offset="100%" style="stop-color:${c3}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="800" height="500" rx="24" fill="url(#bg)"/>
  <circle cx="120" cy="80" r="60" fill="#ffffff" opacity="0.08"/>
  <circle cx="700" cy="420" r="90" fill="#ffffff" opacity="0.06"/>
  ${logoBlock}
  <text x="400" y="200" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#e0e7ff" letter-spacing="3">${escapeXml(opts.headline)}</text>
  <text x="400" y="280" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="700" fill="#ffffff" filter="url(#shadow)">${safeName}</text>
  <text x="400" y="340" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#fce7f3">${escapeXml(opts.subline)}</text>
  <text x="400" y="460" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#c7d2fe">Niolla PVT.LTD · niolla.lk</text>
</svg>`;
}

export function buildTemplateSvg(personName: string): string {
  return buildBrandedSvg({
    headline: 'HAPPY BIRTHDAY',
    personName,
    subline: 'Wishing you a wonderful celebration!',
  });
}

export function buildAnniversaryTemplateSvg(clientName: string, projectName: string): string {
  return buildBrandedSvg({
    headline: '1 YEAR TOGETHER',
    personName: clientName,
    subline: `Celebrating ${projectName.trim() || 'your project'}`,
    gradient: ['#0f766e', '#0891b2', '#4f46e5'],
  });
}

export function buildFestivalTemplateSvg(personName: string, festivalLabel: string): string {
  return buildBrandedSvg({
    headline: festivalLabel.toUpperCase(),
    personName,
    subline: 'Warm wishes from NIOLLA',
    gradient: ['#b45309', '#ca8a04', '#ea580c'],
  });
}

async function generateWithOpenAI(personName: string, campaign: GreetingCampaignType): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const defaultPrompts: Record<GreetingCampaignType, string> = {
    birthday: `Elegant professional birthday greeting card for "${personName}", NIOLLA branding, purple indigo accents`,
    anniversary: `Professional one-year project anniversary thank-you card for "${personName}", NIOLLA branding, celebratory business theme`,
    festival: `Festive seasonal greeting card for "${personName}", NIOLLA branding, warm holiday design`,
  };
  const prompt =
    process.env.BIRTHDAY_CARD_AI_PROMPT?.trim() || defaultPrompts[campaign];

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn('OpenAI image generation failed:', res.status, errText.slice(0, 300));
      return null;
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return null;
    return Buffer.from(b64, 'base64');
  } catch (e) {
    console.warn('OpenAI image generation error:', e);
    return null;
  }
}

export interface GeneratedCardFile {
  fileName: string;
  mimeType: string;
  absolutePath: string;
  aiGenerated: boolean;
}

export async function writeGreetingCardFile(
  personName: string,
  campaign: GreetingCampaignType,
  svgBuilder: () => string
): Promise<GeneratedCardFile> {
  const dir = getBirthdayCardsDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const aiBuffer = await generateWithOpenAI(personName, campaign);
  if (aiBuffer) {
    const fileName = `card-${id}.png`;
    const absolutePath = path.join(dir, fileName);
    fs.writeFileSync(absolutePath, aiBuffer);
    return { fileName, mimeType: 'image/png', absolutePath, aiGenerated: true };
  }

  const fileName = `card-${id}.svg`;
  const absolutePath = path.join(dir, fileName);
  fs.writeFileSync(absolutePath, svgBuilder(), 'utf8');
  return { fileName, mimeType: 'image/svg+xml', absolutePath, aiGenerated: false };
}

export async function writeBirthdayCardFile(personName: string): Promise<GeneratedCardFile> {
  return writeGreetingCardFile(personName, 'birthday', () => buildTemplateSvg(personName));
}
