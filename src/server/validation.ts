export const isValidEmail = (email: string): boolean => {
  const re =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 8 && /\d/.test(password);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const ALLOWED_CERT_LEVELS = ['Foundational', 'Associate', 'Professional', 'Expert'] as const;
export type CertLevel = (typeof ALLOWED_CERT_LEVELS)[number];
