import { NotificationType } from '@internal-tech-solutions/sig-dynamo-factory';
import { TextEncoder } from 'util';

export class PostDataFactory {
  public static buildMessage(action: NotificationType, data: unknown) {
    return new TextEncoder().encode(
      JSON.stringify({
        action,
        data,
      }),
    );
  }
}
