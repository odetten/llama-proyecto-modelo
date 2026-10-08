import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

function AjustarVista({ restaurantes }) {
  const map = useMap();

  useEffect(() => {
    const ubicaciones = restaurantes
      .filter((restaurant) => Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lon))
      .map((restaurant) => [restaurant.lat, restaurant.lon]);

    if (ubicaciones.length === 1) {
      map.setView(ubicaciones[0], 14);
    } else if (ubicaciones.length > 1) {
      map.fitBounds(ubicaciones, { padding: [32, 32], maxZoom: 14 });
    }
  }, [map, restaurantes]);

  return null;
}

export default function MiMapa({ restaurantes = [] }) {
  const posicion = [25.6866, -100.3161];

  return (
    <MapContainer center={posicion} zoom={11} style={{ height: '500px', width: '100%' }}>
      <AjustarVista restaurantes={restaurantes} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      {restaurantes.map((restaurant) => (
        <Marker position={[restaurant.lat, restaurant.lon]} key={restaurant.id}>
          <Popup>
            <strong>{restaurant.nombre}</strong>
            <br />
            {restaurant.municipio}
            {restaurant.distancia_km != null && <><br />A {restaurant.distancia_km} km</>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}