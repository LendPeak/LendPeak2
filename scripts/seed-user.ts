import mongoose from 'mongoose';
import { UserModel } from '../src/schemas/user.schema';
import { UserRole, UserStatus } from '../src/models/user.model';
import { config } from '../src/config';
import bcrypt from 'bcrypt';

async function seedUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: 'admin@lendpeak.com' });
    if (existingUser) {
      console.log('Test user already exists');
      process.exit(0);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await UserModel.create({
      email: 'admin@lendpeak.com',
      username: 'admin',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneNumber: '+1234567890',
      profile: {
        dateOfBirth: new Date('1990-01-01'),
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA'
        }
      }
    });

    console.log('Admin user created successfully:');
    console.log('Email: admin@lendpeak.com');
    console.log('Password: admin123');

    // Create regular user
    const userPassword = await bcrypt.hash('user123', 10);
    const regularUser = await UserModel.create({
      email: 'user@lendpeak.com',
      username: 'user',
      password: userPassword,
      firstName: 'Regular',
      lastName: 'User',
      roles: [UserRole.VIEWER],
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneNumber: '+1234567891',
      profile: {
        dateOfBirth: new Date('1995-05-15'),
        address: {
          street: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
          country: 'USA'
        }
      }
    });

    console.log('\nRegular user created successfully:');
    console.log('Email: user@lendpeak.com');
    console.log('Password: user123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUser();