export type RecordedStep =
  | { type: 'navigate'; url: string; timestamp: number }
  | { type: 'click'; selector: string; timestamp: number }
  | { type: 'fill'; selector: string; value: string; timestamp: number }
  | { type: 'select'; selector: string; value: string; timestamp: number }
  | { type: 'extract'; name: string; selector: string; multiple: boolean; timestamp: number };

export interface RecordingState {
  isRecording: boolean;
  steps: RecordedStep[];
}
