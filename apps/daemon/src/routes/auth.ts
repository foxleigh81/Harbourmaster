/**
 * Authentication routes
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.js';
import { ErrorNormalizer } from '../lib/errors.js';

const loginSchema = z.object({
  password: z.string().min(1)
});

const authRoutes: FastifyPluginAsync = async (server) => {
  const authService = AuthService.getInstance();

  // Login endpoint
  server.post('/login', {
    handler: async (request, reply) => {
      try {
        const parsed = loginSchema.parse(request.body);
        const { password } = parsed;

        const result = await authService.login(password);

        return {
          success: true,
          data: result,
          requestId: request.id,
          timestamp: Date.now()
        };
      } catch (error) {
        const normalized = ErrorNormalizer.normalize(error, request.id);
        reply.code(401);
        return {
          success: false,
          ...normalized,
          timestamp: Date.now()
        };
      }
    }
  });
};

export default authRoutes;