import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  // AuthModule exports the JWT guard used by the publish/own-list routes.
  imports: [AuthModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
