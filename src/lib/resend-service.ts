import { Resend } from 'resend';
import { INotificationService } from './interfaces';
import { PendingCreditMemo } from './notifications';

export class ResendNotificationService implements INotificationService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'; // Resend testing default

    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendCreditMemo(memo: PendingCreditMemo): Promise<boolean> {
    if (!this.resend) {
      console.warn("No RESEND_API_KEY found. Falling back to Console mock email.");
      return this.mockSend(memo);
    }

    try {
      const data = await this.resend.emails.send({
        from: `Price Guard <${this.fromEmail}>`,
        to: [memo.vendorEmail],
        subject: `Credit Request - Invoice #${memo.invoiceNumber}`,
        text: memo.compiledEmailBody || "A credit request is attached.",
        // We could also pass HTML here if we compiled it
      });

      if (data.error) {
        throw new Error(data.error.message);
      }

      console.log(`[Resend] Successfully sent email to ${memo.vendorEmail}. ID: ${data.data?.id}`);
      return true;

    } catch (error) {
      console.error("[Resend] Failed to send email:", error);
      return false; // UI handles failures or ignores them
    }
  }

  private mockSend(memo: PendingCreditMemo): boolean {
    console.log(`\n[MOCK EMAIL SENT] ===========================`);
    console.log(`To: ${memo.vendorEmail}`);
    console.log(`Subject: Credit Request - Invoice ${memo.invoiceNumber}`);
    console.log(`Body: ${memo.compiledEmailBody?.substring(0, 50)}...\n=============================================\n`);
    
    // Simulate slight network delay
    return true;
  }
}
