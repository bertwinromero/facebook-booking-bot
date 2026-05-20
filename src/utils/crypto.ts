import crypto from 'crypto';

export function verifyFacebookSignature(
  signature: string | undefined,
  body: string,
  appSecret: string
): boolean {
  if (!signature) {
    return false;
  }

  const elements = signature.split('=');
  const signatureHash = elements[1];

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHash),
    Buffer.from(expectedHash)
  );
}
