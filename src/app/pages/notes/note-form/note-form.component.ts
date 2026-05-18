import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NotesService } from '../../../services/notes.service';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-note-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule,
    MatSelectModule,
    MatTooltipModule
  ],
  templateUrl: './note-form.component.html',
  styleUrl: './note-form.component.css'
})
export class NoteFormComponent implements OnInit {
  noteForm!: FormGroup;
  isEditMode = false;
  noteId?: number;
  
  categories: string[] = ['Work', 'Personal', 'School', 'Health', 'Finance', 'Ideas', 'Job Search', 'Other'];

  constructor(
    private fb: FormBuilder,
    private notesService: NotesService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.noteId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.noteId) {
      this.isEditMode = true;
      this.loadNote(this.noteId);
    }
  }

  createForm(): void {
    this.noteForm = this.fb.group({
      title: ['', [Validators.required]],
      content: ['', [Validators.required]],
      category: ['']
    });
  }

  loadNote(id: number): void {
    this.notesService.getNote(id).subscribe({
      next: (note) => {
        this.noteForm.patchValue({
          title: note.title,
          content: note.content,
          category: note.category || ''
        });
      },
      error: (err) => {
        console.error('Error loading note', err);
        this.snackBar.open('Error loading note', 'Close', { duration: 3000 });
        this.router.navigate(['/notes']);
      }
    });
  }

  onSubmit(): void {
    if (this.noteForm.invalid) {
      return;
    }

    const noteData = this.noteForm.value;

    if (this.isEditMode && this.noteId) {
      this.notesService.updateNote(this.noteId, noteData).subscribe({
        next: () => {
          this.snackBar.open('Note updated successfully', 'Close', { duration: 3000 });
          this.router.navigate(['/notes']);
        },
        error: (err) => {
          console.error('Error updating note', err);
          this.snackBar.open('Error updating note', 'Close', { duration: 3000 });
        }
      });
    } else {
      this.notesService.createNote(noteData).subscribe({
        next: () => {
          this.snackBar.open('Note created successfully', 'Close', { duration: 3000 });
          this.router.navigate(['/notes']);
        },
        error: (err) => {
          console.error('Error creating note', err);
          this.snackBar.open('Error creating note', 'Close', { duration: 3000 });
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/notes']);
  }
}
