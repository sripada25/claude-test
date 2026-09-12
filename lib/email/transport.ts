import nodemailer from "nodemailer";
import { env } from "../env.ts";

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    text: params.text,
    replyTo: params.replyTo,
  });
}
