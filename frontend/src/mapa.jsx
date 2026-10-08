import React, { useEffect } from 'react';
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';

function AjustarVista({ restaurantes, ruta }) {
  const map = useMap();

  useEffect(() => {
    if (ruta) {
      const puntosRuta = ruta.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      map.fitBounds(puntosRuta, { padding: [36, 36] });
      return;
    }

    const ubicaciones = restaurantes
      .filter((restaurant) => Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lon))
      .map((restaurant) => [restaurant.lat, restaurant.lon]);

    if (ubicaciones.length === 1) {
      map.setView(ubicaciones[0], 14);
    } else if (ubicaciones.length > 1) {
      map.fitBounds(ubicaciones, { padding: [32, 32], maxZoom: 14 });
    }
  }, [map, restaurantes, ruta]);

  return null;
}

function describirPaso(step) {
  const type = step.maneuver?.type;
  const modifiers = {
    left: 'a la izquierda',
    right: 'a la derecha',
    straight: 'recto',
    'slight left': 'ligeramente a la izquierda',
    'slight right': 'ligeramente a la derecha',
    'sharp left': 'cerrado a la izquierda',
    'sharp right': 'cerrado a la derecha',
    uturn: 'en U',
  };
  const modifier = modifiers[step.maneuver?.modifier];
  const road = step.name || 'la vía';

  if (type === 'depart') return `Sal hacia ${road}`;
  if (type === 'arrive') return 'Llegaste a tu destino';
  if (type === 'roundabout' || type === 'rotary') return `Entra a la glorieta${step.name ? ` en ${road}` : ''}`;
  if (modifier) return `Gira ${modifier} hacia ${road}`;
  return `Continúa por ${road}`;
}

export default function MiMapa({ restaurantes = [] }) {
  const posicion = [25.6866, -100.3161];
  const [ubicacion, setUbicacion] = useState(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState('');
  const [ruta, setRuta] = useState(null);
  const [restauranteRuta, setRestauranteRuta] = useState('');
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState('');

  function obtenerUbicacion(alObtenerUbicacion) {
    if (!navigator.geolocation) {
      setErrorUbicacion('Este navegador no permite obtener la ubicación.');
      return;
    }

    setBuscandoUbicacion(true);
    setErrorUbicacion('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nuevaUbicacion = [coords.latitude, coords.longitude];
        setUbicacion(nuevaUbicacion);
        setRuta(null);
        setBuscandoUbicacion(false);
        alObtenerUbicacion?.(nuevaUbicacion);
      },
      (error) => {
        setErrorUbicacion(
          error.code === error.PERMISSION_DENIED
            ? 'Permite el acceso a tu ubicación en el navegador para trazar la ruta.'
            : 'No pudimos obtener tu ubicación. Inténtalo de nuevo.',
        );
        setBuscandoUbicacion(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function trazarRuta(restaurant, origen = ubicacion) {
    if (!origen) {
      setErrorUbicacion('Primero selecciona “Usar mi ubicación”.');
      return;
    }

    setCalculandoRuta(true);
    setErrorRuta('');
    setRuta(null);
    setRestauranteRuta(restaurant.nombre);

    const coordinates = `${origen[1]},${origen[0]};${restaurant.lon},${restaurant.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok || data.code !== 'Ok' || !data.routes?.length) {
        throw new Error(data.message || 'No se encontró una ruta en auto para este restaurante.');
      }

      const route = data.routes[0];
      setRuta({
        geometry: route.geometry,
        distancia: (route.distance / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 }),
        duracion: Math.ceil(route.duration / 60),
        pasos: route.legs.flatMap((leg) => leg.steps).map((step) => ({
          instruccion: describirPaso(step),
          distancia: step.distance,
        })),
      });
    } catch (error) {
      setErrorRuta(error.message || 'No se pudo conectar con el servicio de rutas de OpenStreetMap.');
    } finally {
      setCalculandoRuta(false);
    }
  }

  return (
    <div className="osm-route-tool">
      <div className="map-route-controls">
        <button className="location-button" type="button" onClick={obtenerUbicacion} disabled={buscandoUbicacion}>
          {buscandoUbicacion ? 'Buscando ubicación...' : ubicacion ? 'Actualizar ubicación' : 'Usar mi ubicación'}
        </button>
        <span>{ubicacion ? 'Ubicación lista para trazar rutas en auto.' : 'La ubicación solo se usa al solicitar una ruta.'}</span>
      </div>
      {errorUbicacion && <p className="route-message" role="alert">{errorUbicacion}</p>}
      <MapContainer center={posicion} zoom={11} style={{ height: '500px', width: '100%' }}>
        <AjustarVista restaurantes={restaurantes} ruta={ruta} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {ubicacion && (
          <Marker position={ubicacion}>
            <Popup>Tu ubicación actual</Popup>
          </Marker>
        )}
        {ruta && <Polyline positions={ruta.geometry.coordinates.map(([lon, lat]) => [lat, lon])} color="#d96742" weight={5} />}
        {restaurantes.map((restaurant) => (
          <Marker position={[restaurant.lat, restaurant.lon]} key={restaurant.id}>
            <Popup>
              <strong>{restaurant.nombre}</strong>
              <br />
              {restaurant.municipio}
              {restaurant.distancia_km != null && <><br />A {restaurant.distancia_km} km</>}
              <button
                className="directions-button"
                type="button"
                disabled={buscandoUbicacion || calculandoRuta}
                onClick={() => {
                  if (ubicacion) {
                    trazarRuta(restaurant);
                  } else {
                    obtenerUbicacion((nuevaUbicacion) => trazarRuta(restaurant, nuevaUbicacion));
                  }
                }}
              >
                {buscandoUbicacion
                  ? 'Buscando ubicación...'
                  : calculandoRuta && restauranteRuta === restaurant.nombre
                  ? 'Trazando ruta...'
                  : ubicacion ? 'Cómo llegar en auto' : 'Activa tu ubicación para ver la ruta'}
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {errorRuta && <p className="route-message" role="alert">{errorRuta}</p>}
      {ruta && (
        <section className="route-details" aria-live="polite">
          <div className="route-details-heading">
            <div>
              <strong>Ruta a {restauranteRuta}</strong>
              <span>{ruta.distancia} km · {ruta.duracion} min aprox. · En auto</span>
            </div>
            <button type="button" onClick={() => setRuta(null)}>Quitar ruta</button>
          </div>
          <ol>
            {ruta.pasos.map((step, index) => (
              <li key={`${index}-${step.instruccion}`}>
                <span>{step.instruccion}</span>
                <small>{step.distancia >= 1000
                  ? `${(step.distancia / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`
                  : `${Math.round(step.distancia)} m`}</small>
              </li>
            ))}
          </ol>
          <small className="route-attribution">Rutas de OSRM sobre datos de OpenStreetMap.</small>
        </section>
      )}
    </div>
  );
}