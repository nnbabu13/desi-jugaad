import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  // AuthModule exports the JWT guard used by the routes below.
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Exported so messaging can raise notifications.
  exports: [NotificationsService],
})
export class NotificationsModule {}
