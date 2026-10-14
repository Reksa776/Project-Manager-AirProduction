import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import type { Database } from "@/db";
import { packages } from "@/db/schema";
import type { CreatePackageInput } from "@/domain/inputs";
import type { Package } from "@/domain/types";
import type { CanonicalPackageRepository } from "@/repositories/contract";
import { RepositoryError, RepositoryNotFoundError } from "@/repositories/mysql/errors";
import { rowToPackage } from "@/repositories/mysql/canonical/mapping";

function requiredName(value: string): string {
  const name = value.trim();
  if (!name) throw new RepositoryError("Package name is required.");
  if (name.length > 120) throw new RepositoryError("Package name cannot exceed 120 characters.");
  return name;
}

function optionalDescription(value: string | undefined): string | null {
  const description = value?.trim();
  return description || null;
}

async function getPackage(db: Database, id: string): Promise<Package | null> {
  const rows = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  return rows[0] ? rowToPackage(rows[0]) : null;
}

async function create(db: Database, input: CreatePackageInput): Promise<Package> {
  const id = randomUUID();
  await db.insert(packages).values({
    id,
    name: requiredName(input.name),
    description: optionalDescription(input.description),
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  });
  const created = await getPackage(db, id);
  if (!created) throw new RepositoryError("Could not read the new package.");
  return created;
}

async function update(db: Database, id: string, input: CreatePackageInput): Promise<Package> {
  const existing = await getPackage(db, id);
  if (!existing) throw new RepositoryNotFoundError("packages", id);
  await db.update(packages).set({
    name: requiredName(input.name),
    description: optionalDescription(input.description),
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  }).where(eq(packages.id, id));
  const updated = await getPackage(db, id);
  if (!updated) throw new RepositoryError("Could not read the updated package.");
  return updated;
}

async function remove(db: Database, id: string): Promise<void> {
  const existing = await getPackage(db, id);
  if (!existing) throw new RepositoryNotFoundError("packages", id);
  await db.delete(packages).where(eq(packages.id, id));
}

export function createPackageRepository(resolveDb: () => Database): CanonicalPackageRepository {
  return {
    getAll: async () => (await resolveDb().select().from(packages)).map(rowToPackage),
    getById: (id) => getPackage(resolveDb(), id),
    create: (input) => create(resolveDb(), input),
    update: (id, input) => update(resolveDb(), id, input),
    delete: (id) => remove(resolveDb(), id),
  };
}
