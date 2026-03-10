// One-time script to set the Purchase Location flag in the database
// Run with: node scripts/set-purchase-location.js

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const locationsCollection = db.collection('locations');

  // First, clear any existing Purchase Location flag
  await locationsCollection.updateMany(
    { isPurchaseLocation: true },
    { $set: { isPurchaseLocation: false } }
  );
  console.log('Cleared existing Purchase Location flags');

  // Find and flag the "Purchase Location"
  const result = await locationsCollection.findOneAndUpdate(
    { name: { $regex: /^Purchase Location$/i } },
    { $set: { isPurchaseLocation: true } },
    { returnDocument: 'after' }
  );

  if (result) {
    console.log(`✅ Successfully set "${result.name}" as Purchase Location (ID: ${result._id})`);
  } else {
    // Create the Purchase Location if it doesn't exist
    const newLoc = await locationsCollection.insertOne({
      name: 'Purchase Location',
      description: 'Central purchase receiving location. All purchased stock arrives here before being transferred to other locations.',
      isPurchaseLocation: true,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅ Created new Purchase Location (ID: ${newLoc.insertedId})`);
  }

  await mongoose.disconnect();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
