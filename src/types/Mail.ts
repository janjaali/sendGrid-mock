export interface MailPersonalization {
  to?: Array<{
    name?: string;
    email: string;
  }>;
  cc?: Array<{
    name?: string;
    email: string;
  }>;
  bcc?: Array<{
    name?: string;
    email: string;
  }>;
  dynamic_template_data?: any;
  subject?: string;
  content?: {
    type: string;
    value: string;
    charset?: string;
  }[];
  body?: string;
  custom_args?: any;
}

export interface Mail {
  custom_args?: any;
  categories?: any;
  id?: string;
  from?: {
    name?: string;
    email?: string;
  };
  subject: string;
  content?: {
    type: string;
    value: string;
    charset?: string;
  }[];
  body?: string;
  datetime?: Date;
  personalizations?: Array<MailPersonalization>;
}
