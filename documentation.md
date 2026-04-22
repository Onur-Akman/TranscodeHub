# Proje Ozeti — Video Transcoding & Streaming Platform

Spring Boot 4.0.3 (Java 25) backend + Angular 18 frontend + PostgreSQL 16 + Nginx (RTMP destekli).
Video yukleme, FFmpeg ile transcode (MP4/HLS/DASH), CMS ile film yonetimi, ve WebSocket tabanli
senkronize Watch Party ozelligi sunar. Docker Compose ile deploy edilir.

## Dosya Yapisi

```
image-server-page/
│
├── docker-compose.yml                  # postgres:16, backend, nginx servislerini ayaga kaldirir. Portlar: 80(http), 1935(rtmp), 5433(pg)
├── Dockerfile.backend                  # Multi-stage: maven build + amazoncorretto:25 runtime. FFmpeg ve Shaka Packager yukler
├── Dockerfile.frontend                 # Multi-stage: node:20 ng build + alpine nginx+rtmp. Dist dosyalarini /usr/share/nginx/html'e koyar
│
├── nginx/
│   └── nginx.conf                      # Reverse proxy: /api/* -> backend:8080, /ws/* -> backend (WebSocket upgrade), /videos/output/* -> static dosya servisi. RTMP port 1935, HLS icin CORS ve cache ayarlari, 2GB upload limiti
│
├── backend/src/main/
│   ├── resources/
│   │   ├── application.properties          # Lokal: pg localhost:5433, JWT secret, video/poster dizinleri, 2GB upload limiti
│   │   └── application-docker.properties   # Docker: pg postgres:5432, /app/videos/* dizinleri
│   │
│   └── java/com/transcoder/
│       │
│       ├── VideoTranscoderApplication.java     # Main class. @EnableAsync + @EnableScheduling
│       │
│       ├── config/
│       │   ├── SecurityConfig.java             # Spring Security: stateless JWT, CSRF off, BCrypt. Public: /api/auth/login, /api/cms/posters/*, /ws/**. ADMIN: register, users. Authenticated: /api/**
│       │   ├── JwtUtil.java                    # HMAC-SHA256 JWT. generateToken(username, role), getUsername(), getRole(), isValid()
│       │   ├── JwtAuthFilter.java              # OncePerRequestFilter: Authorization header'dan token alir, SecurityContext'e set eder
│       │   ├── WebSocketConfig.java            # /ws/watch-party/{roomId} endpointini WatchPartySocketService handler'ina baglar
│       │   ├── AsyncConfig.java                # Transcode islemleri icin thread pool: core=2, max=4, queue=10
│       │   ├── WebConfig.java                  # CORS: /api/** icin tum originlere izin verir
│       │   ├── SwaggerConfig.java              # OpenAPI 3.0 config, "TranscodeHub API" v1.0.0
│       │   ├── DataInitializer.java            # Uygulama baslarken admin/admin123 kullanici olusturur (yoksa)
│       │   ├── GlobalExceptionHandler.java     # @RestControllerAdvice: ResourceNotFoundException->404, UnauthorizedException->401, IllegalArgument->400
│       │   └── UnauthorizedException.java      # 401 icin custom RuntimeException
│       │
│       ├── controller/
│       │   ├── AuthController.java             # /api/auth — login(): POST /login (public, JWT doner), me(): GET /me, register(): POST /register (ADMIN), listUsers(): GET /users (ADMIN)
│       │   ├── TranscodeController.java        # /api — listInputVideos(): GET /videos/input, uploadVideo(): POST /videos/upload (multipart), startTranscode(): POST /transcode, getAllJobs(): GET /jobs, getJob(): GET /jobs/{id}, streamProgress(): GET /jobs/{id}/progress (SSE), cancelJob(): POST /jobs/{id}/cancel. Ayrica live recording: getRecordingSettings(), updateRecordingSettings(), getSegments()
│       │   ├── PresetController.java           # /api/presets — CRUD: getAllPresets(), getPreset(), createPreset(), updatePreset(), deletePreset()
│       │   ├── CmsController.java              # /api/cms — Film CRUD: getAllMovies(), getMovie(), saveMovie(), deleteMovie(). Poster: uploadPoster(), servePoster(). Subtitle: getSubtitles(), uploadSubtitle(), deleteSubtitle(), serveSubtitle(). Dub: getDubs(), uploadDub(), deleteDub(), serveDub(). Dosya listeleme: listSubtitleFiles(), listDubFiles()
│       │   └── WatchPartyController.java       # /api/watch-party — getWatchableMovies(): transcode'u COMPLETED olan filmleri listeler, createRoom(): UUID ile oda olusturur, getRoom(), getActiveRooms()
│       │
│       ├── service/
│       │   ├── AuthService.java                    # Interface: login, register, getCurrentUser, listUsers
│       │   ├── TranscodeService.java               # Interface: listInputVideos, uploadVideo, startTranscode, getAllJobs, getJob, streamProgress, cancelJob
│       │   ├── FFmpegService.java                  # Interface: getVideoDuration, runTranscode, cancelTranscode
│       │   ├── PresetService.java                  # Interface: findAll, findById, create, update, delete
│       │   ├── WatchPartyService.java              # Interface: getWatchableMovies, createRoom, getRoom, getActiveRooms
│       │   ├── WatchPartySocketService.java        # Interface: WebSocketHandler'i extend eder
│       │   ├── LiveRecordingService.java           # Interface: startRecording, stopRecording, restartRecording, getSettings, updateSettings, getSegments
│       │   │
│       │   └── Impl/
│       │       ├── AuthServiceImpl.java            # login(): BCrypt ile sifre dogrulama + JWT uretimi. register(): username/email uniqueness kontrolu. getCurrentUser(), listUsers()
│       │       ├── TranscodeServiceImpl.java        # startTranscode(): Job olusturur, preset'leri yukler, output dosya adi belirler (MP4: baseName_presetName.mp4, HLS/DASH: baseName_multi/master.m3u8|manifest.mpd), ffmpegService.runTranscode() async cagrilir. Live stream icin liveRecordingService.startRecording() tetiklenir. cancelJob(): ffmpeg process'i durdurur
│       │       ├── FFmpegServiceImpl.java          # Jaffree kutuphanesi ile FFmpeg calistirir. runTranscode(): async, job status/progress gunceller. processSingleMp4(): tek preset ile MP4. processLiveFfmpegMulti(): canli yayin icin multi-bitrate HLS/DASH (hls_time=4, hls_list_size=30). processVodShaka(): VOD icin FFmpeg encode + Shaka Packager ile paketleme. cancelTranscode(): future.forceStop() + pkill. createBaseFFmpeg(): progress listener ile ilerleme takibi
│       │       ├── WatchPartySocketServiceImpl.java # WebSocket handler. RoomState: videoPosition, isPlaying, pausedByUser, pauseLockUntil, bufferStatus, slowUserWaiting. afterConnectionEstablished(): JWT dogrulama, odaya ekleme, JOINED mesaji. handleTextMessage(): CHAT/PAUSE/PLAY/SEEK/BUFFER_STATUS/READY/REQUEST_SYNC switch. handlePause(): 120sn pause lock baslatir. handlePlay(): lock varsa PLAY_REJECTED doner. broadcastSync(): her 3sn SYNC mesaji, 15sn'de bir slow user kontrolu (>5sn geride ise durdurur), slow user 3sn buffer'ladiysa auto-resume
│       │       ├── PresetServiceImpl.java          # Basit CRUD, update icinde tum field'lari merge eder
│       │       ├── WatchPartyServiceImpl.java      # getWatchableMovies(): CmsMovie + TranscodeJob (COMPLETED) eslestirmesi. createRoom(): UUID id ile oda, movie metadata'sini kopyalar. getRoom(): oda + job bilgisi birlestirir
│       │       └── LiveRecordingServiceImpl.java   # startRecording(): FFmpeg segment komutu calistirir (copy codec, -f segment, strftime pattern). stopRecording(): process.destroy() + pkill. scanAndCleanSegments(): @Scheduled(30sn), yeni segment dosyalarini regex ile bulur, ffprobe ile sure olcer, DB'ye kaydeder. Retention suresi gecen segmentleri siler
│       │
│       ├── model/
│       │   ├── User.java                   # JPA entity. username (unique), password, email, phone, role (enum: ADMIN, USER)
│       │   ├── TranscodeJob.java           # JPA entity. inputFileName, outputFileName, inputUrl, presetIds (ElementCollection), presetNames, outputFormat, status (enum: QUEUED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED), progress (0-100), createdAt, completedAt, errorMessage
│       │   ├── EncodingPreset.java         # JPA entity. name, videoCodec, audioCodec, resolution, crf, maxRate, bufSize, audioBitrate, preset (encoding speed)
│       │   ├── CmsMovie.java              # JPA entity. imdbId (unique), title, year, rated, released, runtime, genre, director, actors, plot, poster, imdbRating, videoFileName, presetId, transcodeJobId. @PrePersist/@PreUpdate ile timestamp
│       │   ├── CmsSubtitle.java           # JPA entity. movieImdbId, language, fileName
│       │   ├── CmsDub.java               # JPA entity. movieImdbId, language, fileName
│       │   ├── WatchPartyRoom.java        # JPA entity. id (String/UUID), movieImdbId, transcodeJobId, movieTitle, moviePoster, hostUsername, active (default true), createdAt
│       │   ├── LiveStreamSettings.java    # JPA entity. jobId (unique), chunkDurationMinutes (default 30), retentionPeriodHours (default 168)
│       │   └── LiveStreamSegment.java     # JPA entity. jobId, fileName, startTime, endTime, durationSeconds, createdAt
│       │
│       ├── dto/
│       │   ├── LoginRequest.java               # username, password (@NotBlank)
│       │   ├── LoginResponse.java              # token, username, role
│       │   ├── RegisterRequest.java            # username, password, email (@Email), phone
│       │   ├── UserResponse.java               # id, username, email, phone, role, message
│       │   ├── TranscodeRequest.java           # inputFileName (veya inputUrl), presetIds[], outputFormat
│       │   ├── UploadResponse.java             # message, fileName
│       │   ├── CreateRoomRequest.java          # movieImdbId, transcodeJobId
│       │   ├── WatchPartyRoomResponse.java     # Room + job outputFileName/outputFormat bilgisi
│       │   └── WatchableMovieResponse.java     # Movie metadata + job id/outputFileName/outputFormat/presetNames
│       │
│       ├── repository/
│       │   ├── UserRepository.java                 # findByUsername(), existsByUsername(), existsByEmail()
│       │   ├── JobRepository.java                  # findAllByOrderByCreatedAtDesc()
│       │   ├── PresetRepository.java               # Standart CRUD
│       │   ├── CmsMovieRepository.java             # findByImdbId(), existsByImdbId()
│       │   ├── CmsSubtitleRepository.java          # findByMovieImdbId()
│       │   ├── CmsDubRepository.java               # findByMovieImdbId()
│       │   ├── WatchPartyRoomRepository.java       # findByActiveTrueOrderByCreatedAtDesc()
│       │   ├── LiveStreamSettingsRepository.java   # findByJobId()
│       │   └── LiveStreamSegmentRepository.java    # findByJobIdOrderByStartTimeAsc(), existsByFileName()
│       │
│       └── exception/
│           └── ResourceNotFoundException.java      # 404 icin custom RuntimeException
│
└── frontend/src/
    ├── main.ts                                     # Angular bootstrap
    ├── index.html                                  # SPA root HTML
    ├── styles.scss                                 # Global stiller
    │
    └── app/
        ├── app.component.ts        # Root layout: sidebar (dark mode toggle, role-based menu, logout) + router-outlet. Login sayfasinda sidebar gizlenir
        ├── app.config.ts           # provideHttpClient(withInterceptors([authInterceptor])), provideRouter(routes)
        ├── app.routes.ts           # Lazy-loaded rotalar: /login (public), /admin (adminGuard), /presets, /transcode, /status, /live-stream, /cms, /player/:jobId, /watch-party, /watch-party/room/:roomId (hepsi authGuard)
        │
        ├── interceptors/
        │   └── auth.interceptor.ts     # Her HTTP istegine Authorization: Bearer token ekler (login ve external URL haric). 401/403'te localStorage temizler, /login'e yonlendirir
        │
        ├── guards/
        │   ├── auth.guard.ts           # AuthService.isLoggedIn() kontrolu, degilse /login'e yonlendirir
        │   └── admin.guard.ts          # AuthService.isAdmin() kontrolu, degilse /status'a yonlendirir
        │
        ├── services/
        │   ├── auth.service.ts         # login(): POST /api/auth/login, token+user'i localStorage'a kaydeder. logout(): localStorage temizler. register(), getUsers(). isLoggedIn(), isAdmin(), getToken(), getUser()
        │   └── api.service.ts          # Tum backend API cagrilarini sarar. Preset CRUD, video upload/list, transcode job baslat/listele/iptal, SSE progress (EventSource), live recording settings/segments, CMS movie/subtitle/dub CRUD, watch party movies/rooms. Interface tanimlari: EncodingPreset, TranscodeJob, TranscodeRequest, LiveStreamSettings, LiveStreamSegment
        │
        └── pages/
            ├── login-page/
            │   └── login-page.component.ts         # Login formu (username/password). Basarili giriste admin ise /admin, degilse /status'a yonlendirir
            │
            ├── admin-page/
            │   └── admin-page.component.ts         # Admin paneli: kullanici istatistikleri (toplam/admin/user), yeni kullanici olusturma formu (email validation), kullanici tablosu
            │
            ├── preset-page/
            │   └── preset-page.component.ts        # Encoding preset yonetimi: tablo + olusturma/duzenleme formu. Codec, resolution, bitrate, CRF, speed preset secenekleri dropdown ile
            │
            ├── transcode-page/
            │   └── transcode-page.component.ts     # Transcode baslat: format sec (MP4/HLS/DASH), video sec veya yukle, preset sec (multi-select, MP4'te tek preset uyarisi). Baslatinca /status'a gider
            │
            ├── status-page/
            │   └── status-page.component.ts        # Dashboard: job istatistikleri (completed/in-progress/queued/failed), job tablosu (progress bar, status badge). Cancel, live stream ayarlari modali (chunk/retention), tamamlananlari player'da ac
            │
            ├── live-stream-page/
            │   └── live-stream-page.component.ts   # RTMP URL girerek canli yayin transcode baslatir. Sadece HLS/DASH format. Multi-preset secimi
            │
            ├── cms-page/
            │   └── cms-page.component.ts           # Film yonetimi: OMDB API ile arama/IMDb ID ile cekme, film metadata duzenleme modali, poster yukleme, subtitle/dub yukleme (dil secimli), video dosyasi ve preset secimi, transcode job baslat
            │
            ├── player-page/
            │   └── player-page.component.ts        # Video oynatici: HLS.js + Shaka Player. Kalite secici, subtitle/dub dil degistirme, live stream segment timeline (tiklanabilir), video bilgi karti, MP4 icin indirme butonu
            │
            ├── watch-party-page/
            │   └── watch-party-page.component.ts   # Transcode'u tamamlanmis filmleri listeler, poster ile gosterir. "Create Room" ile oda olusturur
            │
            └── watch-party-room-page/
                └── watch-party-room-page.component.ts  # Senkronize izleme odasi: WebSocket ile /ws/watch-party/{roomId}?token=JWT baglantisi. Shaka Player entegrasyonu, kalite/subtitle/dub secimi. Play/Pause/Seek komutlari sunucuya gider, sunucu herkese broadcast eder. Pause lock gostergesi (120sn), slow user bildirimi, chat mesajlari, kullanici listesi, paylasim linki kopyalama. Her 3sn SYNC mesaji ile pozisyon senkronize edilir
```
