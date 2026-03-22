import { useEffect, useMemo, useState } from "react";
import { Y, BK, WH } from "../constants/theme";

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export default function OnboardingTour({
    steps,
    currentStep,
    totalSteps,
    onNext,
    onSkip,
    isActive,
}) {
    const [rect, setRect] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 16, left: 16 });
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth < 768 : false
    );

    const step = steps?.[currentStep] || null;

    const recalcPosition = (targetEl, stepConfig) => {
        if (!targetEl || !stepConfig || typeof window === "undefined") return;

        const base = targetEl.getBoundingClientRect();
        const padded = {
            top: base.top - 8,
            left: base.left - 8,
            width: base.width + 16,
            height: base.height + 16,
            right: base.right + 8,
            bottom: base.bottom + 8,
        };

        setRect(padded);

        const cardWidth = 280;
        const cardHeight = 210;
        const gap = 16;
        const mobileBottomPos = {
            top: clamp(padded.bottom + gap, 16, window.innerHeight - cardHeight - 16),
            left: clamp(padded.left, 16, window.innerWidth - cardWidth - 16),
        };

        if (isMobile) {
            setTooltipPos(mobileBottomPos);
            return;
        }

        let top = mobileBottomPos.top;
        let left = mobileBottomPos.left;
        const position = stepConfig.position;

        if (position === "bottom") {
            top = padded.bottom + gap;
            left = padded.left;
        } else if (position === "top") {
            top = window.innerHeight - padded.top + gap;
            left = padded.left;
            top = window.innerHeight - top;
        } else if (position === "left") {
            top = padded.top;
            left = window.innerWidth - padded.left + gap;
            left = window.innerWidth - left;
        } else if (position === "right") {
            top = padded.top;
            left = padded.right + gap;
        }

        setTooltipPos({
            top: clamp(top, 16, window.innerHeight - cardHeight - 16),
            left: clamp(left, 16, window.innerWidth - cardWidth - 16),
        });
    };

    useEffect(() => {
        if (!isActive || !step) return;

        const target = document.querySelector(`[data-tour="${step.targetSelector}"]`);
        if (!target) {
            onNext?.();
            return;
        }

        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setTooltipVisible(false);
        recalcPosition(target, step);

        const timer = setTimeout(() => {
            recalcPosition(target, step);
            setTooltipVisible(true);
        }, 400);

        return () => clearTimeout(timer);
    }, [isActive, step, currentStep, onNext, isMobile]);

    useEffect(() => {
        if (!isActive) return undefined;

        const onResize = () => {
            setIsMobile(window.innerWidth < 768);
            const target = step ? document.querySelector(`[data-tour="${step.targetSelector}"]`) : null;
            if (target && step) recalcPosition(target, step);
        };

        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [isActive, step]);

    useEffect(() => {
        if (!isActive) return undefined;

        const onKeyDown = (e) => {
            if (e.key === "Escape") onSkip?.();
            if (e.key === "ArrowRight") onNext?.();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isActive, onSkip, onNext]);

    const dots = useMemo(() => {
        return Array.from({ length: totalSteps }, (_, i) => i);
    }, [totalSteps]);

    if (!isActive || !step || !rect) return null;

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 1800, pointerEvents: "none" }}>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "transparent",
                    zIndex: 1800,
                    pointerEvents: "none",
                }}
            />

            <div
                style={{
                    position: "fixed",
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    borderRadius: 12,
                    border: `2px solid ${Y}`,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.82)",
                    transition: "all 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
                    zIndex: 1800,
                    pointerEvents: "none",
                }}
            />

            <div
                aria-live="polite"
                style={{
                    position: "fixed",
                    top: tooltipPos.top,
                    left: tooltipPos.left,
                    width: 280,
                    background: BK,
                    border: `1.5px solid ${Y}`,
                    borderRadius: 12,
                    padding: 20,
                    zIndex: 1801,
                    pointerEvents: "auto",
                    opacity: tooltipVisible ? 1 : 0,
                    transition: "opacity 0.2s ease 0.2s",
                }}
            >
                <div style={{
                    color: Y,
                    fontSize: 10,
                    letterSpacing: 2,
                    fontFamily: "'DM Sans',sans-serif",
                    marginBottom: 10,
                    textTransform: "uppercase",
                }}>
                    {`${currentStep + 1} of ${totalSteps}`}
                </div>

                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {dots.map((d) => (
                        <span
                            key={d}
                            style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: d <= currentStep ? Y : "#333",
                                display: "inline-block",
                            }}
                        />
                    ))}
                </div>

                <div style={{
                    color: Y,
                    fontSize: 15,
                    fontWeight: 900,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontFamily: "'DM Sans',sans-serif",
                    marginBottom: 8,
                }}>
                    {step.title}
                </div>

                <div style={{
                    color: "rgba(255,255,255,.8)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontFamily: "'DM Sans',sans-serif",
                    marginBottom: 14,
                }}>
                    {step.description}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                        type="button"
                        onClick={onSkip}
                        style={{
                            color: "rgba(255,255,255,.4)",
                            background: "none",
                            border: "none",
                            fontSize: 11,
                            cursor: "pointer",
                            letterSpacing: 1,
                        }}
                    >
                        SKIP TOUR
                    </button>

                    <button
                        type="button"
                        onClick={onNext}
                        style={{
                            background: Y,
                            color: BK,
                            border: "none",
                            borderRadius: 999,
                            padding: "7px 12px",
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer",
                            letterSpacing: 0.8,
                        }}
                    >
                        {currentStep < totalSteps - 1 ? "NEXT →" : "GET STARTED ✓"}
                    </button>
                </div>
            </div>
        </div>
    );
}
