import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ListCitiesQuery,
  ListCountriesQuery,
  SearchLocationsQuery,
} from "./geography.dto";
import { GeographyService } from "./geography.service";

/**
 * Public geography endpoints (Ui Plan, Part D).
 *
 * Paths deliberately match the published API spec:
 *   GET /countries
 *   GET /countries/:id/cities     (id = UUID or ISO-3166 alpha-2)
 *   GET /locations/search
 */
@Controller()
export class GeographyController {
  constructor(private readonly geography: GeographyService) {}

  @Get("countries")
  listCountries(@Query() query: ListCountriesQuery) {
    return this.geography.listCountries(query);
  }

  @Get("countries/:id/cities")
  listCities(@Param("id") id: string, @Query() query: ListCitiesQuery) {
    return this.geography.listCities(id, query);
  }

  @Get("locations/search")
  search(@Query() query: SearchLocationsQuery) {
    return this.geography.searchLocations(query);
  }
}
