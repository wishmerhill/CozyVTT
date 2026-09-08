/**
 * Map measurement + ambient lighting settings — End-to-End Tests
 *
 * Regression coverage for a bug where distanceUnit/distancePerSquare and
 * environmentType/ambientLightPreset/ambientColor/ambientOpacity appeared to
 * reset to defaults after saving: EditMapModal reopened showing Imperial /
 * Indoor / Pitch Black no matter what had been picked.
 *
 * The route code itself (create/update handlers, Prisma writes, the list/get
 * selects) was correct — the actual cause was environmental: the running
 * deployment's Prisma migrations were behind the schema, so the columns did
 * not exist server-side and every value silently fell back to its default.
 * These tests pin the wire contract (POST → GET → PUT → GET) so that class of
 * drift — schema field added but never reaching a served response — fails
 * here instead of only showing up as "my settings didn't save."
 *
 * Requires PostgreSQL at DATABASE_URL.
 */

import request from 'supertest';
import { createTestApp } from '../../__tests__/helpers/test-app';
import {
  prisma,
  createTestUser,
  createTestCampaign,
  cleanupUsers,
  cleanupCampaigns,
  TEST_PASSWORD,
} from '../../__tests__/helpers/db';

const app = createTestApp();

describe('map measurement + ambient lighting settings', () => {
  let dmId: string;
  let campaignId: string;
  let assetId: string;
  let dm: ReturnType<typeof request.agent>;

  const mapsUrl = () => `/api/campaigns/${campaignId}/maps`;

  beforeAll(async () => {
    const stamp = Date.now();
    const dmEmail = `map_ambient_dm_${stamp}@test.invalid`;

    dmId = (await createTestUser({ email: dmEmail, isApproved: true })).id;
    campaignId = (await createTestCampaign(dmId, { name: `Ambient Map Test ${stamp}` })).id;

    await prisma.campaignMembership.create({
      data: { campaignId, userId: dmId, role: 'DM', characterIds: [] },
    });

    const asset = await prisma.asset.create({
      data: {
        type: 'MAP',
        scope: 'CAMPAIGN',
        uploadedById: dmId,
        campaignId,
        filename: 'test-map.png',
        originalName: 'test-map.png',
        mimeType: 'image/png',
        fileSize: 1,
        filePath: `uploads/maps/campaigns/${campaignId}/test-map.png`,
        name: 'test-map.png',
        tags: [],
      },
    });
    assetId = asset.id;

    dm = request.agent(app);
    const res = await dm.post('/api/auth/login').send({ email: dmEmail, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });

  afterAll(async () => {
    await prisma.asset.deleteMany({ where: { id: assetId } });
    await cleanupCampaigns([campaignId]);
    await cleanupUsers([dmId]);
    await prisma.$disconnect();
  });

  it('persists non-default measurement and ambient settings through create, and returns them on GET', async () => {
    const created = await dm.post(mapsUrl()).send({
      name: 'Outdoor Day Map',
      imageUrl: assetId,
      width: 20,
      height: 20,
      distanceUnit: 'm',
      distancePerSquare: 1.5,
      environmentType: 'outdoor',
      ambientLightPreset: 'day',
      ambientColor: '#ffcc00',
      ambientOpacity: 0.4,
    });
    expect(created.status).toBe(201);
    expect(created.body.map).toMatchObject({
      distanceUnit: 'm',
      distancePerSquare: 1.5,
      environmentType: 'outdoor',
      ambientLightPreset: 'day',
      ambientColor: '#ffcc00',
      ambientOpacity: 0.4,
    });
    const mapId = created.body.map.id;

    // Straight to the DB — catches a route that answers correctly but never
    // actually wrote the columns (or wrote to the wrong ones).
    const row = await prisma.map.findUnique({ where: { id: mapId } });
    expect(row).toMatchObject({
      distanceUnit: 'm',
      distancePerSquare: 1.5,
      environmentType: 'outdoor',
      ambientLightPreset: 'day',
      ambientColor: '#ffcc00',
      ambientOpacity: 0.4,
    });

    // Reopening the map (what EditMapModal does) must see the same values,
    // not the indoor/pitch_black/ft defaults.
    const fetched = await dm.get(`${mapsUrl()}/${mapId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.map).toMatchObject({
      distanceUnit: 'm',
      distancePerSquare: 1.5,
      environmentType: 'outdoor',
      ambientLightPreset: 'day',
      ambientColor: '#ffcc00',
      ambientOpacity: 0.4,
    });
  });

  it('falls back to documented defaults when the fields are omitted on create', async () => {
    const created = await dm.post(mapsUrl()).send({
      name: 'Default Map',
      imageUrl: assetId,
      width: 10,
      height: 10,
    });
    expect(created.status).toBe(201);
    expect(created.body.map).toMatchObject({
      distanceUnit: 'ft',
      distancePerSquare: 5,
      environmentType: 'indoor',
      ambientLightPreset: 'pitch_black',
      ambientColor: null,
      ambientOpacity: 1,
    });
  });

  it('persists a change to every field through update, and a re-fetch sees it', async () => {
    const created = await dm.post(mapsUrl()).send({
      name: 'To Be Updated',
      imageUrl: assetId,
      width: 15,
      height: 15,
      distanceUnit: 'ft',
      distancePerSquare: 5,
      environmentType: 'indoor',
      ambientLightPreset: 'pitch_black',
    });
    expect(created.status).toBe(201);
    const mapId = created.body.map.id;

    const updated = await dm.put(`${mapsUrl()}/${mapId}`).send({
      distanceUnit: 'm',
      distancePerSquare: 1.5,
      environmentType: 'outdoor',
      ambientLightPreset: 'night',
      ambientColor: '#1a1a2e',
      ambientOpacity: 0.7,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.map).toMatchObject({
      distanceUnit: 'm',
      distancePerSquare: 1.5,
      environmentType: 'outdoor',
      ambientLightPreset: 'night',
      ambientColor: '#1a1a2e',
      ambientOpacity: 0.7,
    });

    const row = await prisma.map.findUnique({ where: { id: mapId } });
    expect(row).toMatchObject({
      distanceUnit: 'm',
      distancePerSquare: 1.5,
      environmentType: 'outdoor',
      ambientLightPreset: 'night',
      ambientColor: '#1a1a2e',
      ambientOpacity: 0.7,
    });

    const fetched = await dm.get(`${mapsUrl()}/${mapId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.map).toMatchObject({
      distanceUnit: 'm',
      distancePerSquare: 1.5,
      environmentType: 'outdoor',
      ambientLightPreset: 'night',
      ambientColor: '#1a1a2e',
      ambientOpacity: 0.7,
    });
  });

  it('rejects an invalid environmentType and leaves the stored map untouched', async () => {
    const created = await dm.post(mapsUrl()).send({
      name: 'Guarded Map',
      imageUrl: assetId,
      width: 10,
      height: 10,
      environmentType: 'outdoor',
    });
    const mapId = created.body.map.id;

    const res = await dm.put(`${mapsUrl()}/${mapId}`).send({ environmentType: 'space' });
    expect(res.status).toBe(400);

    const row = await prisma.map.findUnique({ where: { id: mapId } });
    expect(row?.environmentType).toBe('outdoor');
  });
});
