(async () => {
  const { db } = await import('../server/db');
  const { services } = await import('../shared/schema');
  const { inArray, sql } = await import('drizzle-orm');

  const serviceRows = await db
    .select({ id: services.id, name: services.name, price: services.priceRange })
    .from(services)
    .where(inArray(services.name, ['Showstopper', 'Paint Restoration']));

  console.log('=== Duplicate service check ===');
  console.table(serviceRows);

  const configRows = await db.execute(sql`
    SELECT google_review_url, facebook_review_url
    FROM tenant_config
    WHERE tenant_id = 'root'
  `);

  console.log('=== Review URLs ===');
  console.table(configRows.rows);

  process.exit(0);
})();
