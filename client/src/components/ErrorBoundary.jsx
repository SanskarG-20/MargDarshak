import { Component } from "react";

/**
 * ErrorBoundary — catches JavaScript errors in child components during rendering,
 * lifecycle methods, and constructors. Displays a fallback UI instead of crashing
 * the entire application.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<div>Custom fallback</div>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("[ErrorBoundary] Caught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    style={{
                        border: "1px solid rgba(239,68,68,.3)",
                        borderLeft: "5px solid #ef4444",
                        background: "rgba(239,68,68,.06)",
                        padding: "18px 16px",
                        marginBottom: 16,
                    }}
                >
                    <div
                        style={{
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 16,
                            letterSpacing: 1.5,
                            color: "#ef4444",
                            marginBottom: 8,
                        }}
                    >
                        SOMETHING WENT WRONG
                    </div>
                    <div
                        style={{
                            fontFamily: "'DM Sans',sans-serif",
                            fontSize: 13,
                            color: "rgba(255,255,255,.55)",
                            lineHeight: 1.6,
                            marginBottom: 12,
                        }}
                    >
                        {this.state.error?.message || "An unexpected error occurred in this section."}
                    </div>
                    <button
                        type="button"
                        onClick={this.handleRetry}
                        style={{
                            border: "1px solid rgba(255,255,255,.2)",
                            color: "rgba(255,255,255,.7)",
                            background: "transparent",
                            padding: "6px 14px",
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 13,
                            letterSpacing: 1.2,
                            cursor: "pointer",
                        }}
                    >
                        RETRY
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
