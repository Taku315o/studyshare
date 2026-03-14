import { chromium, type Browser, type Page } from 'playwright';
import {
  TERM_CODES,
  type CanonicalOfferingImportItem,
  type CanonicalSlotInput,
  type CanonicalTermCode,
  type ImportScope,
  type OfferingSlotKind,
} from './types';

const SEARCH_URL = 'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slspskgr.do?clearAccessData=true&contenam=slspskgr&kjnmnNo=8';

type ParsedSenshuDetail = {
  externalId: string;
  academicYear: number;
  termCode: CanonicalTermCode;
  courseTitle: string;
  courseCode: string | null;
  instructor: string | null;
  credits: number | null;
  sourceUpdatedAt: string | null;
  slots: CanonicalSlotInput[];
  rawPayload: Record<string, unknown>;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\u00a0/g, ' ').replace(/\r/g, '').trim();
}

function normalizeBlock(value: string) {
  return normalizeText(value)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSection(text: string, label: string, nextLabels: string[]) {
  const startIndex = text.indexOf(label);
  if (startIndex < 0) return null;

  const tail = text.slice(startIndex + label.length);
  const endIndex = nextLabels
    .map((next) => tail.indexOf(next))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  const chunk = endIndex === undefined ? tail : tail.slice(0, endIndex);
  const cleaned = normalizeBlock(chunk);
  return cleaned.length > 0 ? cleaned : null;
}

export function buildSenshuExternalId(detailUrl: string) {
  const url = new URL(detailUrl);
  const risyunen = url.searchParams.get('value(risyunen)') ?? url.searchParams.get('risyunen');
  const kougicd = url.searchParams.get('value(kougicd)') ?? url.searchParams.get('kougicd');
  const semekikn = url.searchParams.get('value(semekikn)') ?? url.searchParams.get('semekikn');
  if (!risyunen || !kougicd) return null;
  return semekikn ? `${risyunen}:${kougicd}:${semekikn}` : `${risyunen}:${kougicd}`;
}

export function parseSenshuDate(value: string | null) {
  if (!value) return null;
  const match = value.match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseCredits(value: string | null) {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function weekdayToNumber(value: string) {
  if (value.includes('月')) return 1;
  if (value.includes('火')) return 2;
  if (value.includes('水')) return 3;
  if (value.includes('木')) return 4;
  if (value.includes('金')) return 5;
  if (value.includes('土')) return 6;
  if (value.includes('日')) return 7;
  return null;
}

export function parseTermCode(periodText: string, fallbackTerm: CanonicalTermCode): CanonicalTermCode {
  if (periodText.includes('前期')) return 'first_half';
  if (periodText.includes('後期')) return 'second_half';
  if (periodText.includes('通年')) return 'full_year';
  return fallbackTerm;
}

function inferNonStructuredSlotKind(periodText: string): OfferingSlotKind {
  if (periodText.includes('集中')) return 'intensive';
  if (periodText.includes('オンデマンド')) return 'on_demand';
  return 'unscheduled';
}

export function parseSenshuSlots(externalId: string, periodText: string): CanonicalSlotInput[] {
  const lines = periodText
    .split('\n')
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);

  const slots: CanonicalSlotInput[] = [];

  for (const line of lines) {
    const match = line.match(/([月火水木金土日])曜日\s*(\d+)時限/);
    if (match) {
      const dayOfWeek = weekdayToNumber(match[1]);
      const period = Number(match[2]);
      if (dayOfWeek && Number.isInteger(period)) {
        slots.push({
          externalId: `${externalId}::weekly_structured:${dayOfWeek}:${period}`,
          slotKind: 'weekly_structured',
          dayOfWeek,
          period,
          room: null,
          rawText: line,
        });
        continue;
      }
    }

    const slotKind = inferNonStructuredSlotKind(line);
    slots.push({
      externalId: `${externalId}::${slotKind}`,
      slotKind,
      dayOfWeek: null,
      period: null,
      room: null,
      rawText: line,
    });
  }

  if (slots.length === 0) {
    slots.push({
      externalId: `${externalId}::unscheduled`,
      slotKind: 'unscheduled',
      dayOfWeek: null,
      period: null,
      room: null,
      rawText: normalizeText(periodText) || null,
    });
  }

  return slots;
}

export function parseSenshuDetailText(detailText: string, detailUrl: string, fallbackTerm: CanonicalTermCode): ParsedSenshuDetail | null {
  const externalId = buildSenshuExternalId(detailUrl);
  if (!externalId) return null;

  const normalized = normalizeBlock(detailText);
  const academicYearText = extractSection(normalized, '開講年度', ['科目名']);
  const courseTitle = extractSection(normalized, '科目名', ['職名／担当教員', '職名/担当教員']);
  const instructor = extractSection(normalized, '職名／担当教員', ['期間／曜日／時限', '期間/曜日/時限'])
    ?? extractSection(normalized, '職名/担当教員', ['期間／曜日／時限', '期間/曜日/時限']);
  const periodText = extractSection(normalized, '期間／曜日／時限', ['開講区分／校舎', '開講区分/校舎'])
    ?? extractSection(normalized, '期間/曜日/時限', ['開講区分／校舎', '開講区分/校舎']);
  const creditsText = extractSection(normalized, '単 位', ['コースコード'])
    ?? extractSection(normalized, '単　位', ['コースコード']);
  const courseCode = extractSection(normalized, 'コースコード', ['授業形態', '卒業認定・学位授与の方針との関連', 'DPとの関連', '学修到達目標']);
  const updatedText = extractSection(normalized, '更新日付', ['Copyright', '専修大学Web講義要項']);

  const academicYear = academicYearText ? Number((academicYearText.match(/\d{4}/) ?? [])[0]) : NaN;
  if (!courseTitle || !periodText || !Number.isInteger(academicYear)) {
    return null;
  }

  const termCode = parseTermCode(periodText, fallbackTerm);
  const slots = parseSenshuSlots(externalId, periodText);

  return {
    externalId,
    academicYear,
    termCode,
    courseTitle: courseTitle.trim(),
    courseCode: courseCode ? courseCode.replace(/\s+/g, '') : null,
    instructor: instructor ? instructor.trim() : null,
    credits: parseCredits(creditsText),
    sourceUpdatedAt: parseSenshuDate(updatedText),
    slots,
    rawPayload: {
      detailUrl,
      academicYear,
      courseTitle: courseTitle.trim(),
      courseCode: courseCode ? courseCode.trim() : null,
      instructor: instructor ? instructor.trim() : null,
      credits: parseCredits(creditsText),
      updatedAt: updatedText,
      periodText,
      rawText: normalized,
    },
  };
}

async function gotoSearch(page: Page) {
  await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('select[name="value(nendo)"]', { timeout: 30000 });
}

async function readAcademicYears(page: Page) {
  return page.locator('select[name="value(nendo)"] option').evaluateAll((options) =>
    options
      .map((option) => option.textContent?.trim() ?? '')
      .map((value) => Number((value.match(/\d{4}/) ?? [])[0]))
      .filter((value) => Number.isInteger(value)),
  );
}

async function readDepartmentOptions(page: Page) {
  const options = await page.locator('select[name="value(crclm)"] option').evaluateAll((items) =>
    items.map((item) => item.textContent?.trim() ?? ''),
  );
  return options.filter((option) => option.length > 0 && !option.startsWith('【'));
}

async function runSearch(page: Page, academicYear: number, department: string, termCode: CanonicalTermCode) {
  await gotoSearch(page);
  await page.locator('select[name="value(nendo)"]').selectOption({ label: `${academicYear}年度` });
  await page.locator('select[name="value(crclm)"]').selectOption({ label: department });

  const termLabel = termCode === 'first_half' ? '前期' : termCode === 'second_half' ? '後期' : '通年';
  await page.locator('select[name="value(kaikoCd)"]').selectOption({ label: termLabel });

  let noResults = false;
  const dialogHandler = async (dialog: { accept: () => Promise<void>; message: () => string }) => {
    const message = dialog.message();
    if (message.includes('該当する講義はありません')) {
      noResults = true;
    }
    await dialog.accept();
  };
  page.once('dialog', dialogHandler);

  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.getByRole('button', { name: '検索する' }).click(),
  ]);

  if (noResults) {
    return [];
  }

  return collectDetailLinks(page);
}

async function collectDetailLinks(page: Page) {
  const results = new Set<string>();
  const visitedPages = new Set<string>();

  while (true) {
    await page.waitForLoadState('domcontentloaded');
    const detailLinks = await page.locator('a[href*="slbssbdr.do"]').evaluateAll((anchors) =>
      anchors
        .map((anchor) => (anchor as HTMLAnchorElement).href)
        .filter((href) => href && href.includes('slbssbdr.do')),
    );

    detailLinks.forEach((href) => results.add(href));
    const signature = `${page.url()}::${detailLinks.length}`;
    if (visitedPages.has(signature)) {
      break;
    }
    visitedPages.add(signature);

    const nextLink = page.locator('a').filter({ hasText: '次' }).first();
    if ((await nextLink.count()) === 0) {
      break;
    }

    const label = normalizeText(await nextLink.textContent());
    if (!label.includes('次')) {
      break;
    }

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      nextLink.click(),
    ]);
  }

  return Array.from(results);
}

async function fetchDetail(page: Page, detailUrl: string, fallbackTerm: CanonicalTermCode) {
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const detailText = await page.locator('body').innerText();
  const parsed = parseSenshuDetailText(detailText, page.url(), fallbackTerm);
  if (!parsed) return null;

  const item: CanonicalOfferingImportItem = {
    externalId: parsed.externalId,
    academicYear: parsed.academicYear,
    termCode: parsed.termCode,
    courseTitle: parsed.courseTitle,
    courseCode: parsed.courseCode,
    instructor: parsed.instructor,
    credits: parsed.credits,
    canonicalUrl: page.url(),
    sourceUpdatedAt: parsed.sourceUpdatedAt,
    rawPayload: parsed.rawPayload,
    slots: parsed.slots,
  };

  return item;
}

export class SenshuSyllabusImporter {
  private browser: Browser | null = null;

  private async openBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  async discover(scope: ImportScope) {
    const browser = await this.openBrowser();
    const page = await browser.newPage();
    try {
      await gotoSearch(page);
      const academicYears = await readAcademicYears(page);
      if (!academicYears.includes(scope.academicYear)) {
        throw new Error(`academic year ${scope.academicYear} is not available on Senshu syllabus`);
      }
      const departments = await readDepartmentOptions(page);
      return { academicYears, departments };
    } finally {
      await page.close();
    }
  }

  async fetch(scope: ImportScope): Promise<CanonicalOfferingImportItem[]> {
    const browser = await this.openBrowser();
    const searchPage = await browser.newPage();
    const detailPage = await browser.newPage();

    try {
      const { departments } = await this.discover(scope);
      const termCodes = scope.term === 'all' ? [...TERM_CODES] : [scope.term];
      const detailLinks = new Set<string>();

      for (const department of departments) {
        for (const termCode of termCodes) {
          const links = await runSearch(searchPage, scope.academicYear, department, termCode);
          links.forEach((link) => detailLinks.add(link));
        }
      }

      const items: CanonicalOfferingImportItem[] = [];
      for (const detailLink of detailLinks) {
        const fallbackTerm = scope.term === 'all' ? 'first_half' : scope.term;
        const item = await fetchDetail(detailPage, detailLink, fallbackTerm);
        if (item) {
          items.push(item);
        }
      }

      return items;
    } finally {
      await Promise.all([searchPage.close(), detailPage.close()]);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
