export type CloudProvider = 'AWS' | 'GCP' | 'Azure';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}
