/**
 * Idempotent seed: reads content/curriculum.json and upserts everything by slug.
 * Run after ANY curriculum edit: `npm run seed`
 *
 * - Existing items are updated in place (progress rows survive).
 * - Items removed from the JSON are NOT deleted — archive them in the DB
 *   (or add `"archived": true` in the JSON) so member progress never orphans.
 * - Everything the founder wants to change lives in the JSON, not in code.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

type ModuleDef = {
  slug: string; order: number; title: string; summary?: string;
  isBlocker?: boolean; assignment?: string; lens?: string | null;
  archived?: boolean; meta?: Record<string, unknown>;
  lessons?: { slug: string; title: string; body?: string; videoUrl?: string; order?: number; lens?: string | null }[];
};
type ShelfDef = { title: string; kind?: string; url?: string; lens?: string | null; order?: number };
type CampusDef = {
  slug: string; name: string; promise?: string; fastWin?: string;
  archived?: boolean; meta?: Record<string, unknown>;
  modules?: ModuleDef[]; shelf?: ShelfDef[];
};
type SchoolDef = {
  slug: string; name: string; tagline?: string; order?: number;
  campuses?: { campusSlug: string; order?: number; lens?: string | null; gating?: string }[];
};
type Curriculum = { schools: SchoolDef[]; campuses: CampusDef[] };

async function main() {
  const raw = fs.readFileSync(path.join(__dirname, "..", "content", "curriculum.json"), "utf-8");
  const data = JSON.parse(raw) as Curriculum;

  // 1. Campuses (with modules, lessons, assignments, shelf)
  for (const c of data.campuses) {
    const campus = await prisma.campus.upsert({
      where: { slug: c.slug },
      update: { name: c.name, promise: c.promise ?? null, fastWin: c.fastWin ?? null, archived: !!c.archived, meta: (c.meta ?? {}) as object },
      create: { slug: c.slug, name: c.name, promise: c.promise ?? null, fastWin: c.fastWin ?? null, archived: !!c.archived, meta: (c.meta ?? {}) as object },
    });

    for (const m of c.modules ?? []) {
      const mod = await prisma.module.upsert({
        where: { slug: m.slug },
        update: {
          campusId: campus.id, title: m.title, summary: m.summary ?? null,
          order: m.order, isBlocker: !!m.isBlocker, archived: !!m.archived,
          meta: ({ ...(m.meta ?? {}), ...(m.lens ? { lens: m.lens } : {}) }) as object,
        },
        create: {
          slug: m.slug, campusId: campus.id, title: m.title, summary: m.summary ?? null,
          order: m.order, isBlocker: !!m.isBlocker, archived: !!m.archived,
          meta: ({ ...(m.meta ?? {}), ...(m.lens ? { lens: m.lens } : {}) }) as object,
        },
      });

      // Assignment (optional, one per module)
      if (m.assignment) {
        await prisma.assignment.upsert({
          where: { moduleId: mod.id },
          update: { description: m.assignment },
          create: { moduleId: mod.id, description: m.assignment },
        });
      }

      // Lessons: if none defined yet, create a stub lesson so the player has
      // something to render — the founder fills body/videoUrl as he records.
      const lessons = m.lessons?.length
        ? m.lessons
        : [{ slug: `${m.slug}-main`, title: m.title, body: m.summary ?? "", order: 1 }];

      for (const l of lessons) {
        await prisma.lesson.upsert({
          where: { slug: l.slug },
          update: { moduleId: mod.id, title: l.title, body: l.body ?? null, videoUrl: l.videoUrl ?? null, order: l.order ?? 1, lens: l.lens ?? null },
          create: { slug: l.slug, moduleId: mod.id, title: l.title, body: l.body ?? null, videoUrl: l.videoUrl ?? null, order: l.order ?? 1, lens: l.lens ?? null },
        });
      }
    }

    // Shelf items: replace-by-campus (they carry no member state)
    if (c.shelf) {
      await prisma.shelfItem.deleteMany({ where: { campusId: campus.id } });
      let i = 0;
      for (const s of c.shelf) {
        await prisma.shelfItem.create({
          data: { campusId: campus.id, title: s.title, kind: s.kind ?? "template", url: s.url ?? null, lens: s.lens ?? null, order: s.order ?? ++i },
        });
      }
    }
  }

  // 2. Schools + campus links (order, lens, gating per school)
  for (const s of data.schools) {
    const school = await prisma.school.upsert({
      where: { slug: s.slug },
      update: { name: s.name, tagline: s.tagline ?? null, order: s.order ?? 0 },
      create: { slug: s.slug, name: s.name, tagline: s.tagline ?? null, order: s.order ?? 0 },
    });

    for (const link of s.campuses ?? []) {
      const campus = await prisma.campus.findUnique({ where: { slug: link.campusSlug } });
      if (!campus) { console.warn(`  ! school ${s.slug} references unknown campus ${link.campusSlug} — skipped`); continue; }
      await prisma.campusOnSchool.upsert({
        where: { schoolId_campusId: { schoolId: school.id, campusId: campus.id } },
        update: { order: link.order ?? 0, lens: link.lens ?? null, gating: link.gating ?? "sequential" },
        create: { schoolId: school.id, campusId: campus.id, order: link.order ?? 0, lens: link.lens ?? null, gating: link.gating ?? "sequential" },
      });
    }
  }

  console.log("Seed complete — curriculum synced from content/curriculum.json");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
