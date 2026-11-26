import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  // AuthModule exports the JWT guards used by the routes below.
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
