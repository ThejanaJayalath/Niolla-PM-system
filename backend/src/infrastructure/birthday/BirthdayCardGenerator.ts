import fs from 'fs';
import path from 'path';
import { getAssetsDir, getBirthdayCardsDir } from './birthdayCardPaths';
import { resolveGreetingTemplate } from './resolveGreetingTemplate';

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

export function buildBirthdayCardMessage(personName: string): string {
  const displayName = personName.trim() || 'Friend';
  return `Happy Birthday, ${displayName}!`;
}

export function buildFestivalCardMessage(personName: string, festivalKey: string, label: string): string {
  const displayName = personName.trim() || 'Friend';
  switch (festivalKey) {
    case 'new_year':
      return `Happy New Year, ${displayName}!`;
    case 'christmas':
      return `Merry Christmas, ${displayName}!`;
    case 'vesak':
      return `Happy Vesak, ${displayName}!`;
    case 'deepavali':
      return `Happy Deepavali, ${displayName}!`;
    default:
      return `Happy ${label}, ${displayName}!`;
  }
}

export function buildAnniversaryCardMessage(clientName: string, _projectName?: string): string {
  const name = clientName.trim() || 'Friend';
  return `Happy 1st Anniversary, ${name}!`;
}

export function buildDefaultGreeting(personName: string, roleLabel: string): string {
  const displayName = personName.trim() || 'Friend';
  const lead = buildBirthdayCardMessage(displayName);
  if (roleLabel === 'Employee' || roleLabel === 'PM' || roleLabel === 'Owner') {
    return `${lead} 🎂 Wishing you a fantastic year ahead. Thank you for being a valued member of Team NIOLLA Solutions. - From Team NIOLLA Solutions`;
  }
  return `${lead} 🎂 Wishing you a fantastic year ahead. Thank you for being a valued partner of NIOLLA. - From Team NIOLLA Solutions`;
}

export function buildAnniversaryGreeting(clientName: string, projectName: string): string {
  const name = clientName.trim() || 'Friend';
  const project = projectName.trim() || 'your project';
  return `Dear ${name}, thank you for one incredible year with "${project}"! 🎉 We are grateful for your trust in NIOLLA and look forward to many more successes together. - From Team NIOLLA Solutions`;
}

export function buildFestivalGreeting(
  personName: string,
  festivalLabel: string,
  festivalKey?: string
): string {
  const lead = festivalKey
    ? buildFestivalCardMessage(personName, festivalKey, festivalLabel)
    : `Happy ${festivalLabel}, ${personName.trim() || 'Friend'}!`;
  return `${lead} ✨ Thank you for connecting with NIOLLA. May this season bring joy and prosperity. - From Team NIOLLA Solutions`;
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

function messageFontSize(message: string): number {
  const len = message.length;
  if (len <= 22) return 46;
  if (len <= 32) return 40;
  if (len <= 42) return 34;
  if (len <= 52) return 28;
  return 24;
}

function buildBrandedSvg(opts: {
  mainMessage: string;
  subline: string;
  gradient?: [string, string, string];
  accent?: string;
}): string {
  const safeMessage = escapeXml(opts.mainMessage);
  const fontSize = messageFontSize(opts.mainMessage);
  const [c1, c2, c3] = opts.gradient || ['#e67e0f', '#fb8c19', '#f59e0b'];
  const accent = opts.accent || '#fff7ed';
  const logo = loadLogoDataUri();
  const logoBlock = logo
    ? `<image href="${logo}" x="312" y="40" width="176" height="72" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="400" y="88" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">NIOLLA</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="55%" style="stop-color:${c2}"/>
      <stop offset="100%" style="stop-color:${c3}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="800" height="500" rx="24" fill="url(#bg)"/>
  <circle cx="100" cy="90" r="70" fill="#ffffff" opacity="0.1"/>
  <circle cx="720" cy="400" r="100" fill="#ffffff" opacity="0.08"/>
  <rect x="48" y="128" width="704" height="248" rx="20" fill="#ffffff" opacity="0.12"/>
  ${logoBlock}
  <text x="400" y="268" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" filter="url(#shadow)">${safeMessage}</text>
  <text x="400" y="330" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="${accent}">${escapeXml(opts.subline)}</text>
  <text x="400" y="460" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.85)">Niolla PVT.LTD · niolla.lk</text>
</svg>`;
}

export function buildTemplateSvg(personName: string): string {
  return buildBrandedSvg({
    mainMessage: buildBirthdayCardMessage(personName),
    subline: 'Wishing you a wonderful celebration!',
    gradient: ['#c2410c', '#e67e0f', '#fb8c19'],
  });
}

export function buildAnniversaryTemplateSvg(clientName: string, projectName: string): string {
  return buildBrandedSvg({
    mainMessage: buildAnniversaryCardMessage(clientName, projectName),
    subline: `Celebrating one year with ${projectName.trim() || 'your project'}`,
    gradient: ['#0f766e', '#0891b2', '#0284c7'],
    accent: '#e0f2fe',
  });
}

export function buildFestivalTemplateSvg(
  personName: string,
  festivalLabel: string,
  festivalKey?: string
): string {
  const key = festivalKey || 'general';
  return buildBrandedSvg({
    mainMessage: buildFestivalCardMessage(personName, key, festivalLabel),
    subline: 'Warm wishes from NIOLLA',
    gradient:
      key === 'new_year'
        ? ['#1e3a8a', '#2563eb', '#38bdf8']
        : key === 'christmas'
          ? ['#14532d', '#166534', '#dc2626']
          : ['#b45309', '#ca8a04', '#ea580c'],
    accent: '#fff7ed',
  });
}

async function generateWithOpenAI(personName: string, campaign: GreetingCampaignType): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const defaultPrompts: Record<GreetingCampaignType, string> = {
    birthday: `Elegant NIOLLA birthday greeting card with large text "Happy Birthday, ${personName}!" orange branding`,
    anniversary: `Professional NIOLLA anniversary card with text "Happy 1st Anniversary, ${personName}!" celebratory theme`,
    festival: `Festive NIOLLA greeting card with warm holiday design featuring the recipient name "${personName}"`,
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
  usedCustomTemplate?: boolean;
}

export interface GreetingCardWriteOptions {
  projectName?: string;
  festivalKey?: string;
  festivalLabel?: string;
}

function applyTemplatePlaceholders(
  content: string,
  ctx: {
    personName: string;
    projectName?: string;
    festivalLabel?: string;
    festivalKey?: string;
    campaign?: GreetingCampaignType;
  }
): string {
  const name = ctx.personName.trim() || 'Friend';
  const project = ctx.projectName?.trim() || 'your project';
  const festival = ctx.festivalLabel?.trim() || 'festive';
  const festivalKey = ctx.festivalKey || 'general';
  const greeting =
    ctx.campaign === 'birthday'
      ? buildBirthdayCardMessage(name)
      : ctx.campaign === 'anniversary'
        ? buildAnniversaryCardMessage(name, project)
        : ctx.campaign === 'festival'
          ? buildFestivalCardMessage(name, festivalKey, festival)
          : buildBirthdayCardMessage(name);
  return content
    .replace(/\{\{greeting\}\}/gi, greeting)
    .replace(/\{\{message\}\}/gi, greeting)
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{personName\}\}/gi, name)
    .replace(/\{\{project\}\}/gi, project)
    .replace(/\{\{projectName\}\}/gi, project)
    .replace(/\{\{festival\}\}/gi, festival);
}

async function writeFromCustomTemplate(
  templatePath: string,
  mimeType: string,
  ctx: {
    personName: string;
    projectName?: string;
    festivalLabel?: string;
    festivalKey?: string;
    campaign?: GreetingCampaignType;
  },
  dir: string,
  id: string
): Promise<GeneratedCardFile> {
  if (mimeType === 'image/svg+xml' || templatePath.toLowerCase().endsWith('.svg')) {
    const raw = fs.readFileSync(templatePath, 'utf8');
    const svg = applyTemplatePlaceholders(raw, ctx);
    const fileName = `card-${id}.svg`;
    const absolutePath = path.join(dir, fileName);
    fs.writeFileSync(absolutePath, svg, 'utf8');
    return { fileName, mimeType: 'image/svg+xml', absolutePath, aiGenerated: false, usedCustomTemplate: true };
  }

  const ext = path.extname(templatePath).toLowerCase() || '.png';
  const fileName = `card-${id}${ext}`;
  const absolutePath = path.join(dir, fileName);
  fs.copyFileSync(templatePath, absolutePath);
  return { fileName, mimeType, absolutePath, aiGenerated: false, usedCustomTemplate: true };
}

export async function writeGreetingCardFile(
  personName: string,
  campaign: GreetingCampaignType,
  svgBuilder: () => string,
  opts?: GreetingCardWriteOptions
): Promise<GeneratedCardFile> {
  const dir = getBirthdayCardsDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const custom = await resolveGreetingTemplate(campaign, opts?.festivalKey);
  if (custom) {
    return writeFromCustomTemplate(
      custom.absolutePath,
      custom.mimeType,
      {
        personName,
        projectName: opts?.projectName,
        festivalLabel: opts?.festivalLabel,
        festivalKey: opts?.festivalKey,
        campaign,
      },
      dir,
      id
    );
  }

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
  return writeGreetingCardFile(personName, 'birthday', () => buildTemplateSvg(personName), {});
}
