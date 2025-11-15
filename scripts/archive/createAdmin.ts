import { db } from './db';
import { users } from '@shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

const SALT_ROUNDS = 10;

async function createAdminUser() {
  const username = 'admin';
  const password = 'admin123'; // Change this to a secure password
  const email = 'admin@cleanmachineautodetail.com';

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      console.log('Admin user already exists. Updating password...');
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Update existing user
      await db
        .update(users)
        .set({ 
          password: hashedPassword,
          email: email
        })
        .where(eq(users.username, username));
      
      console.log('✅ Admin password updated successfully');
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${password}`);
      console.log('   ⚠️  Change the default password after first login!');
    } else {
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Create new user
      await db.insert(users).values({
        username,
        password: hashedPassword,
        email,
      });
      
      console.log('✅ Admin user created successfully');
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${password}`);
      console.log(`   Email: ${email}`);
      console.log('   ⚠️  Change the default password after first login!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();
