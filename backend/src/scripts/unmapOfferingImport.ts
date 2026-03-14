import { OfferingImportRepository, createSupabaseAdminClient } from './offerings-import/db';
import type { ImportEntityType } from './offerings-import/types';

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error(`${name} is required`);
  }
  return process.argv[index + 1];
}

async function main() {
  const externalSource = readArg('--external-source');
  const externalId = readArg('--external-id');
  const entityType = readArg('--entity-type') as ImportEntityType;

  const repo = new OfferingImportRepository(createSupabaseAdminClient());
  await repo.deleteMapping({
    externalSource,
    externalId,
    entityType,
  });

  console.log(JSON.stringify({ deleted: true, externalSource, externalId, entityType }, null, 2));
}

void main();
