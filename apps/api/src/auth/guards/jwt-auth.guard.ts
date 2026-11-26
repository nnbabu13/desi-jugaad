import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Requires a valid access token. Apply per-route with `@UseGuards`. */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
