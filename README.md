# @opengeocoding/maplibre-gl-geocoder

Address search and autocomplete for [MapLibre GL JS](https://maplibre.org/) maps, powered by [OpenGeocoding](https://opengeocoding.com). This package is the lookup adapter for the official [`@maplibre/maplibre-gl-geocoder`](https://github.com/maplibre/maplibre-gl-geocoder) control; it is not a fork of it.

| The visitor…                             | OpenGeocoding endpoint | Credits |
| ---------------------------------------- | ---------------------- | ------- |
| types; suggestions appear                | `/v1/autocomplete`     | free    |
| picks a suggestion                       | `/v1/retrieve`         | 1       |
| presses Enter without picking            | `/v1/search`           | 1       |
| types coordinates such as `55.68, 12.57` | `/v1/reverse`          | 1       |

There is a free plan; see [pricing](https://opengeocoding.com/pricing).

## Install

```sh
npm install maplibre-gl @maplibre/maplibre-gl-geocoder @opengeocoding/maplibre-gl-geocoder
```

## Usage

Create a **browser key** in the [OpenGeocoding dashboard](https://opengeocoding.com/dashboard) and list the origins of the pages that show the map, such as `https://www.example.com` or `http://localhost:5173`. A browser key is visible in your page's source and only works from those origins. Never put a secret server key in browser code.

```js
import maplibregl from 'maplibre-gl';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import { createGeocoderApi } from '@opengeocoding/maplibre-gl-geocoder';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';

const map = new maplibregl.Map({
	container: 'map',
	style: 'https://demotiles.maplibre.org/style.json',
	center: [12.57, 55.68],
	zoom: 11,
	attributionControl: {
		customAttribution:
			'Search data © <a href="https://opengeocoding.com/legal/attributions">OpenStreetMap contributors and others</a>'
	}
});

map.addControl(
	new MaplibreGeocoder(createGeocoderApi({ apiKey: 'og_your_browser_key' }), {
		maplibregl,
		showResultsWhileTyping: true,
		reverseGeocode: true
	}),
	'top-left'
);
```

`showResultsWhileTyping: true` is required: without it, the control only searches when Enter is pressed and autocomplete never runs. Suggestions near the visible map area rank higher once the map is zoomed in past level 9. Pass `countries: 'dk'` to the control to limit suggestions to one country.

### Without a bundler

```html
<script type="module">
	import { createGeocoderApi } from 'https://unpkg.com/@opengeocoding/maplibre-gl-geocoder';
	// maplibregl and MaplibreGeocoder loaded from their own <script> tags
	map.addControl(new MaplibreGeocoder(createGeocoderApi({ apiKey: 'og_your_browser_key' }), { maplibregl, showResultsWhileTyping: true }));
</script>
```

## Options

`createGeocoderApi({ apiKey, apiUrl })`

- `apiKey` (required): an OpenGeocoding browser key.
- `apiUrl`: defaults to `https://api.opengeocoding.com/v1`.

Errors from the API, such as an origin missing from the key or an exhausted credit balance, reject with the API's message and show as the control's error state. See the [error codes](https://opengeocoding.com/docs/errors).

## Data attribution

Results come from OpenStreetMap, Overture Maps, OpenAddresses, GeoNames and national address registers. Credit them wherever you show results; the `customAttribution` line above links to [the full list](https://opengeocoding.com/legal/attributions).

## Licence

This adapter is [MIT](LICENSE). The OpenGeocoding API is a hosted service under its [terms](https://opengeocoding.com/legal/terms).
