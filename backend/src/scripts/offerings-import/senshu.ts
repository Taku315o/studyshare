import { chromium, type Browser, type Page } from 'playwright';
import {
  TERM_CODES,
  type CanonicalOfferingImportItem,
  type CanonicalSlotInput,
  type CanonicalTermCode,
  type ImportScope,
  type OfferingSlotKind,
} from './types';

const SEARCH_URL =
  'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slspskgr.do?clearAccessData=true&contenam=slspskgr&kjnmnNo=8';

const DETAIL_LINK_SELECTOR = 'a[href*="slspsbdr.do"]';
const LOAD_MORE_SELECTOR =
  'input[type="submit"][value*="次の5件"], input[type="submit"][value*="読み込む"]';

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

export function selectDepartmentLabels(
  availableDepartments: string[],
  requestedDepartments?: string[],
) {
  if (!requestedDepartments || requestedDepartments.length === 0) {
    return availableDepartments.filter((d) => !d.startsWith('【'));
  }

  const selected: string[] = [];
  const unknown: string[] = [];

  for (const requested of requestedDepartments) {
    const normalizedReq = normalizeText(requested).replace(/[【】]/g, '');

    let found = false;
    for (let i = 0; i < availableDepartments.length; i += 1) {
      const current = availableDepartments[i];
      const normalizedCurrent = normalizeText(current).replace(/[【】]/g, '');

      if (normalizedReq === normalizedCurrent) {
        if (current.startsWith('【')) {
          found = true;
          for (let j = i + 1; j < availableDepartments.length; j += 1) {
            if (availableDepartments[j].startsWith('【')) break;
            selected.push(availableDepartments[j]);
          }
        } else {
          found = true;
          selected.push(current);
        }
        break;
      }
    }

    if (!found) {
      unknown.push(requested);
    }
  }

  if (unknown.length > 0) {
    throw new Error(`unknown departments: ${unknown.join(', ')}`);
  }

  return Array.from(new Set(selected)).filter((d) => !d.startsWith('【'));
}

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
  const risyunen =
    url.searchParams.get('value(risyunen)') ?? url.searchParams.get('risyunen');
  const kougicd =
    url.searchParams.get('value(kougicd)') ?? url.searchParams.get('kougicd');
  const semekikn =
    url.searchParams.get('value(semekikn)') ?? url.searchParams.get('semekikn');

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

export function parseTermCode(
  periodText: string,
  fallbackTerm: CanonicalTermCode,
): CanonicalTermCode {
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

export function parseSenshuSlots(
  externalId: string,
  periodText: string,
): CanonicalSlotInput[] {
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

export function parseSenshuDetailText(
  detailText: string,
  detailUrl: string,
  fallbackTerm: CanonicalTermCode,
): ParsedSenshuDetail | null {
  const externalId = buildSenshuExternalId(detailUrl);
  if (!externalId) return null;

  const normalized = normalizeBlock(detailText);
  const academicYearText = extractSection(normalized, '開講年度', ['科目名']);
  const courseTitle = extractSection(normalized, '科目名', [
    '職名／担当教員',
    '職名/担当教員',
  ]);
  const instructor =
    extractSection(normalized, '職名／担当教員', [
      '期間／曜日／時限',
      '期間/曜日/時限',
    ]) ??
    extractSection(normalized, '職名/担当教員', [
      '期間／曜日／時限',
      '期間/曜日/時限',
    ]);
  const periodText =
    extractSection(normalized, '期間／曜日／時限', [
      '開講区分／校舎',
      '開講区分/校舎',
    ]) ??
    extractSection(normalized, '期間/曜日/時限', [
      '開講区分／校舎',
      '開講区分/校舎',
    ]);
  const creditsText =
    extractSection(normalized, '単 位', ['コースコード']) ??
    extractSection(normalized, '単　位', ['コースコード']);
  const courseCode = extractSection(normalized, 'コースコード', [
    '授業形態',
    '卒業認定・学位授与の方針との関連',
    'DPとの関連',
    '学修到達目標',
  ]);
  const updatedText = extractSection(normalized, '更新日付', [
    'Copyright',
    '専修大学Web講義要項',
  ]);

  const academicYear = academicYearText
    ? Number((academicYearText.match(/\d{4}/) ?? [])[0])
    : NaN;

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
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(SEARCH_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('select[name="value(nendo)"]', {
        timeout: 60000,
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await page.waitForTimeout(attempt * 1000);
      }
    }
  }

  throw lastError;
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
  const options = await page
    .locator('select[name="value(crclm)"] option')
    .evaluateAll((items) => items.map((item) => item.textContent?.trim() ?? ''));

  return options.filter((option) => option.length > 0);
}

async function waitForSearchForm(page: Page) {
  await page.waitForSelector('select[name="value(nendo)"]', { timeout: 60000 });
  await page.waitForSelector('select[name="value(crclm)"]', { timeout: 60000 });
  await page.waitForSelector('select[name="value(kaikoCd)"]', { timeout: 60000 });
}

async function selectSearchOption(
  page: Page,
  selector: string,
  option: { label: string },
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await waitForSearchForm(page);
      await page.locator(selector).selectOption(option, { timeout: 60000 });
      await page.waitForTimeout(300);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await page.waitForTimeout(attempt * 500);
      }
    }
  }

  throw lastError;
}

async function readSearchResultCount(page: Page): Promise<number | null> {
  const countText = await page
    .locator('h5')
    .filter({ hasText: '検索結果' })
    .first()
    .textContent()
    .catch(() => null);

  const normalized = normalizeText(countText);
  const match = normalized.match(/検索結果\s*(\d+)\s*件/);
  return match ? Number(match[1]) : null;
}

async function waitForSearchResults(page: Page) {
  const detailLinks = page.locator(DETAIL_LINK_SELECTOR);
  const loadMoreButton = page.locator(LOAD_MORE_SELECTOR);
  const noResultsText = page.getByText('該当する講義はありません');
  const resultHeader = page.locator('h5').filter({ hasText: '検索結果' }).first();

  await Promise.race([
    detailLinks.first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => null),
    loadMoreButton.first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => null),
    noResultsText.waitFor({ state: 'visible', timeout: 60000 }).catch(() => null),
    resultHeader.waitFor({ state: 'visible', timeout: 60000 }).catch(() => null),
    page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => null),
    page.waitForTimeout(1500),
  ]);
}

async function clickLoadMore(page: Page) {
  const button = page.locator(LOAD_MORE_SELECTOR).first();

  if ((await button.count()) === 0) {
    return false;
  }

  const value = normalizeText(await button.getAttribute('value'));
  if (!value.includes('次の5件') && !value.includes('読み込む')) {
    return false;
  }

  const beforeCount = await page.locator(DETAIL_LINK_SELECTOR).count();

  await button.scrollIntoViewIfNeeded().catch(() => null);
  await button.click({ noWaitAfter: true, timeout: 60000 }).catch(() => null);

  try {
    await page.waitForFunction(
      ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
      { selector: DETAIL_LINK_SELECTOR, prev: beforeCount },
      { timeout: 10000 },
    );
  } catch {
    await page.waitForTimeout(1200);
  }

  return true;
}

async function ensureResultsLoadedToIndex(page: Page, targetIndex: number) {
  let stagnantRounds = 0;

  while (true) {
    const count = await page.locator(DETAIL_LINK_SELECTOR).count();
    if (count > targetIndex) return;

    const clicked = await clickLoadMore(page);
    if (!clicked) return;

    const nextCount = await page.locator(DETAIL_LINK_SELECTOR).count();
    if (nextCount > count) {
      stagnantRounds = 0;
    } else {
      stagnantRounds += 1;
    }

    if (stagnantRounds >= 2) return;
  }
}

async function extractDetailFromHref(
  page: Page,
  href: string,
  fallbackTerm: CanonicalTermCode,
) {
  const context = page.context();
  const detailPage = await context.newPage();

  try {
    await detailPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const detailText = await detailPage.locator('body').innerText();
    const parsed = parseSenshuDetailText(detailText, detailPage.url(), fallbackTerm);

    if (!parsed) return null;

    const item: CanonicalOfferingImportItem = {
      externalId: parsed.externalId,
      academicYear: parsed.academicYear,
      termCode: parsed.termCode,
      courseTitle: parsed.courseTitle,
      courseCode: parsed.courseCode,
      instructor: parsed.instructor,
      credits: parsed.credits,
      canonicalUrl: detailPage.url(),
      sourceUpdatedAt: parsed.sourceUpdatedAt,
      rawPayload: parsed.rawPayload,
      slots: parsed.slots,
    };

    return item;
  } catch (e) {
    console.error(`[SenshuImporter] failed to fetch detail: ${href}`, e);
    return null;
  } finally {
    await detailPage.close();
  }
}

async function runSearchAndExtractItems(
  page: Page,
  academicYear: number,
  department: string,
  termCode: CanonicalTermCode,
): Promise<{ resultCount: number | null; items: CanonicalOfferingImportItem[] }> {
  const termLabel =
    termCode === 'first_half'
      ? '前期'
      : termCode === 'second_half'
        ? '後期'
        : '通年';

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await gotoSearch(page);
      await selectSearchOption(page, 'select[name="value(nendo)"]', {
        label: `${academicYear}年度`,
      });
      await selectSearchOption(page, 'select[name="value(crclm)"]', {
        label: department,
      });
      await selectSearchOption(page, 'select[name="value(kaikoCd)"]', {
        label: termLabel,
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await page.waitForTimeout(attempt * 1000);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  let noResults = false;
  const dialogHandler = async (dialog: {
    accept: () => Promise<void>;
    message: () => string;
  }) => {
    const message = dialog.message();
    if (message.includes('該当する講義はありません')) {
      noResults = true;
    }
    await dialog.accept();
  };
  page.once('dialog', dialogHandler);

  await page.getByRole('button', { name: '検索する' }).click({
    noWaitAfter: true,
    timeout: 60000,
  });

  await waitForSearchResults(page);

  if (noResults) {
    return { resultCount: 0, items: [] };
  }

  const resultCount = await readSearchResultCount(page);
  const fallbackTerm = termCode;
  const items: CanonicalOfferingImportItem[] = [];
  const seenExternalIds = new Set<string>();

  const maxIterations = resultCount ?? 10000;
  for (let index = 0; index < maxIterations; index += 1) {
    await ensureResultsLoadedToIndex(page, index);

    const visibleCount = await page.locator(DETAIL_LINK_SELECTOR).count();
    if (visibleCount <= index) {
      break;
    }

    if (index === 0 || (index + 1) % 25 === 0 || (resultCount && index + 1 === resultCount)) {
      console.log(
        `[SenshuImporter] visiting detail ${index + 1}/${resultCount ?? '?'} for ${department} (${termCode})`,
      );
    }

    const link = page.locator(DETAIL_LINK_SELECTOR).nth(index);
    await link.scrollIntoViewIfNeeded().catch(() => null);

    const href = await link.getAttribute('href');
    if (!href || !href.includes('slspsbdr.do')) {
      continue;
    }

    const absoluteHref = new URL(href, page.url()).href;
    const item = await extractDetailFromHref(page, absoluteHref, fallbackTerm);
    if (item && !seenExternalIds.has(item.externalId)) {
      seenExternalIds.add(item.externalId);
      items.push(item);
    }

    await page.waitForTimeout(300);
  }

  return { resultCount, items };
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
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await gotoSearch(page);
      const academicYears = await readAcademicYears(page);

      if (!academicYears.includes(scope.academicYear)) {
        throw new Error(
          `academic year ${scope.academicYear} is not available on Senshu syllabus`,
        );
      }

      const departments = await readDepartmentOptions(page);
      return { academicYears, departments };
    } finally {
      await context.close();
    }
  }

  async fetch(scope: ImportScope): Promise<CanonicalOfferingImportItem[]> {
    const browser = await this.openBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const { departments } = await this.discover(scope);
      const selectedDepartments = selectDepartmentLabels(
        departments,
        scope.departmentLabels,
      );
      const termCodes = scope.term === 'all' ? [...TERM_CODES] : [scope.term];

      console.log(
        `[SenshuImporter] selected departments (${selectedDepartments.length}): ${selectedDepartments.join(', ')}`,
      );

      const allItems: CanonicalOfferingImportItem[] = [];
      const seenExternalIds = new Set<string>();

      for (const department of selectedDepartments) {
        for (const termCode of termCodes) {
          console.log(
            `[SenshuImporter] search ${scope.academicYear} ${termCode} ${department}`,
          );

          const { resultCount, items } = await runSearchAndExtractItems(
            page,
            scope.academicYear,
            department,
            termCode,
          );

          for (const item of items) {
            if (!seenExternalIds.has(item.externalId)) {
              seenExternalIds.add(item.externalId);
              allItems.push(item);
            }
          }

          console.log(
            `[SenshuImporter] extracted items=${items.length} expected=${resultCount ?? 'unknown'} for ${department} (${termCode}), total unique ${allItems.length}`,
          );

          await page.waitForTimeout(500);
        }
      }

      console.log(
        `[SenshuImporter] fetched total items=${allItems.length}`,
      );

      return allItems;
    } finally {
      await context.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
