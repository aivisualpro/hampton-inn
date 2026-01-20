const mongoose = require('mongoose');
require('dotenv').config();

async function fixTransactionSources() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const Transaction = mongoose.model('Transaction', new mongoose.Schema({
        item: String,
        location: String,
        date: Date,
        source: String,
        relatedParentItem: String,
    }, { strict: false }));

    // Find child transactions with missing source
    const childTxns = await Transaction.find({
        relatedParentItem: { $exists: true },
        source: { $exists: false }
    });

    console.log(`Found ${childTxns.length} child transactions missing source.`);

    for (const child of childTxns) {
        // Find parent transaction (same date, location, item=relatedParentItem)
        // Using date range because dates might not differ? Actually date field should match EXACTLY if created in same batch
        // But date is strictly YYYY-MM-DD UTC usually.
        
        const parent = await Transaction.findOne({
            item: child.relatedParentItem,
            location: child.location,
            date: child.date,
            source: { $exists: true }
        });

        if (parent) {
            console.log(`Updating child ${child._id} with source: ${parent.source}`);
            child.source = parent.source;
            await child.save();
        } else {
            console.warn(`Parent not found for child ${child._id}, setting default to 'Stock Count' if counted > 0`);
            // Heuristic fallback
            if (child.get('countedUnit') > 0 || child.get('countedPackage') > 0) {
                 child.source = "Stock Count";
                 await child.save();
            } else if (child.get('purchasedUnit') > 0) {
                 child.source = "Stock Purchase";
                 await child.save();
            }
        }
    }

    console.log("Done.");
    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
  }
}

fixTransactionSources();
