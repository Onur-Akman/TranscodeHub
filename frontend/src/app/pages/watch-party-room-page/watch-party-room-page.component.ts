import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import Hls from 'hls.js';

@Component({
  selector: 'app-watch-party-room-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './watch-party-room-page.component.html',
  styleUrl: './watch-party-room-page.component.scss'
})
export class WatchPartyRoomPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoPlayer') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('chatMessages') chatMessagesRef!: ElementRef<HTMLDivElement>;
  @ViewChild('chatInput') chatInputRef!: ElementRef<HTMLInputElement>;

  roomId = '';
  room: any = null;
  loading = true;
  error = '';

  // WebSocket
  private ws: WebSocket | null = null;
  private reconnectTimer: any;
  connected = false;

  // Users
  users: string[] = [];
  username = '';

  // Chat
  messages: { username: string; message: string; timestamp: number; isSystem?: boolean }[] = [];
  chatText = '';

  // Video state
  private hls: Hls | null = null;
  private ignoreCount = 0;
  isPlaying = false;
  videoPosition = 0;
  pausedByUser = '';
  pauseLockUntil = 0;
  lockRemainingSeconds = 0;
  private lockTimer: any;
  private syncThreshold = 2.0;
  playRejectedMsg = '';
  private playRejectedTimer: any;

  // Subtitles & Dubs
  subtitles: any[] = [];
  dubs: any[] = [];
  selectedSubtitle: number | null = null;
  selectedDub: number | null = null;
  private dubAudio: HTMLAudioElement | null = null;
  showSettingsMenu = false;
  qualities: { id: number; label: string }[] = [];
  selectedQuality: number = -1;

  // Share
  shareLink = '';
  copied = false;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private auth: AuthService,
    private zone: NgZone
  ) {}

  ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
    this.username = this.auth.getUser()?.username || 'Anonymous';
    this.shareLink = `${window.location.origin}/watch-party/room/${this.roomId}`;

    if (this.roomId) {
      this.api.getWatchPartyRoom(this.roomId).subscribe({
        next: (room) => {
          this.room = room;
          this.loading = false;
          if (room.movieImdbId) {
            this.api.getSubtitles(room.movieImdbId).subscribe(s => {
              this.subtitles = s;
              setTimeout(() => this.addSubtitleTracks(), 1000);
            });
            this.api.getDubs(room.movieImdbId).subscribe(d => this.dubs = d);
          }
        },
        error: () => {
          this.error = 'Room not found';
          this.loading = false;
        }
      });
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.room) {
        this.initPlayer();
        this.connectWs();
      } else {
        const check = setInterval(() => {
          if (this.room) {
            clearInterval(check);
            this.initPlayer();
            this.connectWs();
          }
        }, 200);
        setTimeout(() => clearInterval(check), 10000);
      }
    }, 300);
  }

  ngOnDestroy() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.lockTimer) clearInterval(this.lockTimer);
    if (this.playRejectedTimer) clearTimeout(this.playRejectedTimer);
    if (this.dubAudio) { this.dubAudio.pause(); this.dubAudio = null; }
  }

  // ===================== VIDEO PLAYER =====================

  private initPlayer() {
    if (!this.room || !this.videoRef) return;

    const video = this.videoRef.nativeElement;
    const outputFile = this.room.outputFileName;
    const url = `/videos/output/${outputFile}`;

    if (url.endsWith('.m3u8') || outputFile.includes('/master.m3u8') || outputFile.endsWith('_multi/master.m3u8')) {
      this.initHls(url.endsWith('.m3u8') ? url : `/videos/output/${outputFile}`, video);
    } else {
      video.src = url;
    }

    video.addEventListener('play', () => this.onVideoPlay());
    video.addEventListener('pause', () => this.onVideoPause());
    video.addEventListener('seeked', () => this.onVideoSeeked());
  }

  private initHls(url: string, video: HTMLVideoElement) {
    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
      }
      return;
    }

    if (this.hls) this.hls.destroy();
    this.hls = new Hls({ debug: false });
    this.hls.loadSource(url);
    this.hls.attachMedia(video);

    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.zone.run(() => {
        this.qualities = data.levels.map((l, i) => ({
          id: i, label: `${l.height}p (${Math.round(l.bitrate / 1024)}k)`
        })).sort((a, b) => b.id - a.id);
      });
    });
  }

  private shouldIgnore(): boolean {
    if (this.ignoreCount > 0) { this.ignoreCount--; return true; }
    return false;
  }

  private onVideoPlay() {
    if (this.shouldIgnore()) return;
    const video = this.videoRef?.nativeElement;
    if (!video || !this.ws) return;

    this.ignoreCount++;
    video.pause();
    this.wsSend({ type: 'PLAY' });
  }

  private onVideoPause() {
    if (this.shouldIgnore()) return;
    const video = this.videoRef?.nativeElement;
    if (!video || !this.ws) return;

    this.wsSend({ type: 'PAUSE', position: video.currentTime });
  }

  private onVideoSeeked() {
    if (this.shouldIgnore()) return;
    const video = this.videoRef?.nativeElement;
    if (!video || !this.ws) return;

    this.wsSend({ type: 'SEEK', position: video.currentTime });
  }

  // ===================== WEBSOCKET =====================

  private connectWs() {
    const token = this.auth.getToken();
    if (!token) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/watch-party/${this.roomId}?token=${token}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.zone.run(() => { this.connected = true; });
    };

    this.ws.onclose = () => {
      this.zone.run(() => {
        this.connected = false;
        this.reconnectTimer = setTimeout(() => this.connectWs(), 3000);
      });
    };

    this.ws.onerror = () => {};

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.zone.run(() => this.handleWsMessage(msg));
      } catch (e) {}
    };
  }

  private wsSend(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleWsMessage(msg: any) {
    switch (msg.type) {
      case 'JOINED':
        this.users = msg.users || [];
        if (msg.videoState) this.applyVideoState(msg.videoState);
        this.addSystemMessage('You joined the room');
        break;

      case 'USER_JOINED':
        this.users = msg.users || [];
        this.addSystemMessage(`${msg.username} joined`);
        break;

      case 'USER_LEFT':
        this.users = msg.users || [];
        this.addSystemMessage(`${msg.username} left`);
        break;

      case 'CHAT':
        this.messages.push({
          username: msg.username,
          message: msg.message,
          timestamp: msg.timestamp
        });
        this.scrollChat();
        break;

      case 'PAUSE':
        this.applyPause(msg.position, msg.username, msg.lockUntil);
        break;

      case 'PLAY':
        this.applyPlay(msg.position, msg.serverTime);
        break;

      case 'PLAY_REJECTED':
        this.playRejectedMsg = msg.reason || 'Cannot play right now';
        if (this.playRejectedTimer) clearTimeout(this.playRejectedTimer);
        this.playRejectedTimer = setTimeout(() => this.playRejectedMsg = '', 4000);
        break;

      case 'SEEK':
        this.applySeek(msg.position, msg.isPlaying);
        break;

      case 'SYNC':
        if (msg.videoState) this.applySyncState(msg.videoState, msg.serverTime);
        break;
    }
  }

  private seekIfNeeded(video: HTMLVideoElement, position: number) {
    if (Math.abs(video.currentTime - position) > 0.5) {
      this.ignoreCount++;
      video.currentTime = position;
    }
  }

  private applyVideoState(state: any) {
    this.isPlaying = state.isPlaying;
    this.pausedByUser = state.pausedByUser || '';
    this.pauseLockUntil = state.pauseLockUntil || 0;
    this.updateLockTimer();

    const video = this.videoRef?.nativeElement;
    if (!video) return;

    this.seekIfNeeded(video, state.position);
    if (state.isPlaying && video.paused) {
      this.ignoreCount++;
      video.play().catch(() => {});
    } else if (!state.isPlaying && !video.paused) {
      this.ignoreCount++;
      video.pause();
    }
  }

  private applyPause(position: number, username: string, lockUntil: number) {
    this.isPlaying = false;
    this.pausedByUser = username;
    this.pauseLockUntil = lockUntil;
    this.updateLockTimer();

    const video = this.videoRef?.nativeElement;
    if (!video) return;

    this.seekIfNeeded(video, position);
    if (!video.paused) {
      this.ignoreCount++;
      video.pause();
    }

    this.addSystemMessage(`${username} paused the video`);
  }

  private applyPlay(position: number, serverTime: number) {
    this.isPlaying = true;
    this.pausedByUser = '';
    this.pauseLockUntil = 0;
    this.lockRemainingSeconds = 0;
    if (this.lockTimer) { clearInterval(this.lockTimer); this.lockTimer = null; }

    const video = this.videoRef?.nativeElement;
    if (!video) return;

    this.seekIfNeeded(video, position);
    if (video.paused) {
      this.ignoreCount++;
      video.play().catch(() => {});
    }
  }

  private applySeek(position: number, isPlaying: boolean) {
    const video = this.videoRef?.nativeElement;
    if (!video) return;

    this.seekIfNeeded(video, position);

    if (isPlaying && video.paused) {
      this.ignoreCount++;
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      this.ignoreCount++;
      video.pause();
    }
  }

  private applySyncState(state: any, serverTime: number) {
    this.isPlaying = state.isPlaying;
    this.pausedByUser = state.pausedByUser || '';
    this.pauseLockUntil = state.pauseLockUntil || 0;
    this.updateLockTimer();

    const video = this.videoRef?.nativeElement;
    if (!video) return;

    const expectedPos = state.position;
    const drift = Math.abs(video.currentTime - expectedPos);

    if (drift > this.syncThreshold) {
      this.ignoreCount++; // seeked
      video.currentTime = expectedPos;
    }

    if (state.isPlaying && video.paused) {
      this.ignoreCount++; // play
      video.play().catch(() => {});
    } else if (!state.isPlaying && !video.paused) {
      this.ignoreCount++; // pause
      video.pause();
    }
  }

  private updateLockTimer() {
    if (this.lockTimer) { clearInterval(this.lockTimer); this.lockTimer = null; }

    if (this.pauseLockUntil > 0) {
      const update = () => {
        const remaining = Math.max(0, Math.ceil((this.pauseLockUntil - Date.now()) / 1000));
        this.lockRemainingSeconds = remaining;
        if (remaining <= 0) {
          clearInterval(this.lockTimer);
          this.lockTimer = null;
          this.pausedByUser = '';
        }
      };
      update();
      this.lockTimer = setInterval(update, 1000);
    } else {
      this.lockRemainingSeconds = 0;
    }
  }

  // ===================== SETTINGS (Quality / Subtitles / Dubs) =====================

  toggleSettingsMenu() {
    this.showSettingsMenu = !this.showSettingsMenu;
  }

  onQualitySelect(q: number) {
    this.selectedQuality = q;
    this.showSettingsMenu = false;
    if (!this.hls) return;
    this.hls.currentLevel = q; // -1 = auto
  }

  addSubtitleTracks() {
    const video = this.videoRef?.nativeElement;
    if (!video || this.subtitles.length === 0) return;

    if (!video.crossOrigin) video.crossOrigin = 'anonymous';

    const existing = video.querySelectorAll('track');
    existing.forEach((t: HTMLTrackElement) => t.remove());

    for (const s of this.subtitles) {
      if (s.fileName.endsWith('.srt')) {
        fetch(`/api/cms/subtitles/file/${s.fileName}`)
          .then(res => res.arrayBuffer())
          .then(buffer => {
            let text = '';
            try {
              text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            } catch {
              text = new TextDecoder('windows-1254').decode(buffer);
            }
            const vttText = this.srtToVtt(text);
            const blob = new Blob([vttText], { type: 'text/vtt' });
            const url = URL.createObjectURL(blob);
            this.appendSubtitleTrack(video, url, s.language);
          })
          .catch(() => {});
      } else {
        this.appendSubtitleTrack(video, `/api/cms/subtitles/file/${s.fileName}`, s.language);
      }
    }
  }

  private appendSubtitleTrack(video: HTMLVideoElement, url: string, language: string) {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = url;
    track.srclang = language;
    track.label = language;
    video.appendChild(track);
  }

  private srtToVtt(srt: string): string {
    let vtt = 'WEBVTT\n\n';
    vtt += srt
      .replace(/\r\n|\r|\n/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
      .replace(/\n\n+/g, '\n\n');
    return vtt;
  }

  onSubtitleSelect(index: number | null) {
    this.selectedSubtitle = index;
    this.showSettingsMenu = false;
    const video = this.videoRef?.nativeElement;
    if (!video) return;

    const selectedLang = index !== null && this.subtitles[index] ? this.subtitles[index].language : null;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (t.kind === 'subtitles' || t.kind === 'captions') {
        t.mode = (selectedLang && t.language === selectedLang) ? 'showing' : 'hidden';
      }
    }
  }

  onDubSelect(index: number | null) {
    this.selectedDub = index;
    this.showSettingsMenu = false;
    const video = this.videoRef?.nativeElement;
    if (!video) return;

    if (this.dubAudio) { this.dubAudio.pause(); this.dubAudio = null; }

    if (index === null) {
      video.muted = false;
      return;
    }

    const dub = this.dubs[index];
    if (!dub) return;

    video.muted = true;
    this.dubAudio = new Audio(`/api/cms/dubs/file/${dub.fileName}`);
    this.dubAudio.currentTime = video.currentTime;
    this.dubAudio.play().catch(() => {});

    video.addEventListener('play', () => { this.dubAudio?.play().catch(() => {}); });
    video.addEventListener('pause', () => { this.dubAudio?.pause(); });
    video.addEventListener('seeked', () => { if (this.dubAudio) this.dubAudio.currentTime = video.currentTime; });
  }

  // ===================== CHAT =====================

  sendChat() {
    const text = this.chatText.trim();
    if (!text) return;

    this.wsSend({ type: 'CHAT', message: text });
    this.chatText = '';
    this.chatInputRef?.nativeElement?.focus();
  }

  onChatKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChat();
    }
  }

  private addSystemMessage(text: string) {
    this.messages.push({
      username: '',
      message: text,
      timestamp: Date.now(),
      isSystem: true
    });
    this.scrollChat();
  }

  private scrollChat() {
    setTimeout(() => {
      const el = this.chatMessagesRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  // ===================== SHARE =====================

  copyLink() {
    navigator.clipboard.writeText(this.shareLink).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }

  // ===================== HELPERS =====================

  formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  getUserColor(username: string): string {
    const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316'];
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
}
