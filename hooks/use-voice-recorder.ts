import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceRecorderProps {
  onTranscription: (text: string) => void;
}

export function useVoiceRecorder({ onTranscription }: UseVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(
    new Array(16).fill(0),
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Cleanup mounted ref on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleTranscription = useCallback(
    async (blob: Blob) => {
      if (!mountedRef.current) return;
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
          if (text && mountedRef.current) onTranscription(text);
        }
      } catch (err) {
        console.error("Error during transcription:", err);
      } finally {
        if (mountedRef.current) {
          setIsTranscribing(false);
        }
      }
    },
    [onTranscription],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Setup Audio Context for Visualizer
      // Extend window type locally to support webkitAudioContext without 'any' if possible,
      // or just cast strictly to unknown then to the specific type to satisfy linter if strict.
      // But standard 'window.AudioContext' covers most modern browsers.
      // We will handle the fallback typings cleaner.
      const AudioContextClass =
        window.AudioContext ||
        // @ts-expect-error - Vendor prefix support
        window.webkitAudioContext;

      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateVisualizer = () => {
        if (!analyserRef.current || !mountedRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Take 8 samples and mirror them for symmetry
        const samples = [];
        for (let i = 0; i < 8; i++) {
          const val = dataArray[i * 2] || 0;
          samples.push(val / 255);
        }

        // Simple mirror
        const symmetrical = [...samples].reverse().concat(samples);
        if (mountedRef.current) {
          setAudioLevels(symmetrical);
          animationFrameRef.current = requestAnimationFrame(updateVisualizer);
        }
      };
      updateVisualizer();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        await handleTranscription(audioBlob);
        // Stop all tracks
        for (const track of stream.getTracks()) {
          track.stop();
        }

        // Cleanup audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        // Reset visualizer (check mounted to avoid memory leak)
        if (mountedRef.current) {
          setAudioLevels(new Array(16).fill(0));
        }
      };

      mediaRecorder.start();
      if (mountedRef.current) {
        setIsRecording(true);
      }
    } catch (err) {
      console.error("Error accessing microphone:", err);
      if (mountedRef.current) {
        alert("Could not access microphone. Please check permissions.");
      }
    }
  }, [handleTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      // Cleanup animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      // Stop any active recording
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    audioLevels,
    startRecording,
    stopRecording,
  };
}
