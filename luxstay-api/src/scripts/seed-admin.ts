/**
 * Run with:  npx ts-node src/scripts/seed-admin.ts
 *
 * Creates the first Admin staff account so you can log in.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'luxstay',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('✅  Database connected');

  const staffRepo = AppDataSource.getRepository('staff');

  const existing = await staffRepo.findOne({
    where: { email: 'admin@luxstay.com' },
  });

  if (existing) {
    console.log('ℹ️   Admin already exists — skipping');
    await AppDataSource.destroy();
    return;
  }

  const hashed = await bcrypt.hash('admin123', 10);

  await staffRepo.save(
    staffRepo.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@luxstay.com',
      password: hashed,
      role: 'admin',
      propertyIds: [],
      isActive: true,
      hiredAt: new Date(),
      inviteStatus: 'accepted',
    }),
  );

  console.log('🌱  Admin seeded!');
  console.log('   Email:    admin@luxstay.com');
  console.log('   Password: admin123');
  console.log('   ⚠️  Change this password immediately in production!');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
