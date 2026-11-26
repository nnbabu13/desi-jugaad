import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const toBool = ({ value }: { value: unknown }): unknown => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
};

const toNumber = ({ value }: { value: unknown }): unknown =>
  value === undefined || value === "" ? undefined : Number(value);

export class ListCountriesQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 300;
}

export class ListCitiesQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  launch?: boolean;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 500;
}

export class SearchLocationsQuery {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  q!: string;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
