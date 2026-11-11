'use client';

import { Loader } from '@googlemaps/js-api-loader';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface GoogleRestaurant {
  id: string;
  name: string;
  rating: number;
  priceLevel: number;
  distance: string;
  cuisine: string;
  image: string;
  address: string;
}

let placesService: google.maps.places.PlacesService | null = null;

export const initGooglePlaces = async (mapElement: HTMLDivElement) => {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const loader = new Loader({
    apiKey: GOOGLE_MAPS_API_KEY,
    version: 'weekly',
    libraries: ['places']
  });

  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Google Maps Loader timeout')), 10000));

  try {
    const google = await Promise.race([loader.load(), timeoutPromise]) as any;
    const map = new google.maps.Map(mapElement, {
      center: { lat: 43.6047, lng: 1.4442 }, // Toulouse
      zoom: 15
    });

    placesService = new google.maps.places.PlacesService(map);
    return google;
  } catch (err) {
    console.error('Failed to load Google Maps:', err);
    return null;
  }
};

export const fetchRestaurants = (lat: number, lng: number): Promise<google.maps.places.PlaceResult[]> => {
  return new Promise((resolve, reject) => {
    if (!placesService) return reject('Places service not initialized');

    const request: google.maps.places.PlaceSearchRequest = {
      location: { lat, lng },
      radius: 2000,
      type: 'restaurant'
    };

    placesService.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        resolve(results);
      } else {
        reject(status);
      }
    });
  });
};

export const getPlaceDetails = (placeId: string): Promise<google.maps.places.PlaceResult> => {
  return new Promise((resolve, reject) => {
    if (!placesService) return reject('Places service not initialized');

    placesService.getDetails({ placeId, fields: ['name', 'rating', 'user_ratings_total', 'formatted_address', 'photos', 'reviews', 'price_level', 'types', 'editorial_summary', 'website', 'url', 'opening_hours'] }, (result, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && result) {
        resolve(result);
      } else {
        reject(status);
      }
    });
  });
};