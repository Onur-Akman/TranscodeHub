import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EncodingPreset {
    id?: number;
    name: string;
    videoCodec: string;
    audioCodec: string;
    resolution: string;
    crf: number;
    maxRate: string;
    bufSize: string;
    audioBitrate: string;
    preset: string;
    format: string;
}

export interface TranscodeJob {
    id: number;
    inputFileName: string;
    outputFileName: string;
    presetId: number;
    presetName: string;
    status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    progress: number;
    createdAt: string;
    completedAt: string | null;
    errorMessage: string | null;
}

export interface TranscodeRequest {
    inputFileName: string;
    presetId: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
    private baseUrl = '/api';

    constructor(private http: HttpClient) { }

    // --- Presets ---
    getPresets(): Observable<EncodingPreset[]> {
        return this.http.get<EncodingPreset[]>(`${this.baseUrl}/presets`);
    }

    createPreset(preset: EncodingPreset): Observable<EncodingPreset> {
        return this.http.post<EncodingPreset>(`${this.baseUrl}/presets`, preset);
    }

    updatePreset(id: number, preset: EncodingPreset): Observable<EncodingPreset> {
        return this.http.put<EncodingPreset>(`${this.baseUrl}/presets/${id}`, preset);
    }

    deletePreset(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/presets/${id}`);
    }

    // --- Videos ---
    getInputVideos(): Observable<string[]> {
        return this.http.get<string[]>(`${this.baseUrl}/videos/input`);
    }

    uploadVideo(file: File): Observable<{ fileName: string; message: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ fileName: string; message: string }>(`${this.baseUrl}/videos/upload`, formData);
    }

    // --- Transcode jobs ---
    startTranscode(request: TranscodeRequest): Observable<TranscodeJob> {
        return this.http.post<TranscodeJob>(`${this.baseUrl}/transcode`, request);
    }

    getJobs(): Observable<TranscodeJob[]> {
        return this.http.get<TranscodeJob[]>(`${this.baseUrl}/jobs`);
    }

    getJob(id: number): Observable<TranscodeJob> {
        return this.http.get<TranscodeJob>(`${this.baseUrl}/jobs/${id}`);
    }

    streamProgress(id: number): EventSource {
        return new EventSource(`${this.baseUrl}/jobs/${id}/progress`);
    }
}
