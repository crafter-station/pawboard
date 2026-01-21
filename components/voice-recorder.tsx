"use client";

import { Mic, MicOff, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef } from "react";

interface VoiceRecorderProps {
    onTranscription: (text: string) => void;
    isDark?: boolean;
}

export function VoiceRecorder({ onTranscription, isDark }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
                await handleTranscription(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

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
                if (text) {
                    onTranscription(text);
                }
            } else {
                console.error("Transcription failed");
            }
        } catch (err) {
            console.error("Error during transcription:", err);
        } finally {
            setIsTranscribing(false);
        }
    };

    return (
        <div className="relative flex items-center justify-center">
            <AnimatePresence>
                {isRecording && (
                    <>
                        {[0, 0.4, 0.8].map((delay) => (
                            <motion.div
                                key={delay}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{
                                    scale: [1, 2.5, 1],
                                    opacity: [0, 0.5, 0]
                                }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: delay,
                                    ease: "easeInOut",
                                }}
                                className={`absolute inset-0 rounded-full blur-xl ${isDark ? "bg-red-400" : "bg-red-500"
                                    }`}
                            />
                        ))}
                    </>
                )}
            </AnimatePresence>

            <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                className={`relative z-10 p-2 rounded-full transition-all duration-200 ${isRecording
                        ? "bg-red-500 text-white shadow-lg scale-110"
                        : isDark
                            ? "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                            : "bg-black/5 text-black/50 hover:bg-black/10 hover:text-black"
                    } ${isTranscribing ? "cursor-wait opacity-50" : "cursor-pointer"}`}
            >
                {isTranscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRecording ? (
                    <MicOff className="w-4 h-4" />
                ) : (
                    <Mic className="w-4 h-4" />
                )}
            </button>

            {isRecording && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                >
                    RECORDING
                </motion.div>
            )}
        </div>
    );
}
