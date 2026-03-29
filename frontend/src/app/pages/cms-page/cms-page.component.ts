import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService, EncodingPreset } from '../../services/api.service';

interface OmdbMovie { Title: string; Year: string; imdbID: string; Type: string; Poster: string; }
interface OmdbSearchResult { Search: OmdbMovie[]; totalResults: string; Response: string; Error?: string; }
interface OmdbDetailResult { Title: string; Year: string; Rated: string; Released: string; Runtime: string; Genre: string; Director: string; Actors: string; Plot: string; Poster: string; imdbRating: string; imdbID: string; Response: string; Error?: string; }

@Component({
  selector: 'app-cms-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cms-page.component.html',
  styleUrl: './cms-page.component.scss'
})
export class CmsPageComponent implements OnInit {
  private readonly API_KEY = 'b0c2c7b4';
  private readonly BASE_URL = 'https://www.omdbapi.com/';

  searchQuery = ''; imdbIdQuery = ''; movies: OmdbMovie[] = [];
  searching = false; errorMessage = ''; successMessage = '';
  selectedMovie: OmdbMovie | null = null; movieDetail: OmdbDetailResult | null = null;

  editMode = false; editData: OmdbDetailResult | null = null; saving = false;
  selectedPosterFile: File | null = null; posterPreviewUrl: string | null = null;
  movieOverrides: Record<string, any> = {};
  filterMode: 'all' | 'uploaded' = 'all'; filterOpen = false;

  // Media fields
  inputVideos: string[] = []; presets: EncodingPreset[] = [];
  editVideoFileName = ''; editPresetId: number | null = null;

  // Subtitles & Dubs
  subtitles: any[] = []; dubs: any[] = [];
  subtitleLang = ''; subtitleFile: File | null = null;
  dubLang = ''; dubFile: File | null = null;
  uploadingSub = false; uploadingDub = false;
  subtitleFiles: string[] = []; dubFiles: string[] = [];
  uploadingVideo = false; uploadVideoName = '';

  constructor(private http: HttpClient, private auth: AuthService, private api: ApiService, private router: Router) { }

  get isAdmin(): boolean { return this.auth.isAdmin(); }

  ngOnInit() { this.loadOverrides(); this.loadDefaultMovies(); this.loadMediaOptions(); }

  loadMediaOptions() {
    this.api.getInputVideos().subscribe(v => this.inputVideos = v);
    this.api.getPresets().subscribe(p => this.presets = p);
    this.api.getSubtitleFiles().subscribe(f => this.subtitleFiles = f);
    this.api.getDubFiles().subscribe(f => this.dubFiles = f);
  }

  loadOverrides() {
    this.api.getAllCmsMovies().subscribe({
      next: (movies) => { this.movieOverrides = {}; for (const m of movies) { this.movieOverrides[m.imdbId] = m; } },
      error: () => { }
    });
  }

  getMoviePoster(movie: OmdbMovie): string {
    const o = this.movieOverrides[movie.imdbID];
    if (o?.poster) return o.poster;
    return movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
  }
  getMovieTitle(movie: OmdbMovie): string { return this.movieOverrides[movie.imdbID]?.title || movie.Title; }
  getMovieYear(movie: OmdbMovie): string { return this.movieOverrides[movie.imdbID]?.year || movie.Year; }

  hasTranscodedVideo(movie: OmdbMovie): boolean { return !!this.movieOverrides[movie.imdbID]?.transcodeJobId; }

  get displayedMovies(): OmdbMovie[] {
    if (this.filterMode === 'uploaded') {
      return Object.values(this.movieOverrides)
        .filter((m: any) => m.transcodeJobId)
        .map((m: any) => ({ Title: m.title || '', Year: m.year || '', imdbID: m.imdbId, Type: 'movie', Poster: m.poster || 'N/A' } as OmdbMovie));
    }
    return this.movies;
  }

  setFilter(mode: 'all' | 'uploaded') { this.filterMode = mode; this.filterOpen = false; }

  loadDefaultMovies() {
    const terms = ['Marvel', 'Batman', 'Star Wars', 'Inception'];
    this.searchQuery = terms[Math.floor(Math.random() * terms.length)];
    this.searchMovies();
  }

  searchMovies() {
    if (!this.searchQuery.trim()) return;
    this.searching = true; this.errorMessage = ''; this.successMessage = ''; this.movies = []; this.filterMode = 'all';
    this.http.get<OmdbSearchResult>(`${this.BASE_URL}?apikey=${this.API_KEY}&s=${encodeURIComponent(this.searchQuery.trim())}`).subscribe({
      next: (res) => { this.searching = false; if (res.Response === 'True' && res.Search) this.movies = res.Search; else this.errorMessage = res.Error || 'No movies found.'; },
      error: () => { this.searching = false; this.errorMessage = 'Failed to fetch movies.'; }
    });
  }

  searchByImdbId() {
    if (!this.imdbIdQuery.trim()) return;
    this.searching = true; this.errorMessage = ''; this.successMessage = ''; this.movies = []; this.filterMode = 'all';
    this.http.get<OmdbDetailResult>(`${this.BASE_URL}?apikey=${this.API_KEY}&i=${encodeURIComponent(this.imdbIdQuery.trim())}`).subscribe({
      next: (res) => { this.searching = false; if (res.Response === 'True') this.movies = [{ Title: res.Title, Year: res.Year, imdbID: res.imdbID, Type: 'movie', Poster: res.Poster }]; else this.errorMessage = res.Error || 'Movie not found.'; },
      error: () => { this.searching = false; this.errorMessage = 'Failed to fetch movie.'; }
    });
  }

  private mergeOverride(res: OmdbDetailResult): OmdbDetailResult {
    const o = this.movieOverrides[res.imdbID];
    if (o) {
      res.Title = o.title || res.Title; res.Year = o.year || res.Year; res.Rated = o.rated || res.Rated;
      res.Released = o.released || res.Released; res.Runtime = o.runtime || res.Runtime; res.Genre = o.genre || res.Genre;
      res.Director = o.director || res.Director; res.Actors = o.actors || res.Actors; res.Plot = o.plot || res.Plot;
      res.Poster = o.poster || res.Poster; res.imdbRating = o.imdbRating || res.imdbRating;
    }
    return res;
  }

  openMovieDetail(movie: OmdbMovie) {
    this.selectedMovie = movie; this.movieDetail = null; this.editMode = false; this.editData = null;
    this.http.get<OmdbDetailResult>(`${this.BASE_URL}?apikey=${this.API_KEY}&i=${movie.imdbID}&plot=full`).subscribe({
      next: (res) => { if (res.Response === 'True') this.movieDetail = this.mergeOverride(res); },
      error: () => this.closeDetail()
    });
  }

  openEditModal(movie: OmdbMovie) {
    this.selectedMovie = movie; this.editMode = true; this.editData = null; this.movieDetail = null;
    this.selectedPosterFile = null; this.posterPreviewUrl = null;
    this.subtitles = []; this.dubs = []; this.subtitleLang = ''; this.dubLang = '';
    this.subtitleFile = null; this.dubFile = null;

    const o = this.movieOverrides[movie.imdbID];
    this.editVideoFileName = o?.videoFileName || '';
    this.editPresetId = o?.presetId || null;

    this.http.get<OmdbDetailResult>(`${this.BASE_URL}?apikey=${this.API_KEY}&i=${movie.imdbID}&plot=full`).subscribe({
      next: (res) => { if (res.Response === 'True') this.editData = { ...this.mergeOverride(res) }; },
      error: () => this.closeDetail()
    });

    this.api.getSubtitles(movie.imdbID).subscribe(s => this.subtitles = s);
    this.api.getDubs(movie.imdbID).subscribe(d => this.dubs = d);
  }

  closeDetail() {
    this.selectedMovie = null; this.movieDetail = null; this.editMode = false; this.editData = null;
    this.selectedPosterFile = null; this.posterPreviewUrl = null;
  }

  onEditClick(e: Event, m: OmdbMovie) { e.stopPropagation(); this.openEditModal(m); }
  onWatchClick(e: Event, m: OmdbMovie) {
    e.stopPropagation();
    const o = this.movieOverrides[m.imdbID];
    if (o?.transcodeJobId) { this.router.navigate(['/player', o.transcodeJobId], { queryParams: { imdbId: m.imdbID } }); }
    else { this.openMovieDetail(m); }
  }

  onPosterFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedPosterFile = input.files[0];
      const reader = new FileReader();
      reader.onload = () => this.posterPreviewUrl = reader.result as string;
      reader.readAsDataURL(this.selectedPosterFile);
    }
  }

  onSubtitleFileSelected(event: Event) { const i = event.target as HTMLInputElement; if (i.files?.length) this.subtitleFile = i.files[0]; }
  onDubFileSelected(event: Event) { const i = event.target as HTMLInputElement; if (i.files?.length) this.dubFile = i.files[0]; }

  onVideoFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.uploadVideoName = file.name;
    this.uploadingVideo = true;
    this.api.uploadVideo(file).subscribe({
      next: (res: any) => {
        this.uploadingVideo = false;
        this.editVideoFileName = res.fileName;
        this.api.getInputVideos().subscribe(v => this.inputVideos = v);
      },
      error: () => { this.uploadingVideo = false; }
    });
  }

  uploadSubtitle() {
    if (!this.subtitleFile || !this.subtitleLang.trim() || !this.editData) return;
    this.uploadingSub = true;
    this.api.uploadSubtitle(this.editData.imdbID, this.subtitleFile, this.subtitleLang.trim()).subscribe({
      next: (s) => { this.subtitles.push(s); this.subtitleFile = null; this.subtitleLang = ''; this.uploadingSub = false; },
      error: () => { this.uploadingSub = false; }
    });
  }

  deleteSubtitle(id: number) {
    this.api.deleteSubtitle(id).subscribe(() => this.subtitles = this.subtitles.filter(s => s.id !== id));
  }

  uploadDub() {
    if (!this.dubFile || !this.dubLang.trim() || !this.editData) return;
    this.uploadingDub = true;
    this.api.uploadDub(this.editData.imdbID, this.dubFile, this.dubLang.trim()).subscribe({
      next: (d) => { this.dubs.push(d); this.dubFile = null; this.dubLang = ''; this.uploadingDub = false; },
      error: () => { this.uploadingDub = false; }
    });
  }

  deleteDub(id: number) {
    this.api.deleteDub(id).subscribe(() => this.dubs = this.dubs.filter(d => d.id !== id));
  }

  saveEdits() {
    if (!this.editData) return;
    this.saving = true;
    const existing = this.movieOverrides[this.editData.imdbID];

    // Determine if transcode is needed BEFORE saving (compare against pre-save state)
    const needsTranscode = !!(this.editVideoFileName && this.editPresetId) &&
      (!existing?.transcodeJobId ||
        existing?.videoFileName !== this.editVideoFileName ||
        existing?.presetId != this.editPresetId); // loose equality for Java Long vs JS Number

    const payload: any = {
      imdbId: this.editData.imdbID, title: this.editData.Title, year: this.editData.Year,
      rated: this.editData.Rated, released: this.editData.Released, runtime: this.editData.Runtime,
      genre: this.editData.Genre, director: this.editData.Director, actors: this.editData.Actors,
      plot: this.editData.Plot, poster: this.editData.Poster, imdbRating: this.editData.imdbRating,
      videoFileName: this.editVideoFileName || null, presetId: this.editPresetId || null,
      transcodeJobId: existing?.transcodeJobId || null
    };

    this.api.saveCmsMovie(payload).subscribe({
      next: (saved) => {
        const afterPoster = (finalSaved: any) => {
          if (needsTranscode) {
            this.api.startTranscode({
              inputFileName: this.editVideoFileName,
              presetIds: [this.editPresetId!],
              outputFormat: 'HLS'
            }).subscribe({
              next: (job) => {
                this.api.saveCmsMovie({ ...payload, transcodeJobId: job.id }).subscribe({
                  next: (updated) => { this.movieOverrides[updated.imdbId] = updated; this.finishSave('Movie saved & transcode started!'); },
                  error: () => { this.movieOverrides[finalSaved.imdbId] = finalSaved; this.finishSave('Transcode started, but failed to save job ID.'); }
                });
              },
              error: () => { this.movieOverrides[finalSaved.imdbId] = finalSaved; this.finishSave('Movie saved, but transcode failed to start.'); }
            });
          } else {
            this.movieOverrides[finalSaved.imdbId] = finalSaved;
            this.finishSave();
          }
        };

        if (this.selectedPosterFile) {
          this.api.uploadCmsPoster(this.editData!.imdbID, this.selectedPosterFile).subscribe({
            next: (u) => afterPoster(u),
            error: () => afterPoster(saved)
          });
        } else {
          afterPoster(saved);
        }
      },
      error: () => { this.saving = false; this.errorMessage = 'Failed to save.'; setTimeout(() => this.errorMessage = '', 4000); }
    });
  }

  private finishSave(msg?: string) {
    this.saving = false;
    if (this.editData) {
      const idx = this.movies.findIndex(m => m.imdbID === this.editData!.imdbID);
      if (idx >= 0) this.movies[idx] = { ...this.movies[idx], Title: this.editData.Title, Year: this.editData.Year, Poster: this.editData.Poster };
    }
    this.closeDetail();
    this.successMessage = msg || 'Movie saved successfully!';
    setTimeout(() => this.successMessage = '', 4000);
    this.loadOverrides();
  }

  getCodecLabel(codec: string): string {
    const m: Record<string, string> = { 'libx264': 'H.264', 'libx265': 'H.265', 'libvpx-vp9': 'VP9' };
    return m[codec] || codec;
  }
}
