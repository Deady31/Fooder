'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { Restaurant } from '../../data/mockRestaurants';
import { MAP_STYLE } from '../../lib/mapStyle';
import { stickerFor, stickerSrc } from '../../lib/stickers';
import { LatLng, toFeatureCollection } from './mapData';

export type LocateFailure = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'not-ready';
export type LocateResult = { ok: true; at: LatLng } | { ok: false; reason: LocateFailure };
export type MapStatus = 'loading' | 'ready' | 'error';

export interface MapViewHandle {
  locate: () => Promise<LocateResult>;
}

interface MapViewProps {
  /** Fiches à afficher (déjà filtrées par le mode Tous / Coups de cœur). */
  places: Restaurant[];
  likedIds: Set<string>;
  selectedId: string | null;
  /** Change quand il faut recadrer la vue sur les fiches affichées (changement de mode). */
  fitKey: string;
  onSelect: (id: string | null) => void;
  onStatus: (status: MapStatus) => void;
  /** Fin de déplacement : centre de la vue (pour « Chercher ici »). */
  onMoveEnd: (center: LatLng) => void;
  onReady: (handle: MapViewHandle | null) => void;
}

const TOULOUSE: [number, number] = [1.4442, 43.6047];
const SHEET_PADDING = 220;
const SOURCE = 'places';

function buildPin(rest: Restaurant): { wrapper: HTMLDivElement; pin: HTMLButtonElement } {
  const wrapper = document.createElement('div');
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'fooder-pin';
  pin.setAttribute('aria-label', rest.name);

  const body = document.createElement('span');
  body.className = 'fooder-pin-body';
  const img = document.createElement('img');
  img.src = stickerSrc(stickerFor(rest.cuisine, rest.id, rest.name));
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  body.appendChild(img);

  const tail = document.createElement('span');
  tail.className = 'fooder-pin-tail';

  pin.appendChild(body);
  pin.appendChild(tail);
  wrapper.appendChild(pin);
  return { wrapper, pin };
}

function buildCluster(count: number): { wrapper: HTMLDivElement; button: HTMLButtonElement } {
  const wrapper = document.createElement('div');
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', `${count} restaurants, zoomer`);
  button.textContent = String(count);
  const size = count >= 100 ? 58 : count >= 25 ? 50 : 44;
  button.style.cssText =
    `width:${size}px;height:${size}px;min-width:44px;min-height:44px;border-radius:9999px;` +
    'background:#FFD83D;color:#2B0F3A;border:3px solid #2B0F3A;box-shadow:3px 3px 0 #2B0F3A;' +
    'font:800 15px/1 var(--font-display, inherit);cursor:pointer;padding:0';
  wrapper.appendChild(button);
  return { wrapper, button };
}

export function MapView({ places, likedIds, selectedId, fitKey, onSelect, onStatus, onMoveEnd, onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const pinsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const meRef = useRef<Marker | null>(null);

  // Les rappels et données lues par les écouteurs MapLibre passent par une ref : l'init ne se refait jamais.
  const latest = useRef({ places, likedIds, selectedId, fitKey, onSelect, onStatus, onMoveEnd });
  latest.current = { places, likedIds, selectedId, fitKey, onSelect, onStatus, onMoveEnd };
  const placesById = useRef<Map<string, Restaurant>>(new Map());
  placesById.current = new Map(places.map(p => [p.id, p]));

  const stylePins = () => {
    const { likedIds: liked, selectedId: sel } = latest.current;
    pinsRef.current.forEach((pin, id) => {
      pin.classList.toggle('is-liked', liked.has(id));
      pin.classList.toggle('is-selected', id === sel);
    });
  };

  /** Dessine seulement ce qui est visible et non regroupé : le DOM reste léger même avec des centaines de fiches. */
  const syncMarkers = () => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !map.getSource(SOURCE)) return;
    const wanted = new Map<string, { lngLat: [number, number]; kind: 'pin' | 'cluster'; id: string | number; count?: number }>();
    for (const f of map.querySourceFeatures(SOURCE)) {
      if (f.geometry.type !== 'Point') continue;
      const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string };
      const lngLat = f.geometry.coordinates as [number, number];
      if (props.cluster && props.cluster_id !== undefined) {
        wanted.set(`c${props.cluster_id}`, { lngLat, kind: 'cluster', id: props.cluster_id, count: props.point_count });
      } else if (props.id) {
        wanted.set(`p${props.id}`, { lngLat, kind: 'pin', id: props.id });
      }
    }
    markersRef.current.forEach((marker, key) => {
      if (wanted.has(key)) return;
      marker.remove();
      markersRef.current.delete(key);
      if (key.startsWith('p')) pinsRef.current.delete(key.slice(1));
    });
    wanted.forEach((w, key) => {
      if (markersRef.current.has(key)) return;
      if (w.kind === 'cluster') {
        const { wrapper, button } = buildCluster(w.count ?? 0);
        button.addEventListener('click', e => {
          e.stopPropagation();
          const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
          source?.getClusterExpansionZoom(w.id as number).then(zoom => {
            map.easeTo({ center: w.lngLat, zoom: Math.min(zoom + 0.5, 18), duration: 500 });
          }).catch(() => undefined);
        });
        markersRef.current.set(key, new lib.Marker({ element: wrapper }).setLngLat(w.lngLat).addTo(map));
        return;
      }
      const rest = placesById.current.get(w.id as string);
      if (!rest) return;
      const { wrapper, pin } = buildPin(rest);
      pin.addEventListener('click', e => {
        e.stopPropagation();
        latest.current.onSelect(rest.id);
      });
      markersRef.current.set(key, new lib.Marker({ element: wrapper, anchor: 'bottom' }).setLngLat(w.lngLat).addTo(map));
      pinsRef.current.set(rest.id, pin);
    });
    stylePins();
  };

  const fitToPlaces = (duration: number) => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const pts = latest.current.places;
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.easeTo({ center: [pts[0].lng as number, pts[0].lat as number], zoom: 15, duration });
      return;
    }
    const bounds = new lib.LngLatBounds();
    pts.forEach(r => bounds.extend([r.lng as number, r.lat as number]));
    map.fitBounds(bounds, { padding: { top: 80, bottom: 90, left: 50, right: 50 }, maxZoom: 15, duration });
  };

  // Création de la carte : après le premier rendu de la page, jamais au chargement des autres onglets.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    const markers = markersRef.current;
    const pins = pinsRef.current;
    latest.current.onStatus('loading');

    const start = async () => {
      let lib: typeof import('maplibre-gl');
      try {
        lib = await import('maplibre-gl');
      } catch {
        if (!cancelled) latest.current.onStatus('error');
        return;
      }
      if (cancelled || !containerRef.current) return;
      libRef.current = lib;
      lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

      map = new lib.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: TOULOUSE,
        zoom: 13.4,
        minZoom: 10.5,
        maxZoom: 18,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 0,
      });
      map.touchZoomRotate.disableRotation();
      mapRef.current = map;
      const current = map;

      current.on('error', () => {
        // Les tuiles de fond peuvent échouer isolément ; seule l'absence de style rend la carte inutilisable.
        if (!current.isStyleLoaded() && !current.loaded()) latest.current.onStatus('error');
      });
      current.on('load', () => {
        current.addSource(SOURCE, {
          type: 'geojson',
          data: toFeatureCollection(latest.current.places),
          cluster: true,
          clusterRadius: 56,
          clusterMaxZoom: 14,
        });
        // Sans couche, MapLibre ne charge pas les tuiles de la source et querySourceFeatures reste vide.
        current.addLayer({ id: `${SOURCE}-hit`, type: 'circle', source: SOURCE, paint: { 'circle-radius': 1, 'circle-opacity': 0 } });
        current.on('sourcedata', e => {
          if (e.sourceId === SOURCE && current.isSourceLoaded(SOURCE)) syncMarkers();
        });
        current.on('moveend', () => {
          syncMarkers();
          const c = current.getCenter();
          latest.current.onMoveEnd({ lat: c.lat, lng: c.lng });
        });
        current.on('click', () => latest.current.onSelect(null));
        current.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        latest.current.onStatus('ready');
        fitToPlaces(0);
        syncMarkers();
      });

      onReady({
        locate: () =>
          new Promise<LocateResult>(resolve => {
            if (!mapRef.current || !libRef.current) return resolve({ ok: false, reason: 'not-ready' });
            if (!navigator.geolocation) return resolve({ ok: false, reason: 'unsupported' });
            navigator.geolocation.getCurrentPosition(
              pos => {
                const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const lngLat: [number, number] = [at.lng, at.lat];
                const m = mapRef.current;
                const l = libRef.current;
                if (!m || !l) return resolve({ ok: false, reason: 'not-ready' });
                if (!meRef.current) {
                  const dot = document.createElement('div');
                  dot.className = 'fooder-me';
                  meRef.current = new l.Marker({ element: dot }).setLngLat(lngLat).addTo(m);
                } else {
                  meRef.current.setLngLat(lngLat);
                }
                m.flyTo({ center: lngLat, zoom: 15, duration: 900, essential: true });
                resolve({ ok: true, at });
              },
              err => resolve({ ok: false, reason: err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable' }),
              { timeout: 8000, maximumAge: 60_000 }
            );
          }),
      });
    };

    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(() => void start(), { timeout: 600 }) : window.setTimeout(() => void start(), 120);

    return () => {
      cancelled = true;
      if (idle) (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
      else window.clearTimeout(handle);
      onReady(null);
      markers.forEach(m => m.remove());
      markers.clear();
      pins.clear();
      meRef.current = null;
      map?.remove();
      mapRef.current = null;
      libRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nouvelles fiches (filtre, recherche dans la zone, like/unlike) : on met à jour la source, pas la carte.
  useEffect(() => {
    const source = mapRef.current?.getSource(SOURCE) as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(places));
  }, [places]);

  useEffect(stylePins, [likedIds, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(SOURCE)) return;
    const rest = placesById.current.get(selectedId ?? '');
    if (rest && typeof rest.lat === 'number' && typeof rest.lng === 'number') {
      map.easeTo({
        center: [rest.lng, rest.lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: 650,
        padding: { top: 0, left: 0, right: 0, bottom: SHEET_PADDING },
      });
    } else {
      map.easeTo({ duration: 400, padding: { top: 0, left: 0, right: 0, bottom: 0 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    fitToPlaces(700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <div className='absolute inset-0'>
      <div ref={containerRef} className='w-full h-full' />
    </div>
  );
}
