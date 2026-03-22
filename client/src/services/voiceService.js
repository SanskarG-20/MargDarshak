const DEFAULT_OPTIONS = {
    rate: 1.0,
    pitch: 1.0,
    volume: 0.9,
    lang: "en-IN",
};

function splitIntoChunks(text) {
    const clean = (text || "").trim();
    if (!clean) return [];
    if (clean.length <= 200) return [clean];

    const rawParts = clean
        .split(/(?<=[.!?])\s+/)
        .map((p) => p.trim())
        .filter(Boolean);

    const chunks = [];
    let current = "";

    rawParts.forEach((part) => {
        const candidate = current ? `${current} ${part}` : part;
        if (candidate.length <= 200) {
            current = candidate;
        } else {
            if (current) chunks.push(current);
            if (part.length <= 200) {
                current = part;
            } else {
                // Fall back to hard slicing for very long sentences.
                for (let i = 0; i < part.length; i += 200) {
                    chunks.push(part.slice(i, i + 200));
                }
                current = "";
            }
        }
    });

    if (current) chunks.push(current);
    return chunks;
}

function ensureVoicesReady() {
    if (!isSpeechSupported()) return Promise.resolve(false);

    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing && existing.length > 0) return Promise.resolve(true);

    return new Promise((resolve) => {
        const onVoicesChanged = () => {
            synth.onvoiceschanged = null;
            resolve(true);
        };

        synth.onvoiceschanged = onVoicesChanged;

        // Safety timeout so callers don't hang forever in browsers that never fire.
        setTimeout(() => {
            if (synth.onvoiceschanged === onVoicesChanged) synth.onvoiceschanged = null;
            resolve(true);
        }, 1200);
    });
}

export function isSpeechSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeech() {
    if (!isSpeechSupported()) return;
    window.speechSynthesis.cancel();
}

export async function speakText(text, options = {}) {
    if (!isSpeechSupported()) return false;

    const merged = { ...DEFAULT_OPTIONS, ...options };
    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) return false;

    await ensureVoicesReady();

    const synth = window.speechSynthesis;
    synth.cancel();

    return new Promise((resolve) => {
        let index = 0;

        const speakNext = () => {
            if (index >= chunks.length) {
                resolve(true);
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunks[index]);
            utterance.rate = merged.rate;
            utterance.pitch = merged.pitch;
            utterance.volume = merged.volume;
            utterance.lang = merged.lang;

            utterance.onend = () => {
                index += 1;
                speakNext();
            };

            utterance.onerror = () => {
                resolve(false);
            };

            synth.speak(utterance);
        };

        speakNext();
    });
}
