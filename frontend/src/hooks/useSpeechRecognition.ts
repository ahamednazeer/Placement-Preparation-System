'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types for Capacitor Speech Recognition
interface SpeechRecognitionPlugin {
    available(): Promise<{ available: boolean }>;
    requestPermissions(): Promise<{ speechRecognition: 'granted' | 'denied' | 'prompt' }>;
    start(options?: { language?: string; maxResults?: number; partialResults?: boolean }): Promise<void>;
    stop(): Promise<void>;
    addListener(eventName: 'partialResults', callback: (data: { matches: string[] }) => void): Promise<{ remove: () => void }>;
}

const SpeechRecognition = registerPlugin<SpeechRecognitionPlugin>('SpeechRecognition');

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
    const [isSupported, setIsSupported] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const capacitorPluginRef = useRef<SpeechRecognitionPlugin | null>(null);
    const listenerRef = useRef<{ remove: () => void } | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mimeTypeRef = useRef<string>('audio/webm');

    const isNative = Capacitor.isNativePlatform();

    // Initialize on mount
    useEffect(() => {
        const init = async () => {
            if (isNative) {
                try {
                    capacitorPluginRef.current = SpeechRecognition;
                    const { available } = await capacitorPluginRef.current.available();
                    setIsSupported(available);
                } catch (e) {
                    console.warn('Capacitor Speech Recognition not available:', e);
                    setIsSupported(!!navigator.mediaDevices);
                }
            } else {
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
        // Determine file extension from MIME type
        const mimeToExt: Record<string, string> = {
            'audio/webm': '.webm',
            'audio/webm;codecs=opus': '.webm',
            'audio/mp4': '.m4a',
            'audio/mpeg': '.mp3',
            'audio/ogg': '.ogg',
        };
        const ext = mimeToExt[audioBlob.type] || '.webm';
        const filename = `recording${ext}`;

        console.log('[SpeechRecognition] Preparing transcription:', {
            blobSize: audioBlob.size,
            blobType: audioBlob.type,
            filename: filename,
            apiUrl: `${API_BASE_URL}/api/v1/interview/transcribe`
        });

        const formData = new FormData();
        formData.append('file', audioBlob, filename);

        // Get token from localStorage
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        console.log('[SpeechRecognition] Auth token present:', !!token);

        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            console.log('[SpeechRecognition] Sending request to backend...');
            const response = await fetch(`${API_BASE_URL}/api/v1/interview/transcribe`, {
                method: 'POST',
                headers: headers,
                body: formData,
            });

            console.log('[SpeechRecognition] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SpeechRecognition] Transcription failed:', response.status, errorText);
                throw new Error(`Transcription failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[SpeechRecognition] Transcription result:', data);
            return data.text || '';
        } catch (e) {
            console.error('[SpeechRecognition] Transcription error:', e);
            throw e;
        }
    };

    // Start recording with MediaRecorder
    const startMediaRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Prefer webm, but fallback to mp4 for Android compatibility
            const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : MediaRecorder.isTypeSupported('audio/mp4')
                        ? 'audio/mp4'
                        : 'audio/mpeg';

            mimeTypeRef.current = preferredMime;
            console.log('[SpeechRecognition] Using MIME type:', preferredMime);

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: preferredMime
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

                // Create audio blob with actual recorded MIME type
                const actualMimeType = mimeTypeRef.current;
                const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
                console.log('[SpeechRecognition] Audio recorded - size:', audioBlob.size, 'type:', actualMimeType, 'chunks:', audioChunksRef.current.length);

                // Only transcribe if we have audio
                if (audioBlob.size > 0) {
                    setIsProcessing(true);
                    setInterimTranscript('Processing...');

                    try {
                        console.log('[SpeechRecognition] Starting transcription...');
                        const text = await transcribeAudio(audioBlob);
                        console.log('[SpeechRecognition] Got transcription text:', text);
                        if (text) {
                            setTranscript(prev => prev + text + ' ');
                        }
                    } catch (e) {
                        console.error('[SpeechRecognition] Transcription failed:', e);
                        setError('Transcription failed. Please try again.');
                    } finally {
                        setIsProcessing(false);
                        setInterimTranscript('');
                    }
                } else {
                    console.warn('[SpeechRecognition] No audio data recorded!');
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

        // On Android, always use MediaRecorder + Whisper API
        if (isNative) {
            try {
                // Still request permissions via Capacitor if available
                if (capacitorPluginRef.current) {
                    const { speechRecognition } = await capacitorPluginRef.current.requestPermissions();
                    if (speechRecognition !== 'granted') {
                        setError('Microphone permission denied');
                        return;
                    }
                }
                // Use MediaRecorder for more reliable audio capture + Whisper transcription
                await startMediaRecording();
            } catch (e) {
                console.warn('Failed to start recording on mobile:', e);
                setError('Failed to access microphone');
            }
        } else {
            // Web: Use MediaRecorder + backend Whisper
            await startMediaRecording();
        }
    }, [isNative]);

    const stopListening = useCallback(async () => {
        // Stop MediaRecorder if active (both Android and Web use this now)
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            // Set listening to false immediately for UI feedback
            setIsListening(false);
            // Show processing indicator while transcription happens
            setInterimTranscript('Processing audio...');
            // MediaRecorder.stop() triggers onstop handler which does transcription
            mediaRecorderRef.current.stop();
            // Don't clear interimTranscript here - let onstop handler do it after transcription
            return;
        }

        // Fallback: if no MediaRecorder was active
        setIsListening(false);
        setInterimTranscript('');
    }, []);

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
