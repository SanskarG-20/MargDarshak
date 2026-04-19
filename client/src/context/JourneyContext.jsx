import { createContext, useContext, useMemo, useState } from "react";

const JourneyContext = createContext(null);

export function JourneyProvider({ children }) {
    const [currentJourney, setCurrentJourney] = useState(null);

    const value = useMemo(() => ({
        currentJourney,
        setCurrentJourney,
    }), [currentJourney]);

    return (
        <JourneyContext.Provider value={value}>
            {children}
        </JourneyContext.Provider>
    );
}

export function useJourney() {
    const context = useContext(JourneyContext);
    if (!context) {
        throw new Error("useJourney must be used within a JourneyProvider");
    }
    return context;
}
