const mongoose = require('mongoose');
const User = require('../modules/users/user.model');
const { hashPassword } = require('../utils/password');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB:', MONGODB_URI);

    const email = 'admin@codearena.com';
    const password = 'AdminPass123!';
    const passwordHash = await hashPassword(password);

    const admin = await User.findOneAndUpdate(
      { email },
      {
        name: 'System Admin',
        email,
        passwordHash,
        role: 'ADMIN',
        isActive: true
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log('Admin user ready:');
    console.log('  Email:', admin.email);
    console.log('  Password:', password);
    console.log('  Role:', admin.role);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin user:', error);
    process.exit(1);
  }
}

seedAdmin();
