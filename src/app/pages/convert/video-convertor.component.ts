import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface VideoTool {
  id: string;
  title: string;
  description: string;
  icon: string;
  accept: string;
  format: string;
  targetExt: string;
  type: string;
  command?: string[];
}

@Component({
  selector: 'app-video-convertor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-convertor.component.html',
  styleUrls: ['./convertor-base.css', './video-convertor.component.css']
})
export class VideoConvertorComponent implements OnDestroy {
  tools: VideoTool[] = [
    {
      id: 'mp4-webm',
      title: 'MP4 to WebM',
      description: 'Convert MP4 videos to WebM format for better web performance.',
      icon: 'movie',
      accept: '.mp4',
      format: 'MP4',
      targetExt: '.webm',
      type: 'convert',
      command: ['-i', 'input.video', '-c:v', 'libvpx', '-c:a', 'libvorbis', 'output.webm']
    },
    {
      id: 'video-mp3',
      title: 'Video to MP3',
      description: 'Extract high-quality audio from any video file in seconds.',
      icon: 'audiotrack',
      accept: '.mp4,.mkv,.avi,.mov',
      format: 'Video',
      targetExt: '.mp3',
      type: 'convert',
      command: ['-i', 'input.video', '-vn', '-acodec', 'libmp3lame', 'output.mp3']
    },
    {
      id: 'compress-video',
      title: 'Compress Video',
      description: 'Reduce video file size without losing significant quality.',
      icon: 'compress',
      accept: '.mp4,.mkv,.avi,.mov',
      format: 'Video',
      targetExt: '.mp4',
      type: 'compress',
      command: ['-i', 'input.video', '-vcodec', 'libx264', '-crf', '28', 'output.mp4']
    },
    {
      id: 'video-gif',
      title: 'Video to GIF',
      description: 'Create high-quality animated GIFs from your video clips.',
      icon: 'gif',
      accept: '.mp4,.mov',
      format: 'Video',
      targetExt: '.gif',
      type: 'convert',
      command: ['-i', 'input.video', '-vf', 'fps=10,scale=320:-1:flags=lanczos', 'output.gif']
    },
    {
      id: 'mkv-mp4',
      title: 'MKV to MP4',
      description: 'Convert MKV files to widely compatible MP4 format.',
      icon: 'video_file',
      accept: '.mkv',
      format: 'MKV',
      targetExt: '.mp4',
      type: 'convert',
      command: ['-i', 'input.mkv', '-codec', 'copy', 'output.mp4']
    },
    {
      id: 'mute-video',
      title: 'Mute Video',
      description: 'Remove audio from any video file while keeping the quality.',
      icon: 'volume_off',
      accept: '.mp4,.mkv,.mov',
      format: 'Video',
      targetExt: '.mp4',
      type: 'convert',
      command: ['-i', 'input.video', '-an', '-vcodec', 'copy', 'output.mp4']
    }
  ];

  activeTool: VideoTool | null = null;
  selectedFiles: File[] = [];
  previewUrl: string | null = null;
  isDragging = false;
  isConverting = false;
  progress = 0;
  
  private ffmpeg: any = null;
  private createFFmpeg: any = null;
  private fetchFile: any = null;

  constructor(private router: Router) {}

  ngOnDestroy() {
    this.cleanupPreview();
  }

  private async loadLibrary(): Promise<void> {
    if ((window as any).FFmpeg) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Using explicit 0.11.6 version for the wrapper
      script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load FFmpeg library'));
      document.head.appendChild(script);
    });
  }

  async loadFFmpeg() {
    if (this.ffmpeg) return;
    
    try {
      await this.loadLibrary();
      
      const FFmpegLib = (window as any).FFmpeg;
      if (!FFmpegLib) throw new Error('FFmpeg global object not found');
      
      this.createFFmpeg = FFmpegLib.createFFmpeg;
      this.fetchFile = FFmpegLib.fetchFile;

      this.ffmpeg = this.createFFmpeg({
        log: true,
        // Using explicit 0.11.1 single-threaded core
        corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js'
      });

      this.ffmpeg.setProgress(({ ratio }: any) => {
        this.progress = Math.round(ratio * 100);
      });

      await this.ffmpeg.load();
      
      // Explicit check for readiness
      if (!this.ffmpeg.isLoaded()) {
        throw new Error('Engine loaded but isLoaded() returned false');
      }

      // Small delay to ensure memory is allocated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('FFmpeg v0.11.6 ST Ready');
    } catch (err: any) {
      this.ffmpeg = null;
      console.error('Library Load Error:', err);
      alert('Video engine failed to start. Please try refreshing the page or using a different browser.');
    }
  }

  async openTool(tool: VideoTool) {
    this.activeTool = tool;
    this.selectedFiles = [];
    this.cleanupPreview();
    await this.loadFFmpeg();
  }

  closeTool() {
    this.activeTool = null;
    this.selectedFiles = [];
    this.cleanupPreview();
    this.progress = 0;
  }

  onFileSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) this.processFiles(files);
  }

  private processFiles(files: File[]) {
    if (!this.activeTool) return;
    const valid = files.filter(f => this.isValidFile(f));
    if (valid.length === 0) return alert(`Select ${this.activeTool.format} files.`);
    
    this.selectedFiles = [valid[0]];
    this.cleanupPreview();
    if (valid[0].type.startsWith('video/')) {
      this.previewUrl = URL.createObjectURL(valid[0]);
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    if (this.selectedFiles.length === 0) this.cleanupPreview();
  }

  cleanupPreview() {
    if (this.previewUrl) { URL.revokeObjectURL(this.previewUrl); this.previewUrl = null; }
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging = true; }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging = false; }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging = false;
    if (e.dataTransfer?.files) this.processFiles(Array.from(e.dataTransfer.files));
  }

  isValidFile(file: File): boolean {
    if (!this.activeTool) return false;
    return this.activeTool.accept.split(',').some(ext => file.name.toLowerCase().endsWith(ext.trim().toLowerCase()));
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async convert() {
    if (!this.ffmpeg || !this.fetchFile || this.selectedFiles.length === 0 || !this.activeTool) return;
    this.isConverting = true;
    this.progress = 0;
    
    try {
      const file = this.selectedFiles[0];
      const inputName = `input${file.name.substring(file.name.lastIndexOf('.'))}`;
      const outputName = `output${this.activeTool.targetExt}`;
      
      console.log(`Writing file: ${inputName}`);
      this.ffmpeg.FS('writeFile', inputName, await this.fetchFile(file));
      
      const cmd = [...this.activeTool.command!];
      const finalCmd = cmd.map(part => {
        if (part.startsWith('input.')) return inputName;
        if (part.startsWith('output.')) return outputName;
        return part;
      });

      console.log('Executing Command:', finalCmd.join(' '));
      await this.ffmpeg.run(...finalCmd);
      
      const data = this.ffmpeg.FS('readFile', outputName);
      const blob = new Blob([data.buffer], { type: this.getMimeType(this.activeTool.targetExt) });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.[^/.]+$/, "") + (this.activeTool.type === 'compress' ? '_compressed' : '_converted') + this.activeTool.targetExt;
      a.click();
      URL.revokeObjectURL(url);
      
      alert('Conversion Successful!');
    } catch (err: any) {
      console.error('Conversion Error Details:', err);
      alert('Video conversion failed. Technical Error: ' + (err.message || 'Unknown error occurred.'));
    } finally {
      this.isConverting = false;
      this.closeTool();
    }
  }

  private getMimeType(ext: string): string {
    switch (ext.toLowerCase()) {
      case '.mp4': return 'video/mp4';
      case '.webm': return 'video/webm';
      case '.gif': return 'image/gif';
      case '.mp3': return 'audio/mpeg';
      default: return 'application/octet-stream';
    }
  }
}
