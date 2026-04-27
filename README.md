# Video Transcoding & Streaming Platform

![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.0.3-6DB33F?logo=springboot&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-18-DD0031?logo=angular&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

A full-stack video transcoding, CMS, live streaming, and synchronized watch party platform.

The project combines a Spring Boot backend, Angular frontend, PostgreSQL database, FFmpeg-based media processing, Nginx static/video delivery, RTMP ingest, HLS/DASH playback, and WebSocket-powered watch party synchronization.

## Features

- Video upload and input video listing
- MP4, HLS, and MPEG-DASH transcoding with FFmpeg
- Multi-bitrate HLS/DASH output using encoding presets
- Encoding preset management
- Transcoding job dashboard with progress, status, cancellation, and playback actions
- CMS movie management with OMDb metadata lookup
- Poster, subtitle, and dubbed audio upload support
- HLS.js, Shaka Player, and native MP4 playback
- Live RTMP stream transcoding to HLS/DASH
- Live stream recording settings and segment timeline playback
- JWT authentication with role-based admin features
- WebSocket watch party rooms with synchronized play, pause, seek, chat, and WebRTC signaling support
- Docker Compose deployment with PostgreSQL, backend, frontend, Nginx, and RTMP support

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 18, RxJS, HLS.js, Shaka Player |
| Backend | Spring Boot 4.0.3, Java 25, Spring Security, WebSocket, JPA |
| Database | PostgreSQL 16 |
| Media | FFmpeg, Shaka Packager |
| Gateway | Nginx with RTMP module |
| Deployment | Docker, Docker Compose |

## Architecture

```text
Angular SPA
   |
   | HTTP / WebSocket
   v
Nginx reverse proxy + RTMP server
   |
   | /api, /ws
   v
Spring Boot backend
   |
   | JPA
   v
PostgreSQL

Spring Boot -> FFmpeg / Shaka Packager -> videos/output
Nginx -> static HLS/DASH/MP4 delivery from videos/output
```

## Quick Start

### Prerequisites

- Docker
- Docker Compose

### Run with Docker Compose

```bash
docker compose up --build
```

After the services start:

- Web app: http://localhost
- Swagger UI: http://localhost/swagger-ui/index.html
- Health check: http://localhost/health
- PostgreSQL host port: `5433`
- RTMP ingest port: `1935`

Default admin account:

```text
username: admin
password: admin123
```

> Change the default admin password and JWT secret before using this outside local development.

## RTMP Live Stream Example

Push a local video file to the Nginx RTMP endpoint:

```bash
ffmpeg -re -i sample.mp4 -c copy -f flv rtmp://localhost:1935/live/test
```

Then start a live transcode job from the app with this internal Docker URL:

```text
rtmp://transcoder-nginx:1935/live/test
```

## Main Application Areas

| Area | Description |
|---|---|
| Login | JWT-based authentication and role-aware routing |
| Admin | User listing and user creation for admins |
| Presets | Encoding preset CRUD for bitrate, resolution, codec, CRF, and speed settings |
| Transcode | Upload/select videos and start MP4, HLS, or DASH jobs |
| Dashboard | Monitor jobs, cancel active jobs, and open completed videos |
| Live Stream | Start RTMP-based live HLS/DASH transcode jobs |
| CMS | Manage movie metadata, posters, subtitles, dubs, and CMS-linked transcode jobs |
| Player | Play MP4/HLS/DASH output with quality, subtitle, dub, and live segment controls |
| Watch Party | Create synchronized viewing rooms with chat and playback sync |

## Important Directories

```text
backend/                 Spring Boot backend
frontend/                Angular frontend
nginx/nginx.conf         Reverse proxy, static video serving, and RTMP config
videos/input/            Uploaded/input videos
videos/output/           Transcoded MP4, HLS, and DASH output
posters/                 Uploaded CMS poster files
documentation.md         Project documentation, UML use cases, and flow scenarios
diagrams/                PlantUML diagram sources and generated diagram files
```

## API Overview

| Endpoint group | Purpose |
|---|---|
| `/api/auth` | Login, current user, admin user registration, user listing |
| `/api/presets` | Encoding preset CRUD |
| `/api/videos` | Input video listing and upload |
| `/api/transcode` | Start VOD or live stream transcode jobs |
| `/api/jobs` | Job listing, job details, cancellation, recording settings, live segments |
| `/api/cms` | Movie metadata, posters, subtitles, and dubs |
| `/api/watch-party` | Watchable movie listing and room management |
| `/ws/watch-party/{roomId}` | Watch party synchronization WebSocket |

## Local Development Notes

Docker Compose is the recommended way to run the complete stack because it wires together PostgreSQL, backend paths, Nginx video serving, WebSocket proxying, and RTMP ingest.

For backend-only development, start PostgreSQL first and run:

```bash
cd backend
mvn spring-boot:run
```

For frontend-only development:

```bash
cd frontend
npm install
npm start
```

When using the Angular dev server directly, configure a development proxy for `/api`, `/ws`, and `/videos/output` or run the full Docker/Nginx stack.

## Documentation

More detailed project notes, UML use case diagrams, flow diagrams, and scenario tables are available in [documentation.md](documentation.md).

## Security Notes

- The default admin account is created automatically for development.
- The JWT secret in `application.properties` is a development value.
- Public production deployment should use environment-specific secrets, stronger credential management, HTTPS, and restricted CORS rules.

## License

No license has been specified yet.
