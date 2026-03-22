import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { Y } from "../constants/theme";

const CATEGORY_LABELS = {
    road_hazard: "Road Hazard",
    poor_lighting: "Poor Lighting",
    flooding: "Flooding",
    unsafe_area: "Unsafe Area",
    traffic_accident: "Traffic Accident",
    other: "Other",
};

function severityColor(severity) {
    if (severity === 1) return "#FFC107";
    if (severity === 3) return "#F44336";
    return "#FF5722";
}

function severityLabel(severity) {
    if (severity === 1) return "Low";
    if (severity === 3) return "High";
    return "Medium";
}

function timeAgo(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.max(1, Math.floor(ms / 60000));
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} day ago`;
}

function expiresIn(iso) {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const mins = Math.ceil(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.ceil(mins / 60);
    return `${hrs} hr`;
}

function reportIcon(severity) {
    return L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${severityColor(severity)};border:2px solid #fff;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });
}

const previewIcon = L.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${Y};border:2px solid #fff;box-shadow:0 0 10px rgba(204,255,0,.65);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

export default function SafetyReportLayer({
    reports,
    currentUserId,
    onDelete,
    onMapClick,
    previewLocation,
    showPreview,
}) {
    const map = useMap();
    const reportsLayerRef = useRef(null);
    const previewRef = useRef(null);

    useEffect(() => {
        const handleMapClick = (e) => {
            onMapClick?.(e.latlng);
        };

        map.on("click", handleMapClick);
        return () => {
            map.off("click", handleMapClick);
        };
    }, [map, onMapClick]);

    useEffect(() => {
        if (reportsLayerRef.current) {
            map.removeLayer(reportsLayerRef.current);
            reportsLayerRef.current = null;
        }

        const group = L.layerGroup();

        (reports || []).forEach((report) => {
            const marker = L.marker([report.lat, report.lng], {
                icon: reportIcon(report.severity),
            });

            const owner = currentUserId && report.user_id === currentUserId;
            const popupHtml = `<div style="font-family:DM Sans,sans-serif;font-size:12px;line-height:1.45;min-width:190px;">
                <b>${CATEGORY_LABELS[report.category] || "Incident"}</b><br/>
                ${report.description || "No description"}<br/>
                Severity: ${severityLabel(report.severity)}<br/>
                Reported: ${timeAgo(report.created_at)}<br/>
                Expires: ${expiresIn(report.expires_at)}<br/>
                ${owner ? `<button id="del-report-${report.id}" class="del-report-btn" style="margin-top:8px;padding:5px 8px;border:none;border-radius:6px;background:#ef4444;color:#fff;cursor:pointer;font-size:11px;">Remove</button>` : ""}
            </div>`;

            marker.bindPopup(L.popup().setContent(popupHtml));
            marker.on("popupopen", () => {
                if (!owner) return;
                const btn = document.getElementById(`del-report-${report.id}`);
                if (btn) {
                    btn.onclick = () => onDelete?.(report.id);
                }
            });

            group.addLayer(marker);
        });

        group.addTo(map);
        reportsLayerRef.current = group;

        return () => {
            if (reportsLayerRef.current) {
                map.removeLayer(reportsLayerRef.current);
                reportsLayerRef.current = null;
            }
        };
    }, [reports, currentUserId, onDelete, map]);

    useEffect(() => {
        if (previewRef.current) {
            map.removeLayer(previewRef.current);
            previewRef.current = null;
        }

        if (!showPreview || !previewLocation) return;

        const marker = L.marker([previewLocation.lat, previewLocation.lng], {
            icon: previewIcon,
            interactive: false,
        });

        marker.addTo(map);
        previewRef.current = marker;

        return () => {
            if (previewRef.current) {
                map.removeLayer(previewRef.current);
                previewRef.current = null;
            }
        };
    }, [map, previewLocation, showPreview]);

    return null;
}
