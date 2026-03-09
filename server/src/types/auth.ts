/**
 * Payload stored in JWT and attached to req.user by auth middleware.
 */
export interface AuthUser {
  id: string;
  email: string;
}
