// NC-8: lógica de clima extraída de EntradasSalidas.jsx a un hook propio.
// Antes, ese componente mezclaba: composición de UI + lógica de negocio de
// entradas/salidas + consulta a una API externa de clima — este hook aísla
// esa última responsabilidad, que no tiene nada que ver con el control de
// acceso en sí.
import { useEffect, useState } from 'react';

function obtenerIconoClima(code, hour) {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([95, 96, 99].includes(code)) return '🌩️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([1, 2, 3].includes(code)) return '⛅';
  if ([71, 73, 75, 85, 86].includes(code)) return '❄️';
  return (hour >= 18 || hour < 6) ? '🌙' : '☀️';
}

// Coordenadas por defecto (se usan si el usuario no da permiso de ubicación)
const LAT_DEFECTO = 4.6097;
const LON_DEFECTO = -74.0817;

export function useClima() {
  const [iconoClima, setIconoClima] = useState(null);
  const [temperatura, setTemperatura] = useState(null);

  useEffect(() => {
    const consultarClima = async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        if (!res.ok) return;
        const data = await res.json();
        const currentHour = new Date().getHours();
        if (data?.current_weather?.weathercode !== undefined) {
          setIconoClima(obtenerIconoClima(data.current_weather.weathercode, currentHour));
        }
        if (data?.current_weather?.temperature !== undefined) {
          setTemperatura(Math.round(data.current_weather.temperature));
        }
      } catch (err) {
        console.error('Error al obtener clima:', err);
      }
    };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => consultarClima(pos.coords.latitude, pos.coords.longitude),
        () => consultarClima(LAT_DEFECTO, LON_DEFECTO),
        { timeout: 4000 }
      );
    } else {
      consultarClima(LAT_DEFECTO, LON_DEFECTO);
    }
  }, []);

  return { iconoClima, temperatura };
}
