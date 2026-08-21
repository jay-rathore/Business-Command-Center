import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

/** Module-level permission check, e.g. @RequirePermission('sales:read'). */
export const RequirePermission = (code: string) => SetMetadata(PERMISSION_KEY, code);
