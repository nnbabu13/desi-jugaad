import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HostController } from "./host.controller";
import { HostService } from "./host.service";

@Module({
  // AuthModule exports the JWT guard used by the stats route.
  imports: [AuthModule],
  controllers: [HostController],
  providers: [HostService],
})
export class HostModule {}
