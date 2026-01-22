
export enum AppView {
  LOGIN = 'login',
  REGISTER = 'register',
  DASHBOARD = 'dashboard',
  ASSISTANT = 'assistant',
  REPORT_ANALYZER = 'report_analyzer',
  PROFILE = 'profile'
}

export interface Reminder {
  id: string;
  title: string;
  date: string;
  completed: boolean;
  urgent: boolean;
}

export interface HistoryItem {
  id: string;
  condition: string;
  date: string;
  urgency: string;
}

export interface VitalRecord {
  time: string;
  bpm: number;
}

export interface UserProfile {
  name: string;
  email: string;
  age?: string;
  gender?: string;
  bloodType?: string;
  weight?: string;
  height?: string;
  allergies?: string;
  medicalHistory?: string;
  reminders?: Reminder[];
  history?: HistoryItem[];
  vitalsHistory?: VitalRecord[];
}

export interface AnalysisResult {
  condition: string;
  probability: number;
  urgency: 'Low' | 'Medium' | 'High' | 'Emergency';
  description: string;
  recommendations: string[];
  caveats: string;
}

export interface LabReportSummary {
  parameters: Array<{
    name: string;
    value: string;
    unit: string;
    status: 'Normal' | 'Abnormal' | 'Warning';
    notes: string;
  }>;
  overallHealthScore: number;
  interpretation: string;
}
