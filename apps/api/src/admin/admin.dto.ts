import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Decision payloads for the listing review queue. */
export class RejectListingDto {
  /**
   * Required: a rejection the owner cannot act on is worse than no decision
   * at all. Shown verbatim on their listings screen so they know what to fix
   * before resubmitting.
   */
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
