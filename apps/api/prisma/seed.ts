// ============================================================================
// Desi Jugaad - database seed
//
// Run with:  pnpm db:seed
//
// Guarantees (Prompt.md 14 & 19):
//   - Every seeded account/profile carries `demoData = true`, which the UI
//     renders as a "Sample" chip.
//   - No seeded record is ever given a VERIFIED status, so no demo account can
//     show a verified badge it did not earn.
//
// Idempotent: re-running upserts rather than duplicating.
// ============================================================================
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The workspace `.env` lives at the repository root; this script runs from
// apps/api. dotenv never overrides a value that is already set.
for (const candidate of [".env", "../../.env"]) {
  loadEnv({ path: path.resolve(process.cwd(), candidate) });
}

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Run `pnpm db:tunnel` first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type Seed = {
  iso: string;
  name: string;
  currency?: string;
  phone?: string;
  flag?: string;
  featured?: boolean;
  cities: { name: string; region?: string; launch?: boolean; featured?: boolean }[];
};

// Launch targets from the PRD, plus the corridors parcel assistance depends on.
const COUNTRIES: Seed[] = [
  {
    iso: "GB", name: "United Kingdom", currency: "GBP", phone: "+44", flag: "🇬🇧", featured: true,
    cities: [
      { name: "London", launch: true, featured: true },
      { name: "Birmingham", launch: true },
      { name: "Manchester", launch: true },
      { name: "Leeds" }, { name: "Glasgow" }, { name: "Edinburgh" },
      { name: "Leicester" }, { name: "Coventry" }, { name: "Nottingham" },
      { name: "Southampton" }, { name: "Reading" }, { name: "Bristol" },
    ],
  },
  {
    iso: "AE", name: "United Arab Emirates", currency: "AED", phone: "+971", flag: "🇦🇪", featured: true,
    cities: [
      { name: "Dubai", launch: true, featured: true },
      { name: "Abu Dhabi", launch: true },
      { name: "Sharjah" }, { name: "Ajman" }, { name: "Ras Al Khaimah" },
    ],
  },
  {
    iso: "CA", name: "Canada", currency: "CAD", phone: "+1", flag: "🇨🇦", featured: true,
    cities: [
      { name: "Toronto", launch: true, featured: true },
      { name: "Vancouver", launch: true },
      { name: "Montreal" }, { name: "Calgary" }, { name: "Ottawa" },
      { name: "Edmonton" }, { name: "Winnipeg" }, { name: "Mississauga" },
      { name: "Brampton" }, { name: "Surrey" },
    ],
  },
  {
    iso: "AU", name: "Australia", currency: "AUD", phone: "+61", flag: "🇦🇺", featured: true,
    cities: [
      { name: "Melbourne", launch: true, featured: true },
      { name: "Sydney", launch: true },
      { name: "Brisbane" }, { name: "Perth" }, { name: "Adelaide" },
      { name: "Canberra" }, { name: "Gold Coast" },
    ],
  },
  {
    iso: "US", name: "United States", currency: "USD", phone: "+1", flag: "🇺🇸", featured: true,
    cities: [
      { name: "New York", featured: true },
      { name: "San Francisco" }, { name: "San Jose" }, { name: "Seattle" },
      { name: "Chicago" }, { name: "Houston" }, { name: "Dallas" },
      { name: "Austin" }, { name: "Boston" }, { name: "Atlanta" },
      { name: "Detroit" }, { name: "Philadelphia" },
    ],
  },
  {
    iso: "IN", name: "India", currency: "INR", phone: "+91", flag: "🇮🇳", featured: true,
    cities: [
      { name: "Delhi", featured: true }, { name: "Mumbai", featured: true },
      { name: "Bengaluru" }, { name: "Hyderabad" }, { name: "Chennai" },
      { name: "Pune" }, { name: "Kolkata" }, { name: "Ahmedabad" },
      { name: "Chandigarh" }, { name: "Kochi" }, { name: "Jaipur" },
      { name: "Lucknow" }, { name: "Indore" }, { name: "Nagpur" },
    ],
  },
  {
    iso: "IE", name: "Ireland", currency: "EUR", phone: "+353", flag: "🇮🇪",
    cities: [{ name: "Dublin", featured: true }, { name: "Cork" }, { name: "Galway" }, { name: "Limerick" }],
  },
  {
    iso: "DE", name: "Germany", currency: "EUR", phone: "+49", flag: "🇩🇪",
    cities: [{ name: "Berlin" }, { name: "Munich" }, { name: "Frankfurt" }, { name: "Hamburg" }, { name: "Stuttgart" }],
  },
  {
    iso: "NL", name: "Netherlands", currency: "EUR", phone: "+31", flag: "🇳🇱",
    cities: [{ name: "Amsterdam" }, { name: "Rotterdam" }, { name: "The Hague" }, { name: "Utrecht" }],
  },
  {
    iso: "SG", name: "Singapore", currency: "SGD", phone: "+65", flag: "🇸🇬",
    cities: [{ name: "Singapore", featured: true }],
  },
  {
    iso: "NZ", name: "New Zealand", currency: "NZD", phone: "+64", flag: "🇳🇿",
    cities: [{ name: "Auckland" }, { name: "Wellington" }, { name: "Christchurch" }],
  },
  {
    iso: "SA", name: "Saudi Arabia", currency: "SAR", phone: "+966", flag: "🇸🇦",
    cities: [{ name: "Riyadh" }, { name: "Jeddah" }, { name: "Dammam" }],
  },
  {
    iso: "QA", name: "Qatar", currency: "QAR", phone: "+974", flag: "🇶🇦",
    cities: [{ name: "Doha", featured: true }],
  },
  {
    iso: "OM", name: "Oman", currency: "OMR", phone: "+968", flag: "🇴🇲",
    cities: [{ name: "Muscat" }],
  },
  {
    iso: "KW", name: "Kuwait", currency: "KWD", phone: "+965", flag: "🇰🇼",
    cities: [{ name: "Kuwait City" }],
  },
  {
    iso: "BH", name: "Bahrain", currency: "BHD", phone: "+973", flag: "🇧🇭",
    cities: [{ name: "Manama" }],
  },
  {
    iso: "MY", name: "Malaysia", currency: "MYR", phone: "+60", flag: "🇲🇾",
    cities: [{ name: "Kuala Lumpur" }, { name: "Penang" }, { name: "Johor Bahru" }],
  },
  {
    iso: "IT", name: "Italy", currency: "EUR", phone: "+39", flag: "🇮🇹",
    cities: [{ name: "Milan" }, { name: "Rome" }, { name: "Turin" }],
  },
  {
    iso: "FR", name: "France", currency: "EUR", phone: "+33", flag: "🇫🇷",
    cities: [{ name: "Paris" }, { name: "Lyon" }, { name: "Toulouse" }],
  },
  {
    iso: "ES", name: "Spain", currency: "EUR", phone: "+34", flag: "🇪🇸",
    cities: [{ name: "Madrid" }, { name: "Barcelona" }],
  },
  {
    iso: "SE", name: "Sweden", currency: "SEK", phone: "+46", flag: "🇸🇪",
    cities: [{ name: "Stockholm" }, { name: "Gothenburg" }],
  },
  {
    iso: "CH", name: "Switzerland", currency: "CHF", phone: "+41", flag: "🇨🇭",
    cities: [{ name: "Zurich" }, { name: "Geneva" }],
  },
  {
    iso: "JP", name: "Japan", currency: "JPY", phone: "+81", flag: "🇯🇵",
    cities: [{ name: "Tokyo" }, { name: "Osaka" }],
  },
  {
    iso: "KE", name: "Kenya", currency: "KES", phone: "+254", flag: "🇰🇪",
    cities: [{ name: "Nairobi" }],
  },
  {
    iso: "ZA", name: "South Africa", currency: "ZAR", phone: "+27", flag: "🇿🇦",
    cities: [{ name: "Johannesburg" }, { name: "Cape Town" }, { name: "Durban" }],
  },
  {
    iso: "TT", name: "Trinidad and Tobago", currency: "TTD", phone: "+1", flag: "🇹🇹",
    cities: [{ name: "Port of Spain" }],
  },
  {
    iso: "FJ", name: "Fiji", currency: "FJD", phone: "+679", flag: "🇫🇯",
    cities: [{ name: "Suva" }],
  },
];

const DEMO_USERS = [
  {
    email: "aarav.sharma@sample.desijugaad.dev",
    fullName: "Aarav Sharma",
    city: "London",
    country: "GB",
    lifeStage: "living_abroad",
    bio: "Software engineer in London since 2021. Happy to help with flat-hunting tips.",
    languages: ["English", "Hindi", "Punjabi"],
  },
  {
    email: "priya.nair@sample.desijugaad.dev",
    fullName: "Priya Nair",
    city: "Toronto",
    country: "CA",
    lifeStage: "student_abroad",
    bio: "MSc student in Toronto. Looking for a quiet shared flat near the subway.",
    languages: ["English", "Malayalam", "Hindi"],
  },
  {
    email: "rajesh.iyer@sample.desijugaad.dev",
    fullName: "Rajesh Iyer",
    city: "Dubai",
    country: "AE",
    lifeStage: "living_abroad",
    bio: "Chartered accountant in Dubai. I travel to Bengaluru every quarter.",
    languages: ["English", "Tamil", "Hindi"],
  },
] as const;

async function seedGeography(): Promise<void> {
  let countryCount = 0;
  let cityCount = 0;

  for (const c of COUNTRIES) {
    const country = await prisma.country.upsert({
      where: { isoCode: c.iso },
      update: {
        name: c.name,
        currencyCode: c.currency ?? null,
        phoneCode: c.phone ?? null,
        flagEmoji: c.flag ?? null,
        isFeatured: c.featured ?? false,
      },
      create: {
        isoCode: c.iso,
        name: c.name,
        currencyCode: c.currency ?? null,
        phoneCode: c.phone ?? null,
        flagEmoji: c.flag ?? null,
        isFeatured: c.featured ?? false,
      },
    });
    countryCount++;

    for (const city of c.cities) {
      await prisma.city.upsert({
        where: { countryId_name: { countryId: country.id, name: city.name } },
        update: {
          region: city.region ?? null,
          isLaunch: city.launch ?? false,
          isFeatured: city.featured ?? false,
        },
        create: {
          countryId: country.id,
          name: city.name,
          region: city.region ?? null,
          isLaunch: city.launch ?? false,
          isFeatured: city.featured ?? false,
        },
      });
      cityCount++;
    }
  }

  console.log(`Geography: ${countryCount} countries, ${cityCount} cities`);
}

async function seedDemoUsers(): Promise<void> {
  let created = 0;

  for (const d of DEMO_USERS) {
    const country = await prisma.country.findUnique({ where: { isoCode: d.country } });
    if (!country) throw new Error(`Seed country missing: ${d.country}`);
    const city = await prisma.city.findFirst({
      where: { countryId: country.id, name: d.city },
    });
    if (!city) throw new Error(`Seed city missing: ${d.city}`);

    // No passwordHash: these accounts are not login targets. They exist so the
    // community and listing feeds have believable sample content.
    const user = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
        authProvider: "EMAIL",
        // Deliberately PENDING_VERIFICATION and unverified: a seeded account
        // must never present a verified badge (Prompt.md 14).
        status: "PENDING_VERIFICATION",
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        fullName: d.fullName,
        bio: d.bio,
        lifeStage: d.lifeStage,
        languages: [...d.languages],
        currentCountryId: country.id,
        currentCityId: city.id,
        profileVisibility: "public",
        // The UI must render these as sample content.
        demoData: true,
      },
    });

    created++;
  }

  console.log(`Demo accounts: ${created} (all demoData=true, none verified)`);
}

// ---------------------------------------------------------------------------
// Sample listings
//
// Guarantees (Prompt.md 3, 14 & 19):
//   - `demoData = true` so the UI shows a "Sample" chip, never a badge.
//   - `area` is a neighbourhood label only - exact addresses are never stored.
//   - Rates are monthly asking prices (Prompt.md 4 & 12); people arrange the
//     stay by chatting with the host, so nothing is prorated or charged.
//   - Photos are live public CDN URLs verified to resolve.
// ---------------------------------------------------------------------------

type SeedRoom = {
  hostEmail: string;
  country: string;
  city: string;
  title: string;
  description: string;
  accommodationType: string;
  furnished: string;
  rent: number;
  area: string;
  rooms: number;
  photos: string[];
};

const DEMO_ROOMS: SeedRoom[] = [
  {
    hostEmail: "aarav.sharma@sample.desijugaad.dev",
    country: "GB",
    city: "London",
    title: "Sunny single room in a shared flat",
    description:
      "Bright single room in a friendly two-bed flat. Ten-minute walk to the Overground, shared kitchen and living room, fast Wi-Fi. Neighbourhood: Brick Lane area.",
    accommodationType: "room_shared",
    furnished: "furnished",
    rent: 1350,
    area: "Brick Lane area",
    rooms: 2,
    photos: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=70",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=70",
    ],
  },
  {
    hostEmail: "aarav.sharma@sample.desijugaad.dev",
    country: "GB",
    city: "London",
    title: "Quiet studio near the DLR",
    description:
      "Self-contained studio with a double bed, kitchenette and desk. Suits one person who works from home. Neighbourhood: Isle of Dogs area.",
    accommodationType: "studio",
    furnished: "furnished",
    rent: 1860,
    area: "Isle of Dogs area",
    rooms: 1,
    photos: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=70",
      "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=70",
    ],
  },
  {
    hostEmail: "priya.nair@sample.desijugaad.dev",
    country: "CA",
    city: "Toronto",
    title: "Room in a student shared flat",
    description:
      "One of three rooms in a quiet flat close to the subway and groceries. Shared bathroom, communal kitchen, laundry in building. Neighbourhood: Scarborough area.",
    accommodationType: "room_shared",
    furnished: "part_furnished",
    rent: 1560,
    area: "Scarborough area",
    rooms: 3,
    photos: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=70",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=70",
    ],
  },
  {
    hostEmail: "priya.nair@sample.desijugaad.dev",
    country: "CA",
    city: "Toronto",
    title: "Private room with ensuite bathroom",
    description:
      "Large private room with its own bathroom in a family home. Bus at the door, twenty minutes to downtown. Neighbourhood: North York area.",
    accommodationType: "room_private",
    furnished: "furnished",
    rent: 2040,
    area: "North York area",
    rooms: 1,
    photos: [
      "https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?w=800&q=70",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=70",
    ],
  },
  {
    hostEmail: "rajesh.iyer@sample.desijugaad.dev",
    country: "AE",
    city: "Dubai",
    title: "Furnished room in a Marina flat",
    description:
      "Furnished room in a high-floor flat with shared balcony and gym access. Metro and beach within walking distance. Neighbourhood: Dubai Marina area.",
    accommodationType: "room_private",
    furnished: "furnished",
    rent: 5700,
    area: "Dubai Marina area",
    rooms: 2,
    photos: [
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=70",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=70",
    ],
  },
  {
    hostEmail: "rajesh.iyer@sample.desijugaad.dev",
    country: "AE",
    city: "Dubai",
    title: "Entire studio, Sports City",
    description:
      "Compact entire studio with kitchenette, ideal for one or two people. Covered parking and pool. Neighbourhood: Dubai Sports City area.",
    accommodationType: "studio",
    furnished: "furnished",
    rent: 7200,
    area: "Dubai Sports City area",
    rooms: 1,
    photos: [
      "https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800&q=70",
      "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&q=70",
    ],
  },
];

async function seedRooms(): Promise<void> {
  let count = 0;

  for (const r of DEMO_ROOMS) {
    const host = await prisma.user.findUnique({
      where: { email: r.hostEmail },
      select: { id: true },
    });
    if (!host) throw new Error(`Seed host missing: ${r.hostEmail}`);

    const country = await prisma.country.findUnique({
      where: { isoCode: r.country },
      select: { id: true, currencyCode: true },
    });
    if (!country) throw new Error(`Seed country missing: ${r.country}`);

    const city = await prisma.city.findFirst({
      where: { countryId: country.id, name: r.city },
      select: { id: true },
    });
    if (!city) throw new Error(`Seed city missing: ${r.city}`);

    const data = {
      hostId: host.id,
      cityId: city.id,
      title: r.title,
      description: r.description,
      accommodationType: r.accommodationType,
      furnished: r.furnished,
      rent: r.rent,
      currency: country.currencyCode ?? "GBP",
      // Neighbourhood label only - never an exact address (Prompt.md 3).
      area: r.area,
      rooms: r.rooms,
      photos: [...r.photos],
      status: "ACTIVE" as const,
      // Sample content: the UI shows a "Sample" chip, never a badge.
      demoData: true,
    };

    // Room has no natural unique key, so match on host + title to stay
    // idempotent across re-runs.
    const existing = await prisma.room.findFirst({
      where: { hostId: host.id, title: r.title },
      select: { id: true },
    });
    if (existing) {
      await prisma.room.update({ where: { id: existing.id }, data });
    } else {
      await prisma.room.create({ data });
    }
    count++;
  }

  console.log(
    `Sample rooms: ${count} (all demoData=true, ACTIVE, neighbourhood-only)`,
  );
}

async function main(): Promise<void> {
  console.log("Seeding Desi Jugaad ...");
  await seedGeography();
  await seedDemoUsers();
  await seedRooms();

  const [countries, cities, users, profiles, rooms] = await Promise.all([
    prisma.country.count(),
    prisma.city.count(),
    prisma.user.count(),
    prisma.userProfile.count(),
    prisma.room.count(),
  ]);
  console.log(
    `Totals -> countries: ${countries}, cities: ${cities}, users: ${users}, profiles: ${profiles}, rooms: ${rooms}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
