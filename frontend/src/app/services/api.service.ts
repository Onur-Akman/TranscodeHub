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
}

export interface TranscodeJob {
    id: number;
    inputFileName: string;
    outputFileName: string;
    presetIds: number[];
    presetNames: string;
    outputFormat: string;
    status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    progress: number;
    createdAt: string;
    completedAt: string | null;
    errorMessage: string | null;
}

export interface TranscodeRequest {
    inputFileName?: string;
    inputUrl?: string;
    presetIds: number[];
    outputFormat: string;
}

export interface LiveStreamSettings {
    id?: number;
    jobId: number;
    chunkDurationMinutes: number;
    retentionPeriodHours: number;
}

export interface LiveStreamSegment {
    id: number;
    jobId: number;
    fileName: string;
    startTime: string;
    endTime: string;
    durationSeconds: number;
    createdAt: string;
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

    cancelJob(id: number): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/jobs/${id}/cancel`, {});
    }

    // --- Live Recording Settings & Segments ---
    getRecordingSettings(jobId: number): Observable<LiveStreamSettings> {
        return this.http.get<LiveStreamSettings>(`${this.baseUrl}/jobs/${jobId}/recording-settings`);
    }

    updateRecordingSettings(jobId: number, settings: { chunkDurationMinutes?: number; retentionPeriodHours?: number }): Observable<LiveStreamSettings> {
        return this.http.put<LiveStreamSettings>(`${this.baseUrl}/jobs/${jobId}/recording-settings`, settings);
    }

    getSegments(jobId: number): Observable<LiveStreamSegment[]> {
        return this.http.get<LiveStreamSegment[]>(`${this.baseUrl}/jobs/${jobId}/segments`);
    }

    // --- CMS Movies ---
    getAllCmsMovies(): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrl}/cms/movies`);
    }

    getCmsMovie(imdbId: string): Observable<any> {
        return this.http.get<any>(`${this.baseUrl}/cms/movies/${imdbId}`);
    }

    saveCmsMovie(data: any): Observable<any> {
        return this.http.post<any>(`${this.baseUrl}/cms/movies`, data);
    }

    uploadCmsPoster(imdbId: string, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<any>(`${this.baseUrl}/cms/movies/${imdbId}/poster`, formData);
    }

    // --- CMS Subtitles ---
    getSubtitles(imdbId: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrl}/cms/movies/${imdbId}/subtitles`);
    }

    uploadSubtitle(imdbId: string, file: File, language: string): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<any>(`${this.baseUrl}/cms/movies/${imdbId}/subtitles?language=${encodeURIComponent(language)}`, formData);
    }

    deleteSubtitle(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/cms/subtitles/${id}`);
    }

    // --- CMS Dubs ---
    getDubs(imdbId: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrl}/cms/movies/${imdbId}/dubs`);
    }

    uploadDub(imdbId: string, file: File, language: string): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<any>(`${this.baseUrl}/cms/movies/${imdbId}/dubs?language=${encodeURIComponent(language)}`, formData);
    }

    deleteDub(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/cms/dubs/${id}`);
    }

    // --- CMS Directory Listings ---
    getSubtitleFiles(): Observable<string[]> {
        return this.http.get<string[]>(`${this.baseUrl}/cms/subtitle-files`);
    }

    getDubFiles(): Observable<string[]> {
        return this.http.get<string[]>(`${this.baseUrl}/cms/dub-files`);
    }

    getWatchPartyMovies(): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrl}/watch-party/movies`);
    }

    createWatchPartyRoom(movieImdbId: string, transcodeJobId: number): Observable<any> {
        return this.http.post<any>(`${this.baseUrl}/watch-party/rooms`, { movieImdbId, transcodeJobId });
    }

    getWatchPartyRoom(roomId: string): Observable<any> {
        return this.http.get<any>(`${this.baseUrl}/watch-party/rooms/${roomId}`);
    }

    getActiveWatchPartyRooms(): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrl}/watch-party/rooms`);
    }
}
