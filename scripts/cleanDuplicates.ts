(async () => {
  const { db } = await import('../server/db');
  const { services } = await import('../shared/schema');
  const { inArray } = await import('drizzle-orm');

  const deleted = await db.delete(services)
    .where(inArray(services.id, [78, 79]))
    .returning({ id: services.id, name: services.name });

  console.log('=== Deleted duplicate rows ===');
  console.table(deleted);

  const remaining = await db
    .select({ id: services.id, name: services.name, price: services.priceRange })
    .from(services)
    .where(inArray(services.name, ['Showstopper', 'Paint Restoration']));

  console.log('=== Remaining (should be exactly 2 rows) ===');
  console.table(remaining);

  process.exit(0);
})();
