import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { DueDateBadgeComponent } from '../../../shared/components/due-date-badge/due-date-badge.component';
import { Task, TaskPriority, TaskStatus } from '../../../core/models/task.model';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter, DateAdapter } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export class CustomDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === 'input') {
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleString('en-GB', { month: 'short' });
      const year = date.getFullYear();
      const weekday = date.toLocaleString('en-GB', { weekday: 'short' });
      return `${weekday}, ${day} ${month} ${year}`;
    }
    return super.format(date, displayFormat);
  }
}

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: { month: 'short', year: 'numeric', day: 'numeric' },
  },
  display: {
    dateInput: 'input',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    ButtonComponent, 
    InputComponent, 
    DueDateBadgeComponent,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule
  ],
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ],
  templateUrl: './task-form.component.html',
  styleUrl: './task-form.component.css'
})
export class TaskFormComponent implements OnInit {
  taskForm!: FormGroup;
  taskId: string | null = null;
  isEditMode = false;
  isSubmitted = false;
  isLoading = false;
  isFetching = false;
  errorMessage = '';
  minDate = new Date();
  
  categories: string[] = ['Work', 'Personal', 'School', 'Health', 'Finance', 'Ideas', 'Job Search', 'Other'];

  constructor(
    private fb: FormBuilder,
    private taskService: TaskService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.taskId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.taskId;

    this.initForm();

    if (this.isEditMode) {
      this.loadTask();
    } else {
      const state = history.state;
      if (state && state.cloneData) {
        const clone = state.cloneData;
        this.taskForm.patchValue({
          title: `${clone.title} (Clone)`,
          description: clone.description,
          status: clone.status,
          dueDate: new Date(clone.dueDate),
          priority: clone.priority,
          category: clone.category || ''
        });
        this.checkAndDisableDueDate();
      }
    }
  }

  private initForm(): void {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(75)]],
      description: ['', [Validators.maxLength(400)]],
      status: [TaskStatus.TODO, Validators.required],
      dueDate: [new Date(), Validators.required],
      priority: ['MEDIUM', Validators.required],
      category: ['']
    });
  }

  private loadTask(): void {
    this.isFetching = true;
    this.taskService.getTask(this.taskId!).subscribe({
      next: (task: Task) => {
        this.taskForm.patchValue({
          title: task.title,
          description: task.description,
          status: task.status,
          dueDate: new Date(task.dueDate),
          priority: task.priority,
          category: task.category || ''
        });
        this.checkAndDisableDueDate();
        this.isFetching = false;
      },
      error: (err) => {
        console.error('Error loading task:', err);
        this.errorMessage = 'Failed to load task details';
        this.isFetching = false;
      }
    });
  }

  private checkAndDisableDueDate(): void {
    this.taskForm.get('dueDate')?.enable();
  }

  private formatDateForInput(dateString: string | Date | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onSubmit(): void {
    if (this.isLoading) {
      return;
    }
    
    this.isSubmitted = true;
    if (this.taskForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const taskData: Task = this.taskForm.getRawValue();

    if (this.isEditMode) {
      this.taskService.updateTask(this.taskId!, taskData).subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/task']);
        },
        error: (err) => {
          console.error('Error updating task:', err);
          this.errorMessage = 'Failed to update task. Please try again.';
          this.isLoading = false;
        }
      });
    } else {
      this.taskService.createTask(taskData).subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/task']);
        },
        error: (err) => {
          console.error('Error creating task:', err);
          this.errorMessage = 'Failed to create task. Please try again.';
          this.isLoading = false;
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/task']);
  }
}
