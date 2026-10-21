import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createGeocoderApi } from './dist/index.js';

const realFetch = globalThis.fetch;
afterEach(() => (globalThis.fetch = realFetch));

function mockFetch(status, body) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		calls.push({ url: String(url), headers: init.headers });
		return { ok: status < 300, status, json: async () => (body instanceof Error ? Promise.reject(body) : body) };
	};
	return calls;
}

const address = {
	displayName: 'Rådhuspladsen 1, København',
	geoCoordinates: { lat: 55.6756, lon: 12.5696 }
};

test('requires an API key', () => {
	assert.throws(() => createGeocoderApi({}), /browser key/);
});

test('autocomplete sends the key in a header and maps suggestions to place IDs', async () => {
	const calls = mockFetch(200, { suggestions: [{ id: 'abc/p1', displayName: 'Rådhuspladsen 1' }] });
	const api = createGeocoderApi({ apiKey: 'og_browser' });
	const result = await api.getSuggestions({ query: 'Rådhus', limit: 5, countries: ['dk'], proximity: [12.5, 55.6] });
	assert.deepEqual(result, { suggestions: [{ text: 'Rådhuspladsen 1', placeId: 'abc/p1' }] });
	assert.equal(
		calls[0].url,
		'https://api.opengeocoding.com/v1/autocomplete?text=R%C3%A5dhus&limit=5&countryCode=dk&focus.lat=55.6&focus.lon=12.5'
	);
	assert.deepEqual(calls[0].headers, { 'x-api-key': 'og_browser' });
	assert.ok(!calls[0].url.includes('og_browser'));
});

test('several countries are not sent, since the API filters on one', async () => {
	const calls = mockFetch(200, {});
	await createGeocoderApi({ apiKey: 'k' }).getSuggestions({ query: 'x', countries: 'dk,se' });
	assert.equal(calls[0].url, 'https://api.opengeocoding.com/v1/autocomplete?text=x');
});

test('a picked suggestion is retrieved as a GeoJSON feature', async () => {
	const calls = mockFetch(200, address);
	const { place } = await createGeocoderApi({ apiKey: 'k' }).searchByPlaceId({ query: 'abc/p1' });
	assert.equal(calls[0].url, 'https://api.opengeocoding.com/v1/retrieve?id=abc%2Fp1');
	assert.equal(place.length, 1);
	assert.deepEqual(place[0].geometry, { type: 'Point', coordinates: [12.5696, 55.6756] });
	assert.equal(place[0].place_name, 'Rådhuspladsen 1, København');
	assert.equal(place[0].bbox, undefined);
});

test('search: empty object means no result; omitted zeros and bounding box are handled', async () => {
	mockFetch(200, {});
	const api = createGeocoderApi({ apiKey: 'k', apiUrl: 'https://example.test/v1/' });
	assert.deepEqual(await api.forwardGeocode({ query: 'nothing' }), { type: 'FeatureCollection', features: [] });

	const calls = mockFetch(200, {
		displayName: 'Gulf of Guinea',
		geoCoordinates: { lon: 1.5, boundingBox: { minLat: -2, maxLat: 2, maxLon: 4 } }
	});
	const { features } = await api.forwardGeocode({ query: 'Gulf of Guinea' });
	assert.equal(calls[0].url, 'https://example.test/v1/search?addressString=Gulf+of+Guinea');
	assert.deepEqual(features[0].center, [1.5, 0]);
	assert.deepEqual(features[0].bbox, [0, -2, 4, 2]);
});

test('reverse reads [lon, lat] and skips results without coordinates', async () => {
	const calls = mockFetch(200, { results: [{ address }, { address: { displayName: 'none' } }] });
	const { features } = await createGeocoderApi({ apiKey: 'k' }).reverseGeocode({ query: [12.5694, 55.6759], limit: 1 });
	assert.equal(calls[0].url, 'https://api.opengeocoding.com/v1/reverse?lat=55.6759&lon=12.5694&size=1');
	assert.equal(features.length, 1);
});

test('errors carry the API message, or the status when the body is not JSON', async () => {
	mockFetch(403, { code: 'permission_denied', message: 'This origin is not allowed for this browser key.' });
	await assert.rejects(createGeocoderApi({ apiKey: 'k' }).forwardGeocode({ query: 'x' }), /origin is not allowed/);
	mockFetch(502, new SyntaxError('Unexpected token <'));
	await assert.rejects(createGeocoderApi({ apiKey: 'k' }).forwardGeocode({ query: 'x' }), /HTTP 502/);
});
