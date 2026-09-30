import type { FastifyPluginAsync } from 'fastify';
import { CreateRecipeRequestSchema, UpdateRecipeRequestSchema } from '@rpa/types';
import {
  dbListRecipes,
  dbGetRecipe,
  dbCreateRecipe,
  dbUpdateRecipe,
  dbDeleteRecipe,
} from '../db/recipes.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validationError(issues: { path: (string | number)[]; message: string }[]) {
  return {
    error: 'Validation error',
    details: issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const recipesRoute: FastifyPluginAsync = async (fastify) => {
  // ── POST /api/recipes ───────────────────────────────────────────────────────
  fastify.post('/api/recipes', async (req, reply) => {
    const parsed = CreateRecipeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error.issues));
    }

    const recipe = await dbCreateRecipe(fastify.pg, parsed.data);
    return reply.status(201).send(recipe);
  });

  // ── GET /api/recipes ────────────────────────────────────────────────────────
  fastify.get('/api/recipes', async (_req, reply) => {
    const recipes = await dbListRecipes(fastify.pg);
    return reply.send(recipes);
  });

  // ── GET /api/recipes/:id ────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/api/recipes/:id',
    async (req, reply) => {
      const recipe = await dbGetRecipe(fastify.pg, req.params.id);
      if (!recipe) {
        return reply.status(404).send({ error: 'Recipe not found' });
      }
      return reply.send(recipe);
    },
  );

  // ── PUT /api/recipes/:id ────────────────────────────────────────────────────
  fastify.put<{ Params: { id: string } }>(
    '/api/recipes/:id',
    async (req, reply) => {
      const parsed = UpdateRecipeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send(validationError(parsed.error.issues));
      }

      const recipe = await dbUpdateRecipe(fastify.pg, req.params.id, parsed.data);
      if (!recipe) {
        return reply.status(404).send({ error: 'Recipe not found' });
      }
      return reply.send(recipe);
    },
  );

  // ── DELETE /api/recipes/:id ─────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/api/recipes/:id',
    async (req, reply) => {
      const deleted = await dbDeleteRecipe(fastify.pg, req.params.id);
      if (!deleted) {
        return reply.status(404).send({ error: 'Recipe not found' });
      }
      return reply.status(204).send();
    },
  );
};

export default recipesRoute;
