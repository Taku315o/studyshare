import { OfferingImportRepository, createSupabaseAdminClient } from './offerings-import/db';
import { SenshuSyllabusImporter } from './offerings-import/senshu';
import {
  EMPTY_STATS,
  TERM_CODES,
  type CanonicalOfferingImportItem,
  type CanonicalTermCode,
  type ImportScope,
} from './offerings-import/types';

function parseArgs(argv: string[]): ImportScope {
  let academicYear: number | null = null;
  let term: CanonicalTermCode | 'all' = 'all';
  let dryRun = false;
  let retireMissing = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--academic-year') {
      academicYear = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--term') {
      const value = argv[index + 1] as CanonicalTermCode | 'all';
      if (value !== 'all' && !TERM_CODES.includes(value)) {
        throw new Error(`unsupported term: ${value}`);
      }
      term = value;
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--retire-missing') {
      retireMissing = true;
      continue;
    }
  }

  if (!academicYear || !Number.isInteger(academicYear)) {
    throw new Error('--academic-year is required');
  }

  return {
    academicYear,
    term,
    dryRun,
    retireMissing,
  };
}

type ImportResult = {
  stats: typeof EMPTY_STATS;
  errors: Array<{ externalId: string; message: string }>;
  seenExternalIds: string[];
};

async function importCanonicalItems(args: {
  scope: ImportScope;
  repo: OfferingImportRepository;
  runId: string;
  importSourceId: string;
  universityId: string;
  items: CanonicalOfferingImportItem[];
}) {
  const stats = { ...EMPTY_STATS };
  const seenExternalIds: string[] = [];
  const errors: Array<{ externalId: string; message: string }> = [];

  for (const item of args.items) {
    stats.rawSeen += 1;

    if (!item.externalId) {
      stats.skipped += 1;
      errors.push({ externalId: '(missing)', message: 'missing external id' });
      continue;
    }

    try {
      if (args.scope.dryRun) {
        seenExternalIds.push(item.externalId);
        continue;
      }

      const rawCatalogItem = await args.repo.upsertRawCatalogItem({
        importSourceId: args.importSourceId,
        runId: args.runId,
        item,
      });

      const termId = await args.repo.ensureTerm(args.universityId, item.academicYear, item.termCode);
      const courseResult = await args.repo.resolveOrCreateCourse({
        universityId: args.universityId,
        title: item.courseTitle,
        courseCode: item.courseCode,
        credits: item.credits,
      });

      if (courseResult.created) {
        stats.coursesCreated += 1;
      } else {
        stats.coursesReused += 1;
      }

      const offeringResult = await args.repo.resolveOrCreateOffering({
        termId,
        courseId: courseResult.courseId,
        rawItemId: rawCatalogItem.id,
        item,
      });

      if (offeringResult.created) {
        stats.offeringsCreated += 1;
      } else {
        stats.offeringsUpdated += 1;
      }

      if (offeringResult.preservedManual) {
        stats.manualMappingsPreserved += 1;
      }

      const slotResult = await args.repo.syncOfferingSlots({
        offeringId: offeringResult.offeringId,
        rawItemId: rawCatalogItem.id,
        slots: item.slots,
      });

      stats.slotsCreated += slotResult.created;
      stats.slotsUpdated += slotResult.updated;
      stats.slotsDeleted += slotResult.deleted;
      stats.manualMappingsPreserved += slotResult.preservedManual;
      seenExternalIds.push(item.externalId);
    } catch (error) {
      stats.skipped += 1;
      errors.push({
        externalId: item.externalId,
        message: error instanceof Error ? error.message : 'unknown import error',
      });
    }
  }

  if (!args.scope.dryRun && args.scope.retireMissing) {
    stats.retired = await args.repo.retireMissingOfferings({
      universityId: args.universityId,
      academicYear: args.scope.academicYear,
      termCode: args.scope.term,
      seenExternalIds,
    });
  }

  return { stats, errors, seenExternalIds } satisfies ImportResult;
}

async function main() {
  const scope = parseArgs(process.argv.slice(2));
  const supabase = createSupabaseAdminClient();
  const repo = new OfferingImportRepository(supabase);
  const importer = new SenshuSyllabusImporter();

  const universityId = await repo.getSenshuUniversityId();
  const importSource = await repo.ensureImportSource(universityId);
  const run = await repo.startRun(importSource.id, scope);

  try {
    const items = await importer.fetch(scope);
    const result = await importCanonicalItems({
      scope,
      repo,
      runId: run.id,
      importSourceId: importSource.id,
      universityId,
      items,
    });

    await repo.finishRun(run.id, scope.dryRun ? 'dry_run' : 'succeeded', result.stats as unknown as Record<string, unknown>, result.errors);

    console.log(JSON.stringify({
      scope,
      fetchedItems: items.length,
      stats: result.stats,
      errors: result.errors,
    }, null, 2));
  } catch (error) {
    await repo.finishRun(run.id, 'failed', EMPTY_STATS as unknown as Record<string, unknown>, [
      { message: error instanceof Error ? error.message : 'unknown run failure' },
    ]);
    throw error;
  } finally {
    await importer.close();
  }
}

void main();
