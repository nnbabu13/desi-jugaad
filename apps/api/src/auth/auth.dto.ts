import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsStrongPassword,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const PHONE_RE = /^\+?[0-9]{7,15}$/;

/** Terms acceptance is explicit and required (App Store review requirement). */
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsStrongPassword({
    minLength: 10,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 0,
    minUppercase: 0,
  })
  password!: string;

  @IsOptional()
  @Matches(PHONE_RE, {
    message: "phone must be digits, optionally starting with +, 7-15 long",
  })
  phone?: string;

  @IsBoolean()
  acceptTerms!: boolean;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}

export class RefreshDto {
  /**
   * Optional: the refresh token normally travels in an httpOnly cookie, but a
   * body value lets native clients (which have no cookie jar) refresh too.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken?: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;
}
