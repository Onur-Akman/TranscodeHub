import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-watch-party-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './watch-party-page.component.html',
  styleUrl: './watch-party-page.component.scss'
})
export class WatchPartyPageComponent implements OnInit {
  movies: any[] = [];
  loading = true;
  creatingRoom = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadMovies();
  }

  loadMovies() {
    this.loading = true;
    this.api.getWatchPartyMovies().subscribe({
      next: (movies) => {
        this.movies = movies;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getPoster(movie: any): string {
    if (movie.poster) return movie.poster;
    return 'https://via.placeholder.com/300x450?text=No+Poster';
  }

  createRoom(movie: any) {
    this.creatingRoom = true;
    this.api.createWatchPartyRoom(movie.imdbId, movie.transcodeJobId).subscribe({
      next: (room: any) => {
        this.creatingRoom = false;
        this.router.navigate(['/watch-party/room', room.id]);
      },
      error: () => {
        this.creatingRoom = false;
      }
    });
  }
}
