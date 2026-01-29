"use client";

import { cn } from "@/lib/utils";
import { Mic, Pause, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

// Re-export the hook for consumers who import from here
export { useVoiceRecorder };

interface VoiceVisualizerProps {
    isRecording: boolean;
    audioLevels: number[];
    isDark?: boolean;
    containerClassName?: string;
}

export function VoiceVisualizer({
    isRecording,
    audioLevels,
    isDark,
    containerClassName,
}: VoiceVisualizerProps) {
    return (
        <AnimatePresence>
            {isRecording && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ pointerEvents: "none" }}
                    className={cn(
                        "z-[100] flex items-center justify-center pointer-events-none",
                        containerClassName || "absolute inset-0",
                    )}
                >
                    <div className="flex items-center gap-1 sm:gap-1.5 h-12 sm:h-20">
                        {audioLevels.map((level, i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    height: Math.max(4, level * 80),
                                    opacity: 0.1 + level * 0.4,
                                }}
                                transition={{ type: "spring", bounce: 0, duration: 0.1 }}
                                className={cn(
                                    "w-[3px] sm:w-[4px] rounded-full",
                                    isDark ? "bg-white" : "bg-black",
                                )}
                            />
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

interface VoiceTriggerProps {
    isRecording: boolean;
    isTranscribing: boolean;
    onToggle: () => void;
    isDark?: boolean;
}

export function VoiceTrigger({
    isRecording,
    isTranscribing,
    onToggle,
    isDark,
}: VoiceTriggerProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={isTranscribing}
            className={cn(
                "relative z-10 p-2 rounded-full transition-all duration-300",
                isRecording
                    ? isDark
                        ? "bg-white/10 text-white/90"
                        : "bg-black/10 text-black/80"
                    : isDark
                        ? "bg-white/5 text-white/40 hover:bg-white/20 hover:text-white/60"
                        : "bg-black/5 text-black/20 hover:bg-black/10 hover:text-black/50",
                isTranscribing ? "cursor-wait opacity-50" : "cursor-pointer",
            )}
        >
            {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRecording ? (
                <Pause className="w-4 h-4" />
            ) : (
                <Mic className="w-4 h-4" />
            )}
        </button>
    );
}

interface VoiceRecorderProps {
    onTranscription: (text: string) => void;
    isDark?: boolean;
    containerClassName?: string;
    // Backward compatibility props (optional)
    onRecordingStateChange?: (isRecording: boolean) => void;
    onlyVisualizer?: boolean;
    onlyTrigger?: boolean;
}

export function VoiceRecorder(props: VoiceRecorderProps) {
    const {
        isRecording,
        isTranscribing,
        audioLevels,
        startRecording,
        stopRecording,
    } = useVoiceRecorder({
        onTranscription: props.onTranscription,
    });

    // Wrapper component for simple use cases
    return (
        <>
            <VoiceVisualizer
                isRecording={isRecording}
                audioLevels={audioLevels}
                isDark={props.isDark}
                containerClassName={props.containerClassName}
            />
            <div className="relative flex items-center justify-center">
                <VoiceTrigger
                    isRecording={isRecording}
                    isTranscribing={isTranscribing}
                    onToggle={isRecording ? stopRecording : startRecording}
                    isDark={props.isDark}
                />
            </div>
        </>
    );
}
