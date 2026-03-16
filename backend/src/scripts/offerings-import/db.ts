import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import {
  SENSHU_SOURCE_CODE,
  SENSHU_UNIVERSITY_NAME,
  type CanonicalOfferingImportItem,
  type CanonicalSlotInput,
  type CanonicalTermCode,
  type ImportEntityType,
  type ImportScope,
  type MappingType,
  type OfferingSlotKind,
} from './types';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.development') });
dotenv.config();

type JsonRecord = Record<string, unknown>;

type AdminClient = SupabaseClient<any, 'public', any>;

type RawCatalogItemRow = {
  id: string;
  import_source_id: string;
  external_id: string;
};

type SourceMappingRow = {
  id: string;
  external_source: string;
  external_id: string;
  raw_item_id: string | null;
  entity_type: ImportEntityType;
  entity_id: string;
  mapping_type: MappingType;
  confidence: number;
};

type TermRow = {
  id: string;
};

type CourseRow = {
  id: string;
};

type OfferingRow = {
  id: string;
};

type OfferingSlotRow = {
  id: string;
};

type ImportSourceRow = {
  id: string;
  source_code: string;
};

type ImportRunRow = {
  id: string;
};

type OfferingCatalogCoverageRow = {
  coverage_kind: 'partial' | 'full';
  source_scope_labels: string[] | null;
};

type ExistingSlotMapping = {
  id: string;
  external_id: string;
  mapping_type: MappingType;
  entity_id: string;
};

type RetireMappingRow = {
  external_id: string;
  entity_id: string;
  mapping_type: MappingType;
};

type RetireOfferingRow = {
  id: string;
  term_id: string;
};

type RetireTermRow = {
  id: string;
  university_id: string;
  academic_year: number;
  code: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeExactCourseTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (!isObject(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<JsonRecord>((result, key) => {
      result[key] = sortJsonValue(value[key]);
      return result;
    }, {});
}

export function stableJsonHash(value: unknown) {
  const payload = JSON.stringify(sortJsonValue(value));
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function resolveCatalogCoverage(args: {
  existing: OfferingCatalogCoverageRow | null;
  departmentLabels: string[];
}) {
  if (args.departmentLabels.length === 0) {
    return {
      coverageKind: 'full' as const,
      sourceScopeLabels: [] as string[],
    };
  }

  if (args.existing?.coverage_kind === 'full') {
    return {
      coverageKind: 'full' as const,
      sourceScopeLabels: [] as string[],
    };
  }

  return {
    coverageKind: 'partial' as const,
    sourceScopeLabels: Array.from(
      new Set([...(args.existing?.source_scope_labels ?? []), ...args.departmentLabels]),
    ).sort((left, right) => left.localeCompare(right, 'ja')),
  };
}

export function selectRetiredOfferingIds(args: {
  mappings: RetireMappingRow[];
  offerings: RetireOfferingRow[];
  terms: RetireTermRow[];
  universityId: string;
  academicYear: number;
  termCode: CanonicalTermCode | 'all';
  seenExternalIds: string[];
}) {
  const termCodes = args.termCode === 'all' ? ['first_half', 'second_half', 'full_year'] : [args.termCode];
  const termsById = new Map(args.terms.map((term) => [term.id, term]));
  const offeringToExternalId = new Map(
    args.mappings
      .filter((mapping) => mapping.mapping_type !== 'manual')
      .map((mapping) => [mapping.entity_id, mapping.external_id]),
  );

  return args.offerings.flatMap((offering) => {
    const term = termsById.get(offering.term_id);
    if (!term) return [];
    if (term.university_id !== args.universityId) return [];
    if (term.academic_year !== args.academicYear) return [];
    if (!termCodes.includes(term.code)) return [];
    const externalId = offeringToExternalId.get(offering.id);
    if (!externalId || args.seenExternalIds.includes(externalId)) return [];
    return [offering.id];
  });
}

function termCodeToSeason(termCode: CanonicalTermCode): string {
  switch (termCode) {
    case 'first_half':
      return 'first_half';
    case 'second_half':
      return 'second_half';
    case 'full_year':
      return 'full_year';
    default:
      return 'other';
  }
}

function termCodeToDisplayName(termCode: CanonicalTermCode): string {
  switch (termCode) {
    case 'first_half':
      return '前期';
    case 'second_half':
      return '後期';
    case 'full_year':
      return '通年';
  }
}

function termCodeToSortKey(termCode: CanonicalTermCode): number {
  switch (termCode) {
    case 'first_half':
      return 10;
    case 'second_half':
      return 20;
    case 'full_year':
      return 50;
  }
}

export function createSupabaseAdminClient(): AdminClient {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export class OfferingImportRepository {
  constructor(private readonly supabase: AdminClient) {}

  async getSenshuUniversityId() {
    const { data, error } = await this.supabase
      .from('universities')
      .select('id')
      .eq('name', SENSHU_UNIVERSITY_NAME)
      .single();

    if (error) {
      throw error;
    }

    return (data as { id: string }).id;
  }

  async ensureImportSource(universityId: string) {
    const { data, error } = await this.supabase
      .from('import_sources')
      .upsert(
        {
          source_code: SENSHU_SOURCE_CODE,
          university_id: universityId,
          base_url: 'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slspskgr.do?clearAccessData=true&contenam=slspskgr&kjnmnNo=8',
          is_active: true,
        },
        { onConflict: 'source_code' },
      )
      .select('id, source_code')
      .single();

    if (error) {
      throw error;
    }

    return data as ImportSourceRow;
  }

  async startRun(importSourceId: string, scope: ImportScope) {
    const { data, error } = await this.supabase
      .from('import_runs')
      .insert({
        import_source_id: importSourceId,
        scope_json: {
          academicYear: scope.academicYear,
          term: scope.term,
          departmentLabels: scope.departmentLabels ?? [],
          retireMissing: scope.retireMissing,
        },
        status: scope.dryRun ? 'dry_run' : 'running',
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data as ImportRunRow;
  }

  async finishRun(runId: string, status: 'succeeded' | 'failed' | 'dry_run', stats: JsonRecord, errorSummary: JsonRecord[] = []) {
    const { error } = await this.supabase
      .from('import_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        stats_json: stats,
        error_summary: errorSummary,
      })
      .eq('id', runId);

    if (error) {
      throw error;
    }
  }

  async upsertRawCatalogItem(args: {
    importSourceId: string;
    runId: string;
    item: CanonicalOfferingImportItem;
  }) {
    const now = new Date().toISOString();
    const contentHash = stableJsonHash(args.item.rawPayload);

    const { data: existingData, error: existingError } = await this.supabase
      .from('raw_catalog_items')
      .select('id, import_source_id, external_id')
      .eq('import_source_id', args.importSourceId)
      .eq('external_id', args.item.externalId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingData) {
      const { data, error } = await this.supabase
        .from('raw_catalog_items')
        .update({
          academic_year: args.item.academicYear,
          source_url: args.item.canonicalUrl,
          payload_json: args.item.rawPayload,
          content_hash: contentHash,
          source_updated_at: args.item.sourceUpdatedAt,
          latest_run_id: args.runId,
          last_seen_at: now,
        })
        .eq('id', (existingData as RawCatalogItemRow).id)
        .select('id, import_source_id, external_id')
        .single();

      if (error) {
        throw error;
      }

      return data as RawCatalogItemRow;
    }

    const { data, error } = await this.supabase
      .from('raw_catalog_items')
      .insert({
        import_source_id: args.importSourceId,
        external_id: args.item.externalId,
        academic_year: args.item.academicYear,
        source_url: args.item.canonicalUrl,
        payload_json: args.item.rawPayload,
        content_hash: contentHash,
        source_updated_at: args.item.sourceUpdatedAt,
        latest_run_id: args.runId,
        first_seen_at: now,
        last_seen_at: now,
      })
      .select('id, import_source_id, external_id')
      .single();

    if (error) {
      throw error;
    }

    return data as RawCatalogItemRow;
  }

  async ensureTerm(universityId: string, academicYear: number, termCode: CanonicalTermCode) {
    const { data, error } = await this.supabase
      .from('terms')
      .upsert(
        {
          university_id: universityId,
          year: academicYear,
          season: termCodeToSeason(termCode),
          academic_year: academicYear,
          code: termCode,
          display_name: termCodeToDisplayName(termCode),
          sort_key: termCodeToSortKey(termCode),
        },
        { onConflict: 'university_id,academic_year,code' },
      )
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return (data as TermRow).id;
  }

  async resolveOrCreateCourse(args: {
    universityId: string;
    title: string;
    courseCode: string | null;
    credits: number | null;
  }) {
    const normalizedTitle = normalizeExactCourseTitle(args.title);

    if (args.courseCode) {
      const { data: existingCodeData, error: existingCodeError } = await this.supabase
        .from('courses')
        .select('id')
        .eq('university_id', args.universityId)
        .eq('course_code', args.courseCode)
        .maybeSingle();

      if (existingCodeError) {
        throw existingCodeError;
      }

      if (existingCodeData) {
        const { data, error } = await this.supabase
          .from('courses')
          .update({
            name: normalizedTitle,
            credits: args.credits,
          })
          .eq('id', (existingCodeData as CourseRow).id)
          .select('id')
          .single();

        if (error) {
          throw error;
        }

        return { courseId: (data as CourseRow).id, created: false };
      }

      const { data, error } = await this.supabase
        .from('courses')
        .insert({
          university_id: args.universityId,
          course_code: args.courseCode,
          name: normalizedTitle,
          credits: args.credits,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return { courseId: (data as CourseRow).id, created: true };
    }

    const { data: existingData, error: existingError } = await this.supabase
      .from('courses')
      .select('id')
      .eq('university_id', args.universityId)
      .eq('name', normalizedTitle)
      .order('created_at', { ascending: true })
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    const existing = ((existingData ?? []) as CourseRow[])[0];
    if (existing) {
      return { courseId: existing.id, created: false };
    }

    const { data: insertedData, error: insertedError } = await this.supabase
      .from('courses')
      .insert({
        university_id: args.universityId,
        course_code: args.courseCode,
        name: normalizedTitle,
        credits: args.credits,
      })
      .select('id')
      .single();

    if (insertedError) {
      throw insertedError;
    }

    return { courseId: (insertedData as CourseRow).id, created: true };
  }

  async findSourceMapping(externalSource: string, externalId: string, entityType: ImportEntityType) {
    const { data, error } = await this.supabase
      .from('source_mappings')
      .select('id, external_source, external_id, raw_item_id, entity_type, entity_id, mapping_type, confidence')
      .eq('external_source', externalSource)
      .eq('external_id', externalId)
      .eq('entity_type', entityType)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as SourceMappingRow | null;
  }

  async upsertSourceMapping(args: {
    externalSource: string;
    externalId: string;
    rawItemId: string | null;
    entityType: ImportEntityType;
    entityId: string;
    mappingType: MappingType;
    confidence?: number;
    existingMapping?: Pick<SourceMappingRow, 'id' | 'external_id' | 'entity_id' | 'mapping_type'> | null;
  }) {
    const existing =
      args.existingMapping ?? (await this.findSourceMapping(args.externalSource, args.externalId, args.entityType));
    if (existing?.mapping_type === 'manual' && args.mappingType !== 'manual') {
      return { mapping: existing as SourceMappingRow, preservedManual: true };
    }

    const { data, error } = await this.supabase
      .from('source_mappings')
      .upsert(
        {
          external_source: args.externalSource,
          external_id: args.externalId,
          raw_item_id: args.rawItemId,
          entity_type: args.entityType,
          entity_id: args.entityId,
          mapping_type: args.mappingType,
          confidence: args.confidence ?? 1,
        },
        { onConflict: 'external_source,external_id,entity_type' },
      )
      .select('id, external_source, external_id, raw_item_id, entity_type, entity_id, mapping_type, confidence')
      .single();

    if (error) {
      throw error;
    }

    return { mapping: data as SourceMappingRow, preservedManual: false };
  }

  async resolveOrCreateOffering(args: {
    termId: string;
    courseId: string;
    rawItemId: string;
    item: CanonicalOfferingImportItem;
  }) {
    const existingMapping = await this.findSourceMapping(SENSHU_SOURCE_CODE, args.item.externalId, 'course_offering');

    if (existingMapping) {
      const { data, error } = await this.supabase
        .from('course_offerings')
        .update({
          course_id: args.courseId,
          term_id: args.termId,
          instructor: args.item.instructor,
          canonical_url: args.item.canonicalUrl,
          syllabus_url: args.item.canonicalUrl,
          source_updated_at: args.item.sourceUpdatedAt,
          last_seen_at: new Date().toISOString(),
          is_active: true,
        })
        .eq('id', existingMapping.entity_id)
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      const mappingResult = await this.upsertSourceMapping({
        externalSource: SENSHU_SOURCE_CODE,
        externalId: args.item.externalId,
        rawItemId: args.rawItemId,
        entityType: 'course_offering',
        entityId: existingMapping.entity_id,
        mappingType: existingMapping.mapping_type,
        existingMapping,
      });

      return {
        offeringId: (data as OfferingRow).id,
        created: false,
        preservedManual: mappingResult.preservedManual,
      };
    }

    const { data, error } = await this.supabase
      .from('course_offerings')
      .insert({
        course_id: args.courseId,
        term_id: args.termId,
        instructor: args.item.instructor,
        canonical_url: args.item.canonicalUrl,
        syllabus_url: args.item.canonicalUrl,
        source_updated_at: args.item.sourceUpdatedAt,
        last_seen_at: new Date().toISOString(),
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    const offering = data as OfferingRow;
    await this.upsertSourceMapping({
      externalSource: SENSHU_SOURCE_CODE,
      externalId: args.item.externalId,
      rawItemId: args.rawItemId,
      entityType: 'course_offering',
      entityId: offering.id,
      mappingType: 'primary',
    });

    return {
      offeringId: offering.id,
      created: true,
      preservedManual: false,
    };
  }

  async syncOfferingSlots(args: {
    offeringId: string;
    rawItemId: string;
    slots: CanonicalSlotInput[];
  }) {
    const importedExternalIds = new Set(args.slots.map((slot) => slot.externalId));

    const { data: offeringSlotsData, error: offeringSlotsError } = await this.supabase
      .from('offering_slots')
      .select('id')
      .eq('offering_id', args.offeringId);

    if (offeringSlotsError) {
      throw offeringSlotsError;
    }

    const offeringSlotIds = ((offeringSlotsData ?? []) as Array<{ id: string }>).map((row) => row.id);

    const { data: existingMappingsData, error: existingMappingsError } = await this.supabase
      .from('source_mappings')
      .select('id, external_id, mapping_type, entity_id')
      .eq('external_source', SENSHU_SOURCE_CODE)
      .eq('entity_type', 'offering_slot')
      .in('entity_id', offeringSlotIds.length > 0 ? offeringSlotIds : ['00000000-0000-0000-0000-000000000000']);

    if (existingMappingsError) {
      throw existingMappingsError;
    }

    const staleMappings = (existingMappingsData ?? []) as ExistingSlotMapping[];
    const existingMappingsByExternalId = new Map(staleMappings.map((mapping) => [mapping.external_id, mapping]));

    let created = 0;
    let updated = 0;
    let deleted = 0;
    let preservedManual = 0;

    for (const slot of args.slots) {
      const existingMapping = existingMappingsByExternalId.get(slot.externalId);
      if (existingMapping) {
        const { error } = await this.supabase
          .from('offering_slots')
          .update({
            offering_id: args.offeringId,
            slot_kind: slot.slotKind,
            day_of_week: slot.dayOfWeek,
            period: slot.period,
            room: slot.room,
            raw_text: slot.rawText,
          })
          .eq('id', existingMapping.entity_id);

        if (error) {
          throw error;
        }

        const mappingResult = await this.upsertSourceMapping({
          externalSource: SENSHU_SOURCE_CODE,
          externalId: slot.externalId,
          rawItemId: args.rawItemId,
          entityType: 'offering_slot',
          entityId: existingMapping.entity_id,
          mappingType: existingMapping.mapping_type,
          existingMapping,
        });
        if (mappingResult.preservedManual) {
          preservedManual += 1;
        }
        updated += 1;
        continue;
      }

      const { data, error } = await this.supabase
        .from('offering_slots')
        .insert({
          offering_id: args.offeringId,
          slot_kind: slot.slotKind,
          day_of_week: slot.dayOfWeek,
          period: slot.period,
          room: slot.room,
          raw_text: slot.rawText,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      const inserted = data as OfferingSlotRow;
      await this.upsertSourceMapping({
        externalSource: SENSHU_SOURCE_CODE,
        externalId: slot.externalId,
        rawItemId: args.rawItemId,
        entityType: 'offering_slot',
        entityId: inserted.id,
        mappingType: 'primary',
      });

      created += 1;
    }

    for (const mapping of staleMappings) {
      if (importedExternalIds.has(mapping.external_id)) continue;
      if (mapping.mapping_type === 'manual') {
        preservedManual += 1;
        continue;
      }

      const { error: deleteSlotError } = await this.supabase
        .from('offering_slots')
        .delete()
        .eq('id', mapping.entity_id)
        .eq('offering_id', args.offeringId);

      if (deleteSlotError) {
        throw deleteSlotError;
      }

      const { error: deleteMappingError } = await this.supabase
        .from('source_mappings')
        .delete()
        .eq('id', mapping.id);

      if (deleteMappingError) {
        throw deleteMappingError;
      }

      deleted += 1;
    }

    return { created, updated, deleted, preservedManual };
  }

  async retireMissingOfferings(args: {
    universityId: string;
    academicYear: number;
    termCode: CanonicalTermCode | 'all';
    seenExternalIds: string[];
  }) {
    const { data: mappingData, error: mappingError } = await this.supabase
      .from('source_mappings')
      .select('external_id, entity_id, mapping_type')
      .eq('external_source', SENSHU_SOURCE_CODE)
      .eq('entity_type', 'course_offering');

    if (mappingError) {
      throw mappingError;
    }

    const mappings = (mappingData ?? []) as RetireMappingRow[];

    const candidateOfferingIds = mappings
      .filter((mapping) => mapping.mapping_type !== 'manual')
      .map((mapping) => mapping.entity_id);

    if (candidateOfferingIds.length === 0) {
      return 0;
    }

    const { data: offeringData, error: offeringError } = await this.supabase
      .from('course_offerings')
      .select('id, term_id')
      .in('id', candidateOfferingIds);

    if (offeringError) {
      throw offeringError;
    }

    const offerings = (offeringData ?? []) as RetireOfferingRow[];
    const termIds = Array.from(new Set(offerings.map((offering) => offering.term_id)));

    const { data: termData, error: termError } = await this.supabase
      .from('terms')
      .select('id, university_id, academic_year, code')
      .in('id', termIds);

    if (termError) {
      throw termError;
    }

    const staleOfferingIds = selectRetiredOfferingIds({
      mappings,
      offerings,
      terms: (termData ?? []) as RetireTermRow[],
      universityId: args.universityId,
      academicYear: args.academicYear,
      termCode: args.termCode,
      seenExternalIds: args.seenExternalIds,
    });

    if (staleOfferingIds.length === 0) {
      return 0;
    }

    const { error: updateError } = await this.supabase
      .from('course_offerings')
      .update({ is_active: false })
      .in('id', staleOfferingIds);

    if (updateError) {
      throw updateError;
    }

    return staleOfferingIds.length;
  }

  async upsertManualMapping(args: {
    externalSource: string;
    externalId: string;
    entityType: ImportEntityType;
    entityId: string;
  }) {
    const { mapping } = await this.upsertSourceMapping({
      externalSource: args.externalSource,
      externalId: args.externalId,
      rawItemId: null,
      entityType: args.entityType,
      entityId: args.entityId,
      mappingType: 'manual',
      confidence: 1,
    });

    return mapping;
  }

  async upsertCatalogCoverage(args: {
    universityId: string;
    termId: string;
    importSourceId: string;
    latestRunId: string;
    departmentLabels: string[];
  }) {
    const { data: existingData, error: existingError } = await this.supabase
      .from('offering_catalog_coverages')
      .select('coverage_kind, source_scope_labels')
      .eq('term_id', args.termId)
      .eq('import_source_id', args.importSourceId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const nextCoverage = resolveCatalogCoverage({
      existing: (existingData ?? null) as OfferingCatalogCoverageRow | null,
      departmentLabels: args.departmentLabels,
    });

    const { error } = await this.supabase
      .from('offering_catalog_coverages')
      .upsert(
        {
          university_id: args.universityId,
          term_id: args.termId,
          import_source_id: args.importSourceId,
          coverage_kind: nextCoverage.coverageKind,
          source_scope_labels: nextCoverage.sourceScopeLabels,
          latest_run_id: args.latestRunId,
        },
        { onConflict: 'term_id,import_source_id' },
      );

    if (error) {
      throw error;
    }
  }

  async deleteMapping(args: {
    externalSource: string;
    externalId: string;
    entityType: ImportEntityType;
  }) {
    const { error } = await this.supabase
      .from('source_mappings')
      .delete()
      .eq('external_source', args.externalSource)
      .eq('external_id', args.externalId)
      .eq('entity_type', args.entityType);

    if (error) {
      throw error;
    }
  }
}
