import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/platform/app.js';

describe('health and ready endpoints', () => {
  it('GET /api/health returns 200 without touching the database', async () => {
    const checkDb = vi.fn().mockRejectedValue(new Error('db down'));
    const res = await request(createApp({ checkDb })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(checkDb).not.toHaveBeenCalled();
  });

  it('GET /api/ready returns 200 when the database answers', async () => {
    const res = await request(createApp({ checkDb: async () => undefined })).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('GET /api/ready returns 503 with a generic body when the database fails', async () => {
    const checkDb = async () => {
      throw new Error('connect ECONNREFUSED postgresql://user:secretpw@db/cpms');
    };
    const res = await request(createApp({ checkDb })).get('/api/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: 'NOT_READY', message: 'Service is not ready.' } });
    expect(JSON.stringify(res.body)).not.toContain('secretpw');
  });

  it('returns a JSON 404 envelope for unknown routes', async () => {
    const res = await request(createApp({ checkDb: async () => undefined })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not advertise the framework', async () => {
    const res = await request(createApp({ checkDb: async () => undefined })).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
