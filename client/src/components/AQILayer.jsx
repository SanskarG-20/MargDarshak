import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import safetyZones from "../data/safetyZones.json";

function aqiToColor(aqi) {
    if (aqi === 1) return "rgba(0, 200, 100, 0.35)";
    if (aqi === 2) return "rgba(180, 220, 0, 0.38)";
    if (aqi === 3) return "rgba(255, 165, 0, 0.40)";
    if (aqi === 4) return "rgba(220, 50, 50, 0.42)";
    return "rgba(150, 0, 200, 0.44)";
}

function aqiLabel(aqi) {
    if (aqi === 1) return "Good";
    if (aqi === 2) return "Satisfactory";
    if (aqi === 3) return "Moderate";
    if (aqi === 4) return "Poor";
    return "Very Poor";
}

function withPeakMultiplier(aqi, currentHour) {
    const peak = (currentHour >= 8 && currentHour <= 10) || (currentHour >= 18 && currentHour <= 21);
    const boosted = peak ? aqi * 1.3 : aqi;
    return Math.min(5, Math.max(1, Math.round(boosted)));
}

export default function AQILayer({ visible, currentHour }) {
    const map = useMap();
    const layerRef = useRef(null);

    useEffect(() => {
        if (!visible) {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
            return;
        }

        const radius = typeof window !== "undefined" && window.innerWidth < 768 ? 1200 : 1800;
        const group = L.layerGroup();

        safetyZones.forEach((zone) => {
            const effectiveAqi = withPeakMultiplier(zone.aqi || 3, currentHour);
            const circle = L.circle([zone.lat, zone.lng], {
                radius,
                color: "transparent",
                fillColor: aqiToColor(effectiveAqi),
                fillOpacity: 0.55,
                interactive: false,
            });

            const zoneName = zone.name || zone.area || "Unknown Zone";
            circle.bindTooltip(
                `<b>${zoneName}</b><br/>AQI: ${effectiveAqi} - ${aqiLabel(effectiveAqi)}<br/>Safety: ${zone.safetyScore}/10`,
                {
                    direction: "top",
                    permanent: false,
                    sticky: true,
                }
            );

            group.addLayer(circle);
        });

        group.addTo(map);
        layerRef.current = group;

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [visible, currentHour, map]);

    return null;
}
