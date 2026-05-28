// Common cloud-provider contract. Google Workspace and Microsoft 365 implement it.
// Keeps drive-service / consent-service provider-agnostic (one abstraction, two backends).

export type ProviderName = 'google_workspace' | 'microsoft_365';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds until access_token expires
}

export interface CloudFile {
  id: string;
  name: string;
}

export interface UploadResult {
  id: string;
  url: string;
}

export interface EmailAttachment {
  filename: string;
  bytes: Uint8Array;
  mime: string;
}

export interface CloudProvider {
  name: ProviderName;

  // OAuth
  auth_url(redirect_uri: string, state: string): string;
  exchange_code(code: string, redirect_uri: string): Promise<OAuthTokens>;
  refresh(refresh_token: string): Promise<OAuthTokens>;
  account_email(access_token: string): Promise<string>;

  // Onboarding setup
  ensure_folder(access_token: string, name: string): Promise<string>;
  ensure_sheet(access_token: string, folder_id: string, title: string): Promise<string>;

  // Documents
  list_pdfs(access_token: string, folder_id: string | null): Promise<CloudFile[]>;
  download_file(access_token: string, file_id: string): Promise<Uint8Array>;
  upload_pdf(access_token: string, folder_id: string, name: string, bytes: Uint8Array): Promise<UploadResult>;

  // History sheet
  append_sheet_row(access_token: string, sheet_id: string, row: string[]): Promise<void>;

  // Email (sent from the client's own account — zero-knowledge)
  send_email(
    access_token: string,
    from: string,
    to: string,
    subject: string,
    html: string,
    text: string,
    attachment?: EmailAttachment,
  ): Promise<void>;
}
