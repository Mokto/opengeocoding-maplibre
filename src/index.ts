import type {
	CarmenGeojsonFeature,
	MaplibreGeocoderApi,
	MaplibreGeocoderApiConfig,
	MaplibreGeocoderFeatureResults
} from '@maplibre/maplibre-gl-geocoder';

export interface GeocoderApiOptions {
	/** An OpenGeocoding browser key restricted to your site's origins. */
	apiKey: string;
	/** Defaults to https://api.opengeocoding.com/v1. */
	apiUrl?: string;
}

interface Address {
	displayName?: string;
	geoCoordinates?: {
		lat?: number;
		lon?: number;
		boundingBox?: { minLat?: number; minLon?: number; maxLat?: number; maxLon?: number };
	};
}

export type OpenGeocodingApi = Required<
	Pick<MaplibreGeocoderApi, 'forwardGeocode' | 'reverseGeocode' | 'getSuggestions' | 'searchByPlaceId'>
>;

// Protobuf JSON omits zero values, so a missing lat, lon or bound means 0.
function toFeatures(address: Address | undefined): CarmenGeojsonFeature[] {
	const c = address?.geoCoordinates;
	if (!c) return [];
	const center: [number, number] = [c.lon ?? 0, c.lat ?? 0];
	const b = c.boundingBox;
	const name = address!.displayName ?? '';
	return [
		{
			type: 'Feature',
			geometry: { type: 'Point', coordinates: center },
			center,
			bbox: b ? [b.minLon ?? 0, b.minLat ?? 0, b.maxLon ?? 0, b.maxLat ?? 0] : undefined,
			place_name: name,
			text: name,
			place_type: ['place'],
			properties: address as Record<string, unknown>
		}
	];
}

function featureCollection(features: CarmenGeojsonFeature[]): MaplibreGeocoderFeatureResults {
	return { type: 'FeatureCollection', features };
}

/**
 * Returns the `geocoderApi` object for `new MaplibreGeocoder(geocoderApi, options)`.
 * Pass `showResultsWhileTyping: true` in the control options, or autocomplete never runs.
 */
export function createGeocoderApi({
	apiKey,
	apiUrl = 'https://api.opengeocoding.com/v1'
}: GeocoderApiOptions): OpenGeocodingApi {
	if (!apiKey) throw new Error('createGeocoderApi needs an OpenGeocoding browser key: { apiKey }');

	async function call<T>(path: string, params: Record<string, unknown>): Promise<T> {
		const url = new URL(apiUrl.replace(/\/$/, '') + path);
		for (const [name, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
		}
		// The API rejects keys in the URL, so it must travel in a header.
		const response = await fetch(url, { headers: { 'x-api-key': apiKey } });
		const body = await response.json().catch(() => ({}));
		if (!response.ok) {
			throw new Error(body.message || `OpenGeocoding request failed with HTTP ${response.status}`);
		}
		return body as T;
	}

	return {
		async getSuggestions(config: MaplibreGeocoderApiConfig) {
			const countries = config.countries as unknown as string[] | string | undefined;
			const list = typeof countries === 'string' ? countries.split(/[\s,]+/) : countries;
			const { suggestions = [] } = await call<{
				suggestions?: { id: string; displayName: string }[];
			}>('/autocomplete', {
				text: config.query,
				limit: config.limit,
				countryCode: list?.length === 1 ? list[0] : undefined,
				'focus.lat': config.proximity?.[1],
				'focus.lon': config.proximity?.[0]
			});
			return { suggestions: suggestions.map((s) => ({ text: s.displayName, placeId: s.id })) };
		},

		async searchByPlaceId(config: MaplibreGeocoderApiConfig) {
			return { place: toFeatures(await call<Address>('/retrieve', { id: config.query })) };
		},

		async forwardGeocode(config: MaplibreGeocoderApiConfig) {
			return featureCollection(toFeatures(await call<Address>('/search', { addressString: config.query })));
		},

		async reverseGeocode(config: MaplibreGeocoderApiConfig) {
			const [lon, lat] = config.query as number[];
			const { results = [] } = await call<{ results?: { address?: Address }[] }>('/reverse', {
				lat,
				lon,
				size: config.limit
			});
			return featureCollection(results.flatMap((r) => toFeatures(r.address)));
		}
	};
}
