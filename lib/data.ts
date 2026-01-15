
export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  locations: string[];
};

export type BundleItem = {
  itemRef: string;
  qty: number;
};

export type Item = {
  id: string;
  item: string;
  category: string;
  subCategory: string;
  cost: number;
  packSize: string;
  uom: string;
  bundle?: BundleItem[];
};

export const users: User[] = [
  {
    id: "u1",
    name: "Sarah Connors",
    email: "sarah.c@hamptoninn.com",
    phone: "+1 (555) 123-4567",
    role: "General Manager",
    locations: ["Downtown Branch", "Airport Branch"],
  },
  {
    id: "u2",
    name: "Mike Ross",
    email: "m.ross@hamptoninn.com",
    phone: "+1 (555) 987-6543",
    role: "Inventory Manager",
    locations: ["Downtown Branch"],
  },
  {
    id: "u3",
    name: "Jessica Pearson",
    email: "j.pearson@hamptoninn.com",
    phone: "+1 (555) 555-5555",
    role: "Admin",
    locations: ["All"],
  },
];

export const items: Item[] = [
  {
    id: "i1",
    item: "Cotton Bath Towel (White)",
    category: "Linens",
    subCategory: "Bath",
    cost: 12.50,
    packSize: "10/Pack",
    uom: "Pack",
    bundle: [],
  },
  {
    id: "i2",
    item: "Shampoo (50ml)",
    category: "Amenities",
    subCategory: "Toiletries",
    cost: 0.85,
    packSize: "100/Box",
    uom: "Box",
    bundle: [],
  },
  {
    id: "i3",
    item: "Welcome Kit Standard",
    category: "Amenities",
    subCategory: "Kits",
    cost: 5.00,
    packSize: "1",
    uom: "Unit",
    bundle: [
      { itemRef: "Shampoo (50ml)", qty: 2 },
      { itemRef: "Soap Bar", qty: 1 },
      { itemRef: "Comb", qty: 1 },
    ],
  },
  {
    id: "i4",
    item: "Bleach Generic",
    category: "Cleaning",
    subCategory: "Chemicals",
    cost: 15.00,
    packSize: "4 Gallons/Case",
    uom: "Case",
    bundle: [],
  },
];
