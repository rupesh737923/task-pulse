import { Component, OnInit, HostListener, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TaskService } from '../../../core/services/task.service';
import { Task, TaskStatus, TaskPriority } from '../../../core/models/task.model';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { DueDateBadgeComponent } from '../../../shared/components/due-date-badge/due-date-badge.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AuthService } from '../../../core/services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatMenuModule, 
    MatButtonModule, 
    MatSelectModule, 
    MatFormFieldModule, 
    ButtonComponent, 
    DueDateBadgeComponent, 
    ModalComponent
  ],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.css'
})
export class TaskListComponent implements OnInit, AfterViewInit {
  tasks: Task[] = [];
  isLoading = true;

  searchQuery: string = '';
  selectedStatuses: string[] = []; // Changed to array for multi-select
  selectedPriorities: string[] = []; // Changed to array for multi-select
  selectedCategories: string[] = [];
  categories: string[] = ['Work', 'Personal', 'School', 'Health', 'Finance', 'Ideas', 'Job Search', 'Other'];
  selectedDay: string = 'today'; // Default to today for Daily Planner feel
  filterFromDate: string = '';
  filterToDate: string = '';
  showFilters: boolean = false;
  readonly TaskStatus = TaskStatus; // Expose to template
  selectedTaskForDescription: Task | null = null;
  taskToComplete: Task | null = null;
  today = new Date();
  @ViewChild('overdueSlider') overdueSlider!: ElementRef;
  canScrollLeft = false;
  canScrollRight = true;

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  scrollSlider(direction: number): void {
    if (this.overdueSlider) {
      const scrollAmount = 250;
      this.overdueSlider.nativeElement.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
      });
    }
  }

  updateScrollButtons(): void {
    if (this.overdueSlider) {
      const el = this.overdueSlider.nativeElement;
      this.canScrollLeft = el.scrollLeft > 0;
      this.canScrollRight = el.scrollLeft < (el.scrollWidth - el.clientWidth - 5);
    }
  }

  constructor(
    public authService: AuthService,
    private taskService: TaskService,
    public router: Router,
    private eRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadTasks();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateScrollButtons(), 500);
  }

  private saveFilters(): void {
    const state = {
      searchQuery: this.searchQuery,
      selectedStatuses: this.selectedStatuses,
      selectedPriorities: this.selectedPriorities,
      selectedCategories: this.selectedCategories,
      selectedDay: this.selectedDay,
      filterFromDate: this.filterFromDate,
      filterToDate: this.filterToDate
    };
    localStorage.setItem('task_filters', JSON.stringify(state));
  }

  private loadFilters(): void {
    const saved = localStorage.getItem('task_filters');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this.searchQuery = state.searchQuery || '';
        this.selectedStatuses = state.selectedStatuses || [];
        this.selectedPriorities = state.selectedPriorities || [];
        this.selectedCategories = state.selectedCategories || [];
        this.selectedDay = state.selectedDay || 'today';
        this.filterFromDate = state.filterFromDate || '';
        this.filterToDate = state.filterToDate || '';
      } catch (e) {
        console.error('Error parsing saved filters', e);
      }
    }
  }

  loadTasks(): void {
    this.isLoading = true;
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        const priorityWeight = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        
        this.tasks = tasks.sort((a, b) => {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          
          if (dateA !== dateB) return dateA - dateB;
          
          const weightA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
          const weightB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;
          
          return weightB - weightA;
        });
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching tasks', error);
        this.isLoading = false;
      }
    });
  }

  onAddTask(): void {
    this.router.navigate(['/task/add']);
  }

  viewDescription(task: Task): void {
    this.selectedTaskForDescription = task;
  }

  closeDescription(): void {
    this.selectedTaskForDescription = null;
  }

  onEditTask(id: string | number | undefined): void {
    if (id) {
      this.router.navigate(['/task/edit', id]);
    }
  }

  onCloneTask(task: Task): void {
    this.router.navigate(['/task/add'], { state: { cloneData: task } });
  }

  onDeleteTask(id: string | number | undefined): void {
    if (id && confirm('Are you sure you want to delete this task?')) {
      this.taskService.deleteTask(id).subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.id !== id);
        },
        error: (error) => console.error('Error deleting task', error)
      });
    }
  }

  onMarkCompleteClick(event: Event, task: Task): void {
    event.stopPropagation();
    if (task.status === TaskStatus.COMPLETED) return;
    this.taskToComplete = task;
  }

  confirmComplete(): void {
    if (this.taskToComplete) {
      this.markComplete(this.taskToComplete);
      this.taskToComplete = null;
    }
  }

  cancelComplete(): void {
    this.taskToComplete = null;
  }

  markComplete(task: Task): void {
    if (task.status === TaskStatus.COMPLETED) return;
    
    let nextStatus: TaskStatus;
    if (task.status === TaskStatus.TODO) {
      nextStatus = TaskStatus.IN_PROGRESS;
    } else {
      nextStatus = TaskStatus.COMPLETED;
    }

    const updatedTask = { ...task, status: nextStatus as any };
    this.taskService.updateTask(task.id!, updatedTask).subscribe({
      next: () => {
        task.status = nextStatus;
      },
      error: (error) => console.error('Error updating task status', error)
    });
  }

  toggleStatusFilter(status: string): void {
    const index = this.selectedStatuses.indexOf(status);
    if (index === -1) {
      this.selectedStatuses = [...this.selectedStatuses, status];
    } else {
      this.selectedStatuses = this.selectedStatuses.filter(s => s !== status);
    }
    this.saveFilters();
  }

  togglePriorityFilter(priority: string): void {
    const index = this.selectedPriorities.indexOf(priority);
    if (index === -1) {
      this.selectedPriorities = [...this.selectedPriorities, priority];
    } else {
      this.selectedPriorities = this.selectedPriorities.filter(p => p !== priority);
    }
    this.saveFilters();
  }

  setSelectedDay(day: string): void {
    this.selectedDay = day;
    this.saveFilters();
  }

  onSearchChange(): void {
    this.saveFilters();
  }

  onDateRangeChange(): void {
    this.saveFilters();
  }

  onCategoryChange(): void {
    this.saveFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatuses = [];
    this.selectedPriorities = [];
    this.selectedCategories = [];
    this.filterFromDate = '';
    this.filterToDate = '';
    this.selectedDay = 'all';
    this.saveFilters();
  }

  toggleCategoryFilter(category: string): void {
    const index = this.selectedCategories.indexOf(category);
    if (index === -1) {
      this.selectedCategories = [...this.selectedCategories, category];
    } else {
      this.selectedCategories = this.selectedCategories.filter(c => c !== category);
    }
    this.saveFilters();
  }

  formatStatus(status: string): string {
    if (!status) return '';
    return status.replace(/_/g, ' ');
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority.toLowerCase()}`;
  }

  private async getLogoBase64(): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve('');
      img.src = 'icons/icon-72x72.png';
    });
  }

  async exportToPDF(): Promise<void> {
    const doc = new jsPDF();
    const tasksToExport = this.filteredTasks;
    
    const logo = await this.getLogoBase64();
    if (logo) {
      doc.addImage(logo, 'PNG', 14, 10, 10, 10);
    }

    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229);
    doc.text('Task Pulse - Task Report', logo ? 28 : 14, 18);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    doc.setDrawColor(230, 230, 230);
    doc.line(14, 32, 196, 32);
    
    const tableData = tasksToExport.map(task => [
      task.title,
      task.status,
      task.priority,
      task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Date',
      task.description || 'N/A'
    ]);

    autoTable(doc, {
      head: [['Title', 'Status', 'Priority', 'Due Date', 'Description']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 }
    });

    doc.save('task-pulse-export.pdf');
  }

  triggerImport(): void {
    const fileInput = document.getElementById('importFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  private parseDueDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString();
    
    // Check for DD/MM/YYYY format
    const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.trim().match(ddmmyyyyRegex);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    // Fallback to default parsing
    const fallbackDate = new Date(dateStr);
    return isNaN(fallbackDate.getTime()) ? new Date().toISOString() : fallbackDate.toISOString();
  }

  importTasks(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const content = e.target.result;
      const trimmedContent = content.trim();
      try {
        let importedTasks: any[] = [];

        // Try JSON first if it looks like JSON
        if (trimmedContent.startsWith('[') || trimmedContent.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmedContent);
            importedTasks = Array.isArray(parsed) ? parsed : [parsed];
          } catch (jsonErr) {
            console.warn('File looks like JSON but failed to parse', jsonErr);
          }
        }

        // If not JSON or JSON parsing yielded nothing, try CSV
        if (importedTasks.length === 0) {
          const lines = trimmedContent.split('\n');
          if (lines.length >= 2) {
            const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              
              const values = line.split(',').map((v: string) => v.trim());
              const task: any = {};
              headers.forEach((header: string, index: number) => {
                if (header.includes('title')) task.title = values[index];
                else if (header.includes('desc')) task.description = values[index];
                else if (header.includes('status')) task.status = values[index].toUpperCase();
                else if (header.includes('priority')) task.priority = values[index].toUpperCase();
                else if (header.includes('date')) task.dueDate = values[index];
                else task[header] = values[index];
              });
              
              if (task.title) importedTasks.push(task);
            }
          }
        }

        if (Array.isArray(importedTasks) && importedTasks.length > 0) {
          let importedCount = 0;
          let errorCount = 0;

          importedTasks.forEach((task: any) => {
            const taskData: any = {
              title: task.title || 'Imported Task',
              description: task.description || '',
              status: task.status || TaskStatus.TODO,
              priority: task.priority || TaskPriority.MEDIUM,
              dueDate: this.parseDueDate(task.dueDate)
            };

            this.taskService.createTask(taskData).subscribe({
              next: () => {
                importedCount++;
                if (importedCount + errorCount === importedTasks.length) {
                  this.loadTasks();
                  alert(`Import Complete!\nSuccess: ${importedCount}\nErrors: ${errorCount}`);
                }
              },
              error: (err) => {
                console.error('Error importing individual task', err);
                errorCount++;
                if (importedCount + errorCount === importedTasks.length) {
                  this.loadTasks();
                  alert(`Import Complete with some errors.\nSuccess: ${importedCount}\nErrors: ${errorCount}`);
                }
              }
            });
          });
        } else {
          alert('No valid tasks found in the file. Please ensure the format is correct.');
        }
      } catch (err) {
        console.error('Error parsing file', err);
        alert('Failed to parse file. Please check the file content and format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    const filterBtn = document.querySelector('.v2-filter-btn');
    const filterPanel = document.querySelector('.v2-filter-panel');
    const mobileModal = document.querySelector('.v2-mobile-filter-container');
    
    // Close desktop dropdown if clicking outside
    if (this.showFilters && !this.isMobile && 
        filterPanel && !filterPanel.contains(event.target) && 
        filterBtn && !filterBtn.contains(event.target)) {
      this.showFilters = false;
    }
  }

  isToday(date: any): boolean {
    if (!date) return false;
    const d = new Date(date);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  }

  get todayTasks(): Task[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inTwoDays = new Date(today);
    inTwoDays.setDate(today.getDate() + 2);

    return this.tasks.filter(task => {
      const taskDate = task.dueDate ? new Date(task.dueDate) : null;
      if (!taskDate) return false;
      
      const isDueToday = taskDate.getTime() >= today.getTime() && 
                        taskDate.getTime() < new Date(today.getTime() + 86400000).getTime();
      
      const isInProgress = task.status === TaskStatus.IN_PROGRESS;
      const isNotOverdue = taskDate.getTime() >= today.getTime();
      
      const isTodoSoon = task.status === TaskStatus.TODO && 
                        taskDate.getTime() >= today.getTime() && 
                        taskDate.getTime() <= inTwoDays.getTime();

      return isDueToday || (isInProgress && isNotOverdue) || isTodoSoon;
    }).sort((a, b) => {
      const statusOrder = { [TaskStatus.IN_PROGRESS]: 0, [TaskStatus.TODO]: 1, [TaskStatus.COMPLETED]: 2 };
      const orderA = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
      const orderB = statusOrder[b.status as keyof typeof statusOrder] ?? 99;

      if (orderA !== orderB) return orderA - orderB;

      const dateA = new Date(a.dueDate!).getTime();
      const dateB = new Date(b.dueDate!).getTime();
      if (dateA !== dateB) return dateA - dateB;

      const priorityWeight = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      const weightA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
      const weightB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;
      return weightB - weightA;
    });
  }

  get overdueTasks(): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.tasks.filter(task => {
      if (!task.dueDate || task.status === TaskStatus.COMPLETED) return false;
      const d = new Date(task.dueDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    });
  }

  get activeTasksCount(): number {
    return this.todayTasks.filter(t => t.status !== TaskStatus.COMPLETED).length;
  }

  get completedTasks(): Task[] {
    return this.tasks.filter(t => t.status === TaskStatus.COMPLETED);
  }

  get todayProgress(): number {
    if (this.todayTasks.length === 0) return 0;
    const completed = this.todayTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    return Math.round((completed / this.todayTasks.length) * 100);
  }

  get overdueSeverityWidth(): number {
    const count = this.overdueTasks.length;
    if (count === 0) return 0;
    if (count <= 2) return 33;
    if (count < 5) return 66;
    return 100;
  }

  get activeFiltersCount(): number {
    let count = 0;
    if (this.searchQuery) count++;
    if (this.selectedStatuses.length > 0) count++;
    if (this.selectedPriorities.length > 0) count++;
    if (this.selectedCategories.length > 0) count++;
    if (this.selectedDay !== 'all') count++;
    if (this.filterFromDate || this.filterToDate) count++;
    return count;
  }

  get filteredTasks(): Task[] {
    return this.tasks.filter(task => {
      const matchesSearch = !this.searchQuery || 
        task.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesStatus = this.selectedStatuses.length === 0 || this.selectedStatuses.includes(task.status);
      const matchesPriority = this.selectedPriorities.length === 0 || this.selectedPriorities.includes(task.priority);
      const matchesCategory = this.selectedCategories.length === 0 || 
        (task.category && this.selectedCategories.includes(task.category));
      
      let matchesDate = true;
      if (this.filterFromDate || this.filterToDate) {
        if (!task.dueDate) matchesDate = false;
        else {
          const d = new Date(task.dueDate).getTime();
          if (this.filterFromDate && d < new Date(this.filterFromDate).getTime()) matchesDate = false;
          if (this.filterToDate && d > new Date(this.filterToDate).getTime()) matchesDate = false;
        }
      } else if (this.selectedDay !== 'all') {
        if (!task.dueDate) matchesDate = false;
        else {
          const d = new Date(task.dueDate);
          const target = new Date();
          if (this.selectedDay === 'yesterday') target.setDate(target.getDate() - 1);
          else if (this.selectedDay === 'tomorrow') target.setDate(target.getDate() + 1);
          
          matchesDate = d.getDate() === target.getDate() &&
                       d.getMonth() === target.getMonth() &&
                       d.getFullYear() === target.getFullYear();
        }
      }
      
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesDate;
    });
  }

  get isDashboardView(): boolean {
    return this.activeFiltersCount === 0;
  }

  get isMobile(): boolean {
    return window.innerWidth <= 768;
  }
}
