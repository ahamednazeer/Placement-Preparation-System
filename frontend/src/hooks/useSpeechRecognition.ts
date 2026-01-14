'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types for Capacitor Speech Recognition
interface SpeechRecognitionPlugin {
    available(): Promise<{ available: boolean }>;
    requestPermissions(): Promise<{ speechRecognition: 'granted' | 'denied' | 'prompt' }>;
    start(options?: { language?: string; maxResults?: number; partialResults?: boolean }): Promise<void>;
    stop(): Promise<void>;
    addListener(eventName: 'partialResults', callback: (data: { matches: string[] }) => void): Promise<{ remove: () => void }>;
}

interface UseSpeechRecognitionReturn {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    startListening: () => Promise<void>;
    stopListening: () => Promise<void>;
    resetTranscript: () => void;
    isSupported: boolean;
    error: string | null;
    isProcessing: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(true); // Default to true, will detect
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const capacitorPluginRef = useRef<SpeechRecognitionPlugin | null>(null);
    const listenerRef = useRef<{ remove: () => void } | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const isNative = Capacitor.isNativePlatform();

    // Initialize on mount
    useEffect(() => {
        const init = async () => {
            if (isNative) {
                // Try to load Capacitor Speech Recognition
                try {
                    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
                    capacitorPluginRef.current = SpeechRecognition as unknown as SpeechRecognitionPlugin;
                    const { available } = await capacitorPluginRef.current.available();
                    setIsSupported(available);
                } catch (e) {
                    console.warn('Capacitor Speech Recognition not available:', e);
                    // Fall back to MediaRecorder
                    setIsSupported(!!navigator.mediaDevices);
                }
            } else {
                // Web: Always use MediaRecorder for HTTP compatibility
                setIsSupported(!!navigator.mediaDevices);
            }
        };

        init();

        return () => {
            if (listenerRef.current) {
                listenerRef.current.remove();
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, [isNative]);

    // Transcribe audio using backend Whisper API
    const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');

        // Get token from localStorage
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/interview/transcribe`, {
                method: 'POST',
                headers: headers,
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Transcription failed');
            }

            const data = await response.json();
            return data.text || '';
        } catch (e) {
            console.error('Transcription error:', e);
            throw e;
        }
    };

    // Start recording with MediaRecorder
    const startMediaRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });

            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                // Create audio blob
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                // Only transcribe if we have audio
                if (audioBlob.size > 0) {
                    setIsProcessing(true);
                    setInterimTranscript('Processing...');

                    try {
                        const text = await transcribeAudio(audioBlob);
                        if (text) {
                            setTranscript(prev => prev + text + ' ');
                        }
                    } catch (e) {
                        setError('Transcription failed. Please try again.');
                    } finally {
                        setIsProcessing(false);
                        setInterimTranscript('');
                    }
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(1000); // Collect data every second
            setIsListening(true);
            setError(null);

        } catch (e) {
            console.error('Failed to start recording:', e);
            setError('Microphone access denied');
        }
    };

    const startListening = useCallback(async () => {
        setError(null);
        setInterimTranscript('');

        if (isNative && capacitorPluginRef.current) {
            try {
                // Request permissions first
                const { speechRecognition } = await capacitorPluginRef.current.requestPermissions();
                if (speechRecognition !== 'granted') {
                    setError('Microphone permission denied');
                    return;
                }

                // Set up listener for partial results
                listenerRef.current = await capacitorPluginRef.current.addListener('partialResults', (data) => {
                    if (data.matches && data.matches.length > 0) {
                        setInterimTranscript(data.matches[0]);
                    }
                });

                await capacitorPluginRef.current.start({
                    language: 'en-US',
                    partialResults: true,
                });
                setIsListening(true);
            } catch (e) {
                console.warn('Native STT failed, falling back to MediaRecorder:', e);
                await startMediaRecording();
            }
        } else {
            // Web: Use MediaRecorder + backend Whisper
            await startMediaRecording();
        }
    }, [isNative]);

    const stopListening = useCallback(async () => {
        if (isNative && capacitorPluginRef.current) {
            try {
                await capacitorPluginRef.current.stop();
                if (listenerRef.current) {
                    listenerRef.current.remove();
                    listenerRef.current = null;
                }
                // Move interim to final transcript
                if (interimTranscript) {
                    setTranscript(prev => prev + interimTranscript + ' ');
                }
            } catch (e) {
                console.error('Failed to stop native speech recognition:', e);
            }
        }

        // Stop MediaRecorder if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        setIsListening(false);
        setInterimTranscript('');
    }, [isNative, interimTranscript]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        isSupported,
        error,
        isProcessing,
    };
}
