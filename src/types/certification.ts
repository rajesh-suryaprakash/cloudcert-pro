export interface Certification {
  id: string;
  title: string;
  vendor: string;
  description: string;
  level: string;
  examCode?: string;
  url?: string;
  iconUrl?: string;
  isActive: boolean;
}

export interface Topic {
  id: string;
  certificationId: string;
  title: string;
  description?: string;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // New fields for unified domain weight management
  weightPercentage?: number;
  docUrl?: string;
}
