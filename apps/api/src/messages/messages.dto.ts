import { Transform } from "class-transformer";
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** `POST /messages/conversations` - open (or reuse) a thread on a listing. */
export class CreateConversationDto {
  @IsUUID()
  roomId!: string;
}

/** `POST /messages/:id` - send one message in an existing thread. */
export class SendMessageDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: "Message cannot be empty." })
  @MaxLength(4000)
  body!: string;
}
