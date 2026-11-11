'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { Restaurant } from '../../data/mockRestaurants';
import { MAP_STYLE } from '../../lib/mapStyle';
import { stickerFor, stickerSrc } from '../../lib/stickers';

export interface MapViewHandle {
  locate: () => Promise<boolean>;
}

interface MapViewProps {
  restaurants: Restaurant[];
  likedIds: Set<string>;
  selectedId: string | null;
  visibleIds: Set<string> | null;
  onSelect: (id: string | null) => void;
}

const TOULOUSE: [number, number] = [1.4442, 43.6047];
const CARD_PADDING = 190;

function buildPin(rest: Restaurant, index: number): { wrapper: HTMLDivElement; pin: HTMLButtonElement } {
  const wrapper = document.createElement('div');
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'fooder-pin';
  pin.setAttribute('aria-label', rest.name);
  pin.style.animationDelay = `${index * 80}ms`;

  const body = document.createElement('span');
  body.className = 'fooder-pin-body';
  const img = document.createElement('img');
  img.src = stickerSrc(stickerFor(rest.cuisine, rest.id, rest.name));
  img.alt = '';
  img.draggable = false;
  body.appendChild(img);

  const tail = document.createElement('span');
  tail.className = 'fooder-pin-tail';

  pin.appendChild(body);
  pin.appendChild(tail);
  wrapper.appendChild(pin);
  return { wrapper, pin };
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { restaurants, likedIds, selectedId, visibleIds, onSelect },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const meRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const mapLibreRef = useRef<typeof import('maplibre-gl') | null>(null);
  const latestRef = useRef({ likedIds, selectedId, visibleIds });
  latestRef.current = { likedIds, selectedId, visibleIds };

  useImperativeHandle(ref, () => ({
    locate: () =>
      new Promise<boolean>(resolve => {
        const map = mapRef.current;
        const lib = mapLibreRef.current;
        if (!map || !lib || !navigator.geolocation) return resolve(false);
        navigator.geolocation.getCurrentPosition(
          pos => {
            const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
            if (!meRef.current) {
              const dot = document.createElement('div');
              dot.className = 'fooder-me';
              meRef.current = new lib.Marker({ element: dot }).setLngLat(lngLat).addTo(map);
            } else {
              meRef.current.setLngLat(lngLat);
            }
            map.flyTo({ center: lngLat, zoom: 15, duration: 900, essential: true });
            resolve(true);
          },
          () => resolve(false),
          { timeout: 6000 }
        );
      }),
  }));

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    const pins = pinsRef.current;

    (async () => {
      const lib = await import('maplibre-gl');
      if (cancelled || !containerRef.current) return;
      mapLibreRef.current = lib;
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
      });
      map.touchZoomRotate.disableRotation();
      mapRef.current = map;
      map.on('error', e => console.error('[map]', e.error?.message ?? e));

      const located = restaurants.filter(r => typeof r.lat === 'number' && typeof r.lng === 'number');
      const bounds = new lib.LngLatBounds();

      located.forEach((rest, i) => {
        const { wrapper, pin } = buildPin(rest, i);
        pin.addEventListener('click', e => {
          e.stopPropagation();
          onSelectRef.current(rest.id);
        });
        new lib.Marker({ element: wrapper, anchor: 'bottom' }).setLngLat([rest.lng as number, rest.lat as number]).addTo(map as MapLibreMap);
        pins.set(rest.id, pin);
        bounds.extend([rest.lng as number, rest.lat as number]);
      });

      pins.forEach((pin, id) => {
        pin.classList.toggle('is-liked', latestRef.current.likedIds.has(id));
        pin.classList.toggle('is-selected', id === latestRef.current.selectedId);
        const vis = latestRef.current.visibleIds;
        if (pin.parentElement) pin.parentElement.style.display = vis && !vis.has(id) ? 'none' : '';
      });

      if (located.length > 1) {
        map.fitBounds(bounds, { padding: { top: 70, bottom: 90, left: 50, right: 50 }, maxZoom: 15, duration: 0 });
      }
      map.on('click', () => onSelectRef.current(null));
      map.once('load', () => {
        map?.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      });
    })();

    return () => {
      cancelled = true;
      pins.clear();
      meRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pinsRef.current.forEach((pin, id) => {
      pin.classList.toggle('is-liked', likedIds.has(id));
      pin.classList.toggle('is-selected', id === selectedId);
      if (pin.parentElement) pin.parentElement.style.display = visibleIds && !visibleIds.has(id) ? 'none' : '';
    });
  }, [likedIds, selectedId, visibleIds, restaurants]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const rest = restaurants.find(r => r.id === selectedId);
    if (rest && typeof rest.lat === 'number' && typeof rest.lng === 'number') {
      map.easeTo({
        center: [rest.lng, rest.lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: 650,
        padding: { top: 0, left: 0, right: 0, bottom: CARD_PADDING },
      });
    } else {
      map.easeTo({ duration: 400, padding: { top: 0, left: 0, right: 0, bottom: 0 } });
    }
  }, [selectedId, restaurants]);


  const visibleKey = visibleIds ? Array.from(visibleIds).sort().join(',') : 'all';
  useEffect(() => {
    const map = mapRef.current;
    const lib = mapLibreRef.current;
    if (!map || !lib) return;
    const pts = restaurants.filter(r => typeof r.lat === 'number' && typeof r.lng === 'number' && (!visibleIds || visibleIds.has(r.id)));
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.easeTo({ center: [pts[0].lng as number, pts[0].lat as number], zoom: 15, duration: 700 });
      return;
    }
    const bounds = new lib.LngLatBounds();
    pts.forEach(r => bounds.extend([r.lng as number, r.lat as number]));
    map.fitBounds(bounds, { padding: { top: 80, bottom: 90, left: 50, right: 50 }, maxZoom: 15, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  return (
    <div className='absolute inset-0'>
      <div ref={containerRef} className='w-full h-full' />
    </div>
  );
});
