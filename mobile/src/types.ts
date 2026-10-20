export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  hangoutLink?: string;
  conferenceData?: unknown;
}

export interface MeetingProposal {
  proposalId: string;
  title: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
  createMeet?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: MeetingProposal;
  timestamp: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: {
    email?: string;
    name?: string;
    picture?: string;
  } | null;
  isConfigured: boolean;
}
