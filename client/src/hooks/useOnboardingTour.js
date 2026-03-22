import { useCallback, useEffect, useState } from "react";

export const TOUR_STEPS = [
    {
        targetSelector: "query-input",
        title: "ASK ANYTHING",
        description: "Type a natural language query like 'How do I get from Andheri to BKC?' MargDarshak understands plain English.",
        position: "bottom",
    },
    {
        targetSelector: "weather-badge",
        title: "LIVE CONDITIONS",
        description: "Real-time weather and AQI for your location. Every route recommendation accounts for current conditions.",
        position: "bottom",
    },
    {
        targetSelector: "sos-button",
        title: "ONE-TAP SOS",
        description: "In an emergency, tap this. Your GPS coordinates, a pre-built rescue message, and direct 112 dial — all in one tap.",
        position: "left",
    },
    {
        targetSelector: "route-panel",
        title: "SMART ROUTES",
        description: "Compare all transport modes with safety scores, eco impact, cost, and AI-explained reasoning. The best option is highlighted.",
        position: "top",
    },
];

const STORAGE_KEY = "margdarshak_tour_completed";

export default function useOnboardingTour() {
    const [tourActive, setTourActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = TOUR_STEPS.length;

    const complete = useCallback(() => {
        try {
            localStorage.setItem(STORAGE_KEY, "true");
        } catch {
            // Ignore storage failures and still end tour.
        }
        setTourActive(false);
    }, []);

    const skip = useCallback(() => {
        complete();
    }, [complete]);

    const next = useCallback(() => {
        setCurrentStep((prev) => {
            if (prev >= totalSteps - 1) {
                complete();
                return prev;
            }
            return prev + 1;
        });
    }, [complete, totalSteps]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const isDashboard = window.location.pathname.includes("dashboard");
        const done = localStorage.getItem(STORAGE_KEY) === "true";

        if (!done && isDashboard) {
            setTourActive(true);
            setCurrentStep(0);
        } else {
            setTourActive(false);
        }
    }, []);

    return {
        tourActive,
        currentStep,
        totalSteps,
        next,
        skip,
        complete,
    };
}
