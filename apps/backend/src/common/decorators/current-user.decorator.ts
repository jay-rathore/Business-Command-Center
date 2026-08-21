import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserData } from '../types/jwt-payload.interface';

/** @CurrentUser() for the full payload, or @CurrentUser('sub') for one field. */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: CurrentUserData | undefined = request.user;
    return data ? user?.[data] : user;
  },
);
