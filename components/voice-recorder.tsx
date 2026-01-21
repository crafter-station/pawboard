"use client";

import { Mic, Pause, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect } from "react";

interface VoiceRecorderProps {
    onTranscription: (text: string) => void;
    isDark?: boolean;
    containerClassName?: string;
    onRecordingStateChange?: (isRecording: boolean) => void;
    onlyVisualizer?: boolean;
    onlyTrigger?: boolean;
}

export function VoiceRecorder({
    onTranscription,
    isDark,
    containerClassName,
    onRecordingStateChange,
    onlyVisualizer,
    onlyTrigger
}: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [audioLevels, setAudioLevels] = useState<number[]>(new Array(12).fill(0));
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            // Setup Audio Context for Visualizer
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const updateVisualizer = () => {
                if (!analyserRef.current) return;
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);

                // Take 8 samples and mirror them for symmetry
                const samples = [];
                for (let i = 0; i < 8; i++) {
                    const val = dataArray[i * 2] || 0;
                    samples.push(val / 255);
                }

                // Simple mirror: [s7, s6, s5, s4, s3, s2, s1, s0, s0, s1, s2, s3, s4, s5, s6, s7]
                const symmetrical = [...samples].reverse().concat(samples);
                setAudioLevels(symmetrical);
                animationFrameRef.current = requestAnimationFrame(updateVisualizer);
            };
            updateVisualizer();

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
                await handleTranscription(audioBlob);
                stream.getTracks().forEach(track => track.stop());

                // Cleanup audio context
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
                setAudioLevels(new Array(16).fill(0)); // Reset visualizer
            };

            mediaRecorder.start();
            setIsRecording(true);
            onRecordingStateChange?.(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            onRecordingStateChange?.(false);
        }
    };

    useEffect(() => {
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    const handleTranscription = async (blob: Blob) => {
        setIsTranscribing(true);
        try {
            const formData = new FormData();
            formData.append("file", blob, "audio.wav");

            const response = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const { text } = await response.json();
                if (text) onTranscription(text);
            }
        } catch (err) {
            console.error("Error during transcription:", err);
        } finally {
            setIsTranscribing(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {isRecording && !onlyTrigger && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ pointerEvents: 'none' }}
                        className={`${containerClassName || "absolute inset-0"} z-[100] flex items-center justify-center pointer-events-none`}
                    >
                        <div className="flex items-center gap-1 sm:gap-1.5 h-12 sm:h-20">
                            {audioLevels.map((level, i) => (
                                <motion.div
                                    key={i}
                                    animate={{
                                        height: Math.max(4, level * 80),
                                        opacity: 0.1 + (level * 0.4)
                                    }}
                                    transition={{ type: "spring", bounce: 0, duration: 0.1 }}
                                    className={`w-[3px] sm:w-[4px] rounded-full ${isDark ? "bg-white" : "bg-black"
                                        }`}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!onlyVisualizer && (
                <div className="relative flex items-center justify-center">
                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isTranscribing}
                        className={`relative z-10 p-2 rounded-full transition-all duration-300 ${isRecording
                            ? isDark ? "bg-white/10 text-white/90" : "bg-black/10 text-black/80"
                            : isDark
                                ? "bg-white/5 text-white/40 hover:bg-white/20 hover:text-white"
                                : "bg-black/5 text-black/30 hover:bg-black/10 hover:text-black"
                            } ${isTranscribing ? "cursor-wait opacity-50" : "cursor-pointer"}`}
                    >
                        {isTranscribing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isRecording ? (
                            <Pause className="w-4 h-4" />
                        ) : (
                            <Mic className="w-4 h-4" />
                        )}
                    </button>
                </div>
            )}
        </>
    );
}
