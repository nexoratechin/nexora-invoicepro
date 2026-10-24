import type { AuthContext } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Set by requireAuth. Optional on the type so a route that forgot the
       * middleware has to go through getAuth and fail loudly at runtime.
       */
      auth?: AuthContext;
    }
  }
}

export {};
