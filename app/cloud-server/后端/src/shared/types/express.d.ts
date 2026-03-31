import type { AuthContext } from '../features/account/types';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export { };

