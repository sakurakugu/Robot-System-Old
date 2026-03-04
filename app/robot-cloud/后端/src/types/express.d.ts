import type { AuthContext } from '../modules/account/types';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export {};
