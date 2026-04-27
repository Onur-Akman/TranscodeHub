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

## UML Use Case ve Flow Senaryolari

Bu bolum, sistemin "cop adamli" UML use case diyagramini, ana is akislarini ve her akis icin senaryo tablolarini icerir.

### Diyagramlar

#### UML Use Case Diagram

![UML Use Case Diagram](diagrams/UseCaseDiagram.svg)

#### Giris ve Admin Flow

![Flow Auth Admin](diagrams/FlowAuthAdmin.svg)

#### VOD Transcode Flow

![Flow VOD Transcode](diagrams/FlowVodTranscode.svg)

#### CMS Film Flow

![Flow CMS Movie](diagrams/FlowCmsMovie.svg)

#### Live Stream Flow

![Flow Live Stream](diagrams/FlowLiveStream.svg)

#### Watch Party Flow

![Flow Watch Party](diagrams/FlowWatchParty.svg)

### Diyagram Dosyalari

| Diyagram | Aciklama | PlantUML kaynak | SVG |
|---|---|---|---|
| UML Use Case Diagram | Aktorler ve sistemdeki ana use case'ler | [diagrams/5-use-case-diagram.puml](diagrams/5-use-case-diagram.puml) | [diagrams/UseCaseDiagram.svg](diagrams/UseCaseDiagram.svg) |
| Giris ve Admin Flow | Login, JWT olusumu ve admin kullanici olusturma akisi | [diagrams/6-flow-auth-admin.puml](diagrams/6-flow-auth-admin.puml) | [diagrams/FlowAuthAdmin.svg](diagrams/FlowAuthAdmin.svg) |
| VOD Transcode Flow | Video yukleme/secme, transcode baslatma, job takip ve player akisi | [diagrams/7-flow-vod-transcode.puml](diagrams/7-flow-vod-transcode.puml) | [diagrams/FlowVodTranscode.svg](diagrams/FlowVodTranscode.svg) |
| CMS Film Flow | OMDb arama, film kaydi, poster/altyazi/dublaj ve CMS kaynakli transcode | [diagrams/8-flow-cms-movie.puml](diagrams/8-flow-cms-movie.puml) | [diagrams/FlowCmsMovie.svg](diagrams/FlowCmsMovie.svg) |
| Live Stream Flow | RTMP kaynakli canli yayin transcode, recording ve segment takibi | [diagrams/9-flow-live-stream.puml](diagrams/9-flow-live-stream.puml) | [diagrams/FlowLiveStream.svg](diagrams/FlowLiveStream.svg) |
| Watch Party Flow | Oda olusturma, WebSocket ile katilma, senkron izleme ve chat/ses akisi | [diagrams/10-flow-watch-party.puml](diagrams/10-flow-watch-party.puml) | [diagrams/FlowWatchParty.svg](diagrams/FlowWatchParty.svg) |

### Aktorler

| Aktor | Sistemdeki rol | Temel yetkiler |
|---|---|---|
| Ziyaretci | Henuz login olmamis kullanici | Login sayfasina erisir, kimlik dogrulama baslatir |
| Kullanici | JWT ile giris yapmis standart kullanici | Preset gorur/yonetir, video yukler, transcode baslatir, job izler, player ve watch party kullanir |
| Admin | ADMIN rolune sahip kullanici | Kullanici yonetimi ve CMS film yonetimi yapar; standart kullanici yetkilerinin tamamini da kullanir |
| RTMP Kaynagi | Harici canli yayin kaynagi | Canli stream URL'i backend tarafindan okunur |
| OMDb API | Harici film metadata servisi | CMS film aramalarina film bilgisi ve poster URL'i doner |
| FFmpeg / Shaka Packager | Harici medya isleme araci | MP4/HLS/DASH encode ve paketleme islemlerini yapar |

### Use Case Ozet Tablosu

| ID | Use case | Birincil aktor | Tetikleyici | Cikti |
|---|---|---|---|---|
| UC-01 | Giris yap | Ziyaretci | Username/password girilir | JWT token, username ve role bilgisi |
| UC-02 | Admin kullanici yonetimi | Admin | Admin paneli acilir | Yeni USER kaydi veya kullanici listesi |
| UC-03 | Encoding preset yonetimi | Kullanici | Preset sayfasi acilir | Preset CRUD kayitlari |
| UC-04 | VOD transcode baslat | Kullanici | Video, format ve preset secilir | QUEUED/IN_PROGRESS transcode job |
| UC-05 | Job takip, iptal ve oynatma | Kullanici | Status sayfasi acilir | Job durumu, cancel sonucu veya player gorunumu |
| UC-06 | CMS film yonetimi | Admin | Film arama/edit islemi yapilir | CmsMovie, poster, subtitle, dub ve opsiyonel transcode job |
| UC-07 | Canli yayin transcode | Kullanici | RTMP URL ve preset secilir | LIVE_STREAM job, HLS/DASH output ve recording segmentleri |
| UC-08 | Video player kullanimi | Kullanici | Player sayfasi acilir | Video oynatma, kalite/altyazi/dublaj secimi, MP4 indirme |
| UC-09 | Watch Party odasi olustur | Kullanici | Tamamlanmis film secilir | UUID room kaydi ve oda sayfasi |
| UC-10 | Watch Party odasinda senkron izleme | Kullanici | Odaya JWT ile WebSocket baglanir | Senkron play/pause/seek, chat, voice/video signaling |

### Senaryo Detay Tablolari

#### UC-01 - Giris Yap

| Alan | Aciklama |
|---|---|
| Birincil aktor | Ziyaretci |
| On kosul | Kullanici kaydi veritabaninda bulunur |
| Ana akis | 1. Kullanici `/login` sayfasinda username/password girer.<br>2. Frontend `POST /api/auth/login` istegi atar.<br>3. Backend kullaniciyi bulur ve BCrypt ile sifreyi dogrular.<br>4. JWT uretilir ve frontend'e doner.<br>5. Frontend token/user bilgisini localStorage'a kaydeder.<br>6. Admin ise `/admin`, degilse `/status` sayfasina yonlendirir. |
| Alternatif akis | Sifre veya kullanici hataliysa backend 401/400 tarzi hata doner, frontend login hatasi gosterir. |
| Sonuc | Authenticated HTTP isteklerinde Authorization Bearer token kullanilir. |

#### UC-02 - Admin Kullanici Yonetimi

| Alan | Aciklama |
|---|---|
| Birincil aktor | Admin |
| On kosul | Admin JWT ile giris yapmistir; endpoint `hasRole('ADMIN')` ister. |
| Ana akis | 1. Admin `/admin` sayfasini acar.<br>2. Frontend `GET /api/auth/users` ile mevcut kullanicilari listeler.<br>3. Admin username, password, email ve phone girer.<br>4. Frontend `POST /api/auth/register` istegi atar.<br>5. Backend username/email unique kontrolu yapar, sifreyi hashler ve USER rolunde kayit olusturur.<br>6. Frontend tabloyu yeniler. |
| Alternatif akis | Email formati hataliysa frontend submit'i engeller; username/email kullaniliyorsa backend hata doner. |
| Sonuc | Sisteme yeni standart kullanici eklenir. |

#### UC-03 - Encoding Preset Yonetimi

| Alan | Aciklama |
|---|---|
| Birincil aktor | Kullanici |
| On kosul | Kullanici login olmustur. |
| Ana akis | 1. Kullanici `/presets` sayfasini acar.<br>2. Frontend `GET /api/presets` ile preset listesini alir.<br>3. Kullanici codec, resolution, CRF, bitrate ve speed bilgilerini girer.<br>4. Olusturma icin `POST /api/presets`, guncelleme icin `PUT /api/presets/{id}`, silme icin `DELETE /api/presets/{id}` kullanilir.<br>5. Preset listesi guncellenir. |
| Alternatif akis | Validation hatasinda backend hata doner; frontend kayit/guncelleme sonucunu gosterir. |
| Sonuc | Transcode islemlerinde kullanilabilecek EncodingPreset kayitlari hazir olur. |

#### UC-04 - VOD Transcode Baslatma

| Alan | Aciklama |
|---|---|
| Birincil aktor | Kullanici |
| On kosul | En az bir input video ve en az bir preset bulunur; kullanici login olmustur. |
| Ana akis | 1. Kullanici `/transcode` sayfasini acar.<br>2. Frontend input videolari ve presetleri yukler.<br>3. Kullanici MP4/HLS/DASH formatini secer.<br>4. Kullanici mevcut video secer veya `POST /api/videos/upload` ile yeni video yukler.<br>5. Kullanici preset secer ve `POST /api/transcode` istegi atilir.<br>6. Backend input dosyasini ve presetleri validate eder.<br>7. `TranscodeJob` QUEUED olarak kaydedilir.<br>8. `FFmpegService.runTranscode` async calisir.<br>9. Frontend `/status` sayfasina gider. |
| Alternatif akis | Input dosyasi yoksa, preset yoksa veya file bos ise backend hata doner; frontend baslatma/yukleme hatasi gosterir. |
| Sonuc | Job IN_PROGRESS/COMPLETED/FAILED/CANCELLED durumlarindan birine ilerler. |

#### UC-05 - Job Takip, Iptal ve Oynatma

| Alan | Aciklama |
|---|---|
| Birincil aktor | Kullanici |
| On kosul | En az bir TranscodeJob olusturulmustur. |
| Ana akis | 1. Kullanici `/status` sayfasini acar.<br>2. Frontend `GET /api/jobs` ile job listesini alir ve 5 sn aralikla yeniler.<br>3. Dashboard completed/in-progress/queued/failed sayilarini gosterir.<br>4. Job IN_PROGRESS veya QUEUED ise kullanici `POST /api/jobs/{id}/cancel` ile iptal edebilir.<br>5. Job COMPLETED ise kullanici `/player/{jobId}` sayfasinda izler.<br>6. Live stream job IN_PROGRESS ise player canli yayin olarak acilir. |
| Alternatif akis | Iptal sadece QUEUED veya IN_PROGRESS job icin etkili olur; FAILED/CANCELLED job player'da hazir degildir. |
| Sonuc | Kullanici medya isleme durumunu takip eder ve tamamlanan output'u izler. |

#### UC-06 - CMS Film Yonetimi

| Alan | Aciklama |
|---|---|
| Birincil aktor | Admin |
| On kosul | Admin login olmustur; film kaydetme ve medya yukleme endpointleri ADMIN ister. |
| Ana akis | 1. Admin `/cms` sayfasinda film adi veya IMDb ID ile OMDb aramasi yapar.<br>2. Film detayi/edit modal acilir.<br>3. Metadata duzenlenir; video dosyasi ve preset secilir.<br>4. Poster, subtitle veya dub dosyalari opsiyonel olarak yuklenir.<br>5. `POST /api/cms/movies` ile CmsMovie upsert edilir.<br>6. Video/preset degismisse frontend HLS transcode baslatir.<br>7. Olusan job id tekrar CmsMovie kaydina yazilir. |
| Alternatif akis | OMDb cevap vermezse arama hatasi gosterilir; poster upload hata verirse film kaydi yine saklanabilir; transcode baslamazsa film metadata kaydi kalir. |
| Sonuc | Film katalogda gorunur; tamamlanan transcode sonrasi player ve watch party icin kullanilabilir. |

#### UC-07 - Canli Yayin Transcode ve Recording

| Alan | Aciklama |
|---|---|
| Birincil aktor | Kullanici |
| On kosul | RTMP kaynagi backend tarafindan erisilebilir; en az bir preset vardir. |
| Ana akis | 1. Kullanici `/live-stream` sayfasinda RTMP URL girer.<br>2. HLS veya DASH format secer ve birden fazla preset secebilir.<br>3. `POST /api/transcode` istegi `inputUrl` ile atilir.<br>4. Backend job'u `inputFileName = LIVE_STREAM` olarak kaydeder.<br>5. FFmpeg live transcode baslar.<br>6. LiveRecordingService recording baslatir ve segmentleri DB'ye kaydeder.<br>7. Status sayfasindan recording settings duzenlenebilir.<br>8. Player canli output'u ve segment timeline'i gosterir. |
| Alternatif akis | RTMP URL hataliysa veya FFmpeg stream'e ulasamazsa job FAILED olur; kullanici job'u iptal ederse FFmpeg ve recording durur. |
| Sonuc | Canli yayin HLS/DASH olarak izlenebilir ve retention ayarina gore segmentlenmis kayit tutulur. |

#### UC-08 - Video Player Kullanimi

| Alan | Aciklama |
|---|---|
| Birincil aktor | Kullanici |
| On kosul | Job COMPLETED olmalidir; live stream icin job IN_PROGRESS iken de player acilabilir. |
| Ana akis | 1. Kullanici `/player/{jobId}` sayfasini acar.<br>2. Frontend `GET /api/jobs/{id}` ile job bilgisini alir.<br>3. Output HLS ise HLS.js, DASH ise Shaka Player, MP4 ise native video kullanilir.<br>4. CMS filmiyle iliskili altyazi/dublaj varsa secenekler yuklenir.<br>5. Kullanici kalite, subtitle veya dub secebilir.<br>6. Live stream icin segment timeline'dan gecmis segment oynatilabilir. |
| Alternatif akis | Job hazir degilse "Video not ready" durumu gosterilir; video dosyasi yuklenemezse hata karti gorunur. |
| Sonuc | Kullanici transcode edilmis medyayi oynatir, kalite ve dil seceneklerini kontrol eder. |

#### UC-09 - Watch Party Odasi Olusturma

| Alan | Aciklama |
|---|---|
| Birincil aktor | Kullanici |
| On kosul | CMS filminde `transcodeJobId` vardir ve ilgili job COMPLETED durumundadir. |
| Ana akis | 1. Kullanici `/watch-party` sayfasini acar.<br>2. Frontend `GET /api/watch-party/movies` ile izlenebilir filmleri alir.<br>3. Backend sadece COMPLETED job'a sahip CMS filmlerini doner.<br>4. Kullanici film secip `POST /api/watch-party/rooms` istegi atar.<br>5. Backend UUID room id olusturur, host username'i kaydeder.<br>6. Frontend `/watch-party/room/{roomId}` sayfasina gider. |
| Alternatif akis | Film veya job bulunamazsa oda olusmaz; izlenebilir film yoksa liste bos kalir. |
| Sonuc | Paylasilabilir WatchPartyRoom olusur. |

#### UC-10 - Watch Party Senkron Izleme

| Alan | Aciklama |
|---|---|
| Birincil aktor | Kullanici |
| On kosul | Kullanici login olmustur; oda id gecerli olmalidir. |
| Ana akis | 1. Room page `GET /api/watch-party/rooms/{roomId}` ile oda bilgisini alir.<br>2. Player output dosyasini hazirlar.<br>3. Frontend `/ws/watch-party/{roomId}?token=JWT` WebSocket baglantisi acar.<br>4. Backend JWT'yi validate eder, kullaniciyi room state'e ekler ve JOINED mesaji yollar.<br>5. Play/pause/seek aksiyonlari backend'e gider ve tum kullanicilara broadcast edilir.<br>6. Backend her 3 sn SYNC mesaji yollar.<br>7. Chat mesajlari broadcast edilir.<br>8. WebRTC offer/answer/ice mesajlari hedef kullaniciya relay edilir. |
| Alternatif akis | Token gecersizse WebSocket kapanir; baska kullanici 120 sn pause lock icindeyken play istegi reddedilir; yavas kullanici 5 sn'den fazla gerideyse video ona senkron edilir ve buffer toparlaninca devam eder. |
| Sonuc | Odadaki kullanicilar ayni filmi senkron sekilde izler ve chat/ses/video ile iletisim kurar. |
