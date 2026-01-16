import dbConnect from "./lib/db";
import User from "./models/User";
import Location from "./models/Location";

async function debug() {
  await dbConnect();
  
  const email = "admin@aivisualpro.com";
  const user = await User.findOne({ email });
  
  if (!user) {
    console.log("User not found");
    return;
  }
  
  console.log("User:", user.email);
  console.log("User Locations (raw):", user.locations);
  
  const locations = await Location.find({});
  console.log("All Locations Count:", locations.length);
  
  for (const loc of locations) {
    console.log("Location:", loc.name, "ID:", loc._id.toString());
    const match = user.locations.includes(loc._id.toString());
    console.log("  Matches user location?", match);
  }
  
  process.exit(0);
}

debug().catch(console.error);
