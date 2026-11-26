import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ListCitiesQuery,
  ListCountriesQuery,
  SearchLocationsQuery,
} from "./geography.dto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class GeographyService {
  constructor(private readonly prisma: PrismaService) {}

  async listCountries(query: ListCountriesQuery) {
    const where: Prisma.CountryWhereInput = {
      isActive: true,
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { isoCode: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const countries = await this.prisma.country.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      take: query.limit,
      select: {
        id: true,
        isoCode: true,
        name: true,
        currencyCode: true,
        phoneCode: true,
        flagEmoji: true,
        isFeatured: true,
        _count: { select: { cities: { where: { isActive: true } } } },
      },
    });

    return {
      items: countries.map((c) => ({
        id: c.id,
        isoCode: c.isoCode,
        name: c.name,
        currencyCode: c.currencyCode,
        phoneCode: c.phoneCode,
        flagEmoji: c.flagEmoji,
        isFeatured: c.isFeatured,
        cityCount: c._count.cities,
      })),
      total: countries.length,
    };
  }

  async listCities(countryRef: string, query: ListCitiesQuery) {
    const country = await this.findCountry(countryRef);

    const where: Prisma.CityWhereInput = {
      countryId: country.id,
      isActive: true,
      ...(query.launch !== undefined ? { isLaunch: query.launch } : {}),
      ...(query.q
        ? { name: { contains: query.q, mode: "insensitive" } }
        : {}),
    };

    const cities = await this.prisma.city.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { isLaunch: "desc" }, { name: "asc" }],
      take: query.limit,
      select: {
        id: true,
        name: true,
        region: true,
        latitude: true,
        longitude: true,
        isLaunch: true,
        isFeatured: true,
      },
    });

    return {
      country: {
        id: country.id,
        isoCode: country.isoCode,
        name: country.name,
        currencyCode: country.currencyCode,
        phoneCode: country.phoneCode,
        flagEmoji: country.flagEmoji,
      },
      items: cities,
      total: cities.length,
    };
  }

  async searchLocations(query: SearchLocationsQuery) {
    const q = query.q.trim();
    if (!q) return { items: [], total: 0 };

    const [cities, countries] = await Promise.all([
      this.prisma.city.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: "insensitive" },
        },
        orderBy: [{ isLaunch: "desc" }, { isFeatured: "desc" }, { name: "asc" }],
        take: query.limit,
        select: {
          id: true,
          name: true,
          region: true,
          isLaunch: true,
          country: {
            select: { id: true, isoCode: true, name: true, flagEmoji: true },
          },
        },
      }),
      this.prisma.country.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { isoCode: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
        take: Math.min(query.limit, 5),
        select: {
          id: true,
          isoCode: true,
          name: true,
          flagEmoji: true,
          currencyCode: true,
        },
      }),
    ]);

    return {
      countries: countries.map((c) => ({
        type: "country" as const,
        id: c.id,
        isoCode: c.isoCode,
        name: c.name,
        flagEmoji: c.flagEmoji,
        currencyCode: c.currencyCode,
      })),
      cities: cities.map((c) => ({
        type: "city" as const,
        id: c.id,
        name: c.name,
        region: c.region,
        isLaunch: c.isLaunch,
        country: c.country,
      })),
      total: cities.length + countries.length,
    };
  }

  /** Accepts either a UUID or a 3-letter ISO code, which is what pickers send. */
  private async findCountry(ref: string) {
    const byId = UUID_RE.test(ref)
      ? await this.prisma.country.findUnique({ where: { id: ref } })
      : null;

    const country =
      byId ??
      (await this.prisma.country.findUnique({
        where: { isoCode: ref.toUpperCase() },
      }));

    if (!country) {
      throw new NotFoundException(`Country not found: ${ref}`);
    }
    return country;
  }
}
