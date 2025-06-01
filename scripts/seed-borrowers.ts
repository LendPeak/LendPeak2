import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';

// Borrower schema
const borrowerSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  ssn: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
  },
  employment: {
    employer: { type: String },
    position: { type: String },
    monthlyIncome: { type: Number },
    yearsEmployed: { type: Number },
  },
  creditScore: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Borrower = mongoose.model('Borrower', borrowerSchema);

// Generate sample borrowers
async function seedBorrowers() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lendpeak2';
  
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing borrowers
    await Borrower.deleteMany({});
    console.log('Cleared existing borrowers');

    // Generate borrowers
    const borrowers = [];
    const numBorrowers = 50;

    for (let i = 0; i < numBorrowers; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const state = faker.location.state({ abbreviated: true });
      
      borrowers.push({
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        phone: faker.phone.number('###-###-####'),
        ssn: faker.string.numeric('###-##-####'),
        dateOfBirth: faker.date.birthdate({ min: 21, max: 70, mode: 'age' }),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state,
          zipCode: faker.location.zipCode({ state }),
        },
        employment: {
          employer: faker.company.name(),
          position: faker.person.jobTitle(),
          monthlyIncome: faker.number.int({ min: 2000, max: 20000 }),
          yearsEmployed: faker.number.float({ min: 0.5, max: 20, precision: 0.1 }),
        },
        creditScore: faker.number.int({ min: 580, max: 850 }),
      });
    }

    // Insert borrowers
    const result = await Borrower.insertMany(borrowers);
    console.log(`Successfully seeded ${result.length} borrowers`);

    // Display some sample borrowers
    console.log('\nSample borrowers:');
    const samples = await Borrower.find().limit(5);
    samples.forEach((borrower) => {
      console.log(`- ${borrower.firstName} ${borrower.lastName} (${borrower.email})`);
    });

    // Close connection
    await mongoose.disconnect();
    console.log('\nDatabase seeding completed!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seeder
seedBorrowers();